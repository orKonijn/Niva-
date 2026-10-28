import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const password = 'Browser-test-password-2026';
async function quietCookies(page: Page) {
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
}
async function waitMail(email: string, subject: string) {
  const directory = resolve(process.env['NIVA_DATA_DIR'] ?? '.test-data/browser', 'outbox');
  let found = '';
  await expect
    .poll(async () => {
      for (const file of await readdir(directory).catch(() => [])) {
        try {
          const mail = JSON.parse(await readFile(resolve(directory, file), 'utf8')) as {
            to: string;
            subject: string;
            text: string;
          };
          if (mail.to === email && mail.subject.includes(subject))
            found = mail.text.match(/https?:\/\/\S+/)![0];
        } catch {
          /* A local SMTP fixture may still be writing this file. */
        }
      }
      return !!found;
    })
    .toBe(true);
  return found;
}
async function registerAndLogin(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('שם להצגה').fill('נועה בדיקה');
  await page.getByLabel('כתובת דוא״ל').fill(email);
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('בדקו את תיבת');
  await page.goto(await waitMail(email, 'אימות'));
  await page.getByLabel('כתובת דוא״ל').fill(email);
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'כניסה לחשבון', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('היי');
}
test.beforeEach(async ({ page }) => quietCookies(page));

test('real local guide searches catalog, persists and reopens a conversation, reviews a job and deletes only its test chat', async ({
  page,
}) => {
  await registerAndLogin(page, `guide-${crypto.randomUUID()}@example.test`);
  await page.goto('/app/assistant');
  await page.getByRole('button', { name: /למצוא משרות/ }).click();
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('נמצאו');
  await expect(page.getByRole('log')).toContainText('ללא בינה מלאכותית');
  await expect(page.locator('.assistant-main > ul a').first()).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'QA', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('נמצאו');
  await page.locator('.assistant-main > ul a').first().click();
  await page.getByRole('link', { name: 'שיחה והכנה לריאיון', exact: true }).click();
  await page.getByRole('button', { name: /להבין את המשרה/ }).click();
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('דרישות שחולצו מהמקור', { timeout: 15000 });
  const remove = page.getByRole('button', { name: 'מחיקת שיחה', exact: true }).first();
  await remove.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'ביטול', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await remove.click();
  await page.getByRole('button', { name: 'אישור מחיקה לצמיתות', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'מחיקת שיחה', exact: true })).toHaveCount(1);
});

test('real local account persists reviewed resume versions across reload and deletes them with account data', async ({
  page,
}) => {
  await registerAndLogin(page, `resume-${crypto.randomUUID()}@example.test`);
  await page.goto('/app/resumes');
  const text = 'Browser verification candidate\n\nPython and SQL at Example Employer\n2021–2026';
  await page.getByLabel('טקסט קורות החיים', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'שמירת טיוטה לבדיקה', exact: true }).click();
  await expect(page.getByRole('heading', { name: /בדיקת הגרסה/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /בדקתי את הטקסט/ }).check();
  await page.getByRole('button', { name: 'אישור עובדות ושמירת עריכה כגרסה', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('העובדות אושרו');
  await page.getByRole('checkbox', { name: /בדקתי את הטקסט/ }).check();
  await page.getByRole('button', { name: 'הפיכת הגרסה המאושרת לפעילה', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('הגרסה הפעילה עודכנה');
  await page.reload();
  await expect(page.locator('.career-version')).toContainText('פעילה');
  await page.getByRole('button', { name: 'קורות החיים שלי', exact: true }).click();
  await expect(page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true })).toHaveValue(text);
  await page.goto('/account');
  await page.getByRole('button', { name: 'מחיקת הנתונים השמורים בחשבון', exact: true }).click();
  await page.getByRole('button', { name: 'כן, מחיקת נתוני החשבון', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('נמחקו');
  await page.goto('/app/resumes');
  await expect(page.locator('.career-version')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(
    'Example Employer',
  );
});
test('real email registration/verification and independent sessions synchronize account data', async ({
  page,
  browser,
}, info) => {
  const email = `browser-${crypto.randomUUID()}@example.test`;
  await registerAndLogin(page, email);
  await page.goto('/app/preferences');
  await page.getByLabel('תחום שמעניין אותך').selectOption('qa-automation');
  await page.getByLabel('מחוז מועדף').selectOption('haifa');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByRole('status')).toContainText('ההעדפות נשמרו');
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'שמירת המשרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toBeVisible();
  await page.goto('/app/profile');
  await page.getByLabel('איך לקרוא לך?').fill('שם נשמר');
  await page.getByLabel('כותרת מקצועית').fill('QA Automation');
  await page.getByLabel('שנות ניסיון רלוונטי', { exact: true }).fill('4');
  await page.getByLabel('מדינה נוכחית (קוד, למשל IL)', { exact: true }).fill('IL');
  await page.getByRole('checkbox', { name: 'בדקתי ומאשר/ת את הפרטים האלה' }).check();
  await page.getByRole('button', { name: 'שמירת פרטים לבדיקת התאמה', exact: true }).click();
  await expect(page.getByText('הפרטים נשמרו. ההתאמות חושבו מחדש.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'שמירת שם בחשבון' }).click();
  await expect(page.getByText('הפרטים נשמרו בחשבון.', { exact: true })).toBeVisible();
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:4300' });
  const device = await other.newPage();
  await quietCookies(device);
  try {
    await device.goto('/login');
    await device.getByLabel('כתובת דוא״ל').fill(email);
    await device.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password);
    await device.getByRole('button', { name: 'כניסה לחשבון', exact: true }).click();
    await expect(device).toHaveURL(/\/app$/);
    await expect(device.getByRole('heading', { level: 1 })).toContainText('שם נשמר');
    await device.goto('/app/profile');
    await expect(device.getByLabel('שנות ניסיון רלוונטי', { exact: true })).toHaveValue('4');
    await expect(device.getByLabel('מדינה נוכחית (קוד, למשל IL)', { exact: true })).toHaveValue(
      'IL',
    );
    await device.goto('/app/jobs');
    await expect(device.locator('niva-job-card')).toHaveCount(1);
    await expect(device.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toBeVisible();
  } finally {
    await other.close();
  }
  await page.goto('/account');
  await expect(page.getByText('דוא״ל וסיסמה', { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({ path: `test-results/account-${info.project.name}.png`, fullPage: true });
  await page.goto('/account?oauth=error');
  await expect(page.getByRole('alert')).toContainText('קישור שיטת ההתחברות בוטל או נכשל');
  await page.getByRole('button', { name: 'יציאה מהחשבון' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(11);
  const storage = await page.evaluate(() => ({ ...localStorage }));
  expect(JSON.stringify(storage)).not.toContain(email);
  expect(JSON.stringify(storage)).not.toContain('שם נשמר');
  expect(JSON.stringify(storage)).not.toContain(password);
});
test('protected routes return safely, password visibility and failure/cancellation states are accessible', async ({
  page,
}, info) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('נעים לחזור');
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'הצגה', exact: true }).click();
  await expect(page.getByLabel('סיסמה ל־Niva', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'הסתרה', exact: true }).press('Enter');
  await expect(page.getByLabel('סיסמה ל־Niva', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({ path: `test-results/sign-in-${info.project.name}.png`, fullPage: true });
  await page.goto('/login?oauth=cancelled');
  await expect(page.getByRole('alert')).toContainText('בוטלה או נכשלה');
  await page.goto('/reset-password?token=invalid');
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
  await expect(page.getByRole('alert')).toContainText('לא ניתן');
});
test('static hosting clearly disables account methods and retains guest navigation', async ({
  page,
}) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  );
  await page.goto('/login');
  await expect(page.getByRole('status')).toContainText('ללא שרת חשבונות פעיל');
  await expect(page.getByRole('button', { name: 'כניסה לחשבון', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'המשך עם Google' })).toBeDisabled();
  await page.getByRole('link', { name: 'לצפייה במשרות' }).click();
  await expect(page).toHaveURL(/\/app\/jobs$/);
});

test('Google/Apple boundary mocks show unavailable/failure states without claiming real OAuth', async ({
  page,
}) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ json: { accounts: true, email: true, google: true, apple: true } }),
  );
  await page.route('**/api/auth/sign-in/social', (route) =>
    route.fulfill({ status: 503, json: { code: 'PROVIDER_UNAVAILABLE' } }),
  );
  await page.goto('/login');
  for (const provider of ['Google', 'Apple']) {
    await page.getByRole('button', { name: `המשך עם ${provider}` }).click();
    await expect(page.getByRole('alert')).toContainText('אינה זמינה');
  }
});
test('map groups multiple offices, separates remote/missing locations and follows filters', async ({
  page,
}, info) => {
  // Tile fixtures avoid automated traffic against community OSM servers.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhK0AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/app/jobs?view=map');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.niva-map-marker')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'עבודה מרחוק — ללא משרד על המפה' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'כתובת או קואורדינטות לא זמינות' })).toBeVisible();
  await page.getByRole('button', { name: 'חיפה ·', exact: false }).click();
  await expect(page.locator('.leaflet-popup')).toContainText('Full Stack Developer');
  await expect(page.locator('.leaflet-popup')).toContainText('QA Automation Engineer');
  await expect
    .poll(async () => {
      const popup = await page.locator('.leaflet-popup').boundingBox();
      const map = await page.locator('.leaflet-container').boundingBox();
      return !!popup && !!map && popup.x >= map.x && popup.x + popup.width <= map.x + map.width;
    })
    .toBe(true);
  await page
    .locator('niva-job-map')
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `test-results/map-${info.project.name}.png`, fullPage: false });
  await page.getByLabel('סינון לפי תחום').selectOption('qa-automation');
  await page.getByLabel('סינון לפי מחוז').selectOption('haifa');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('.niva-map-marker')).toHaveCount(1);
  await page.getByRole('button', { name: 'רשימה', exact: true }).click();
  await expect(page.locator('niva-job-map')).toHaveCount(0);
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.goto('/app/jobs/fullstack-developer');
  await expect(page.getByRole('region', { name: 'מיקומי המשרה' })).toContainText('חיפה');
  await expect(page.getByRole('region', { name: 'מיקומי המשרה' })).toContainText('תל אביב');
  await expect(page.getByRole('region', { name: 'מיקומי המשרה' }).getByRole('link')).toHaveCount(2);
});
test('map failure retains an accessible list and does not request device location', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => {
      throw new Error('Unexpected automatic geolocation request');
    };
  });
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/app/jobs?view=map&category=qa-automation');
  await expect(page.getByText('המפה או אריחי הרקע אינם זמינים', { exact: false })).toBeVisible();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'חיפה ·', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'חיפה ·', exact: false }).press('Enter');
  await expect(page.locator('.leaflet-popup')).toBeVisible();
});
test('explicit import preserves demo records, theme survives reload, and server deletion leaves device data', async ({
  page,
}) => {
  await page.goto('/app/jobs');
  await page.getByRole('button', { name: 'שמירת המשרה', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toHaveCount(1);
  const email = `import-${crypto.randomUUID()}@example.test`;
  await registerAndLogin(page, email);
  await page.goto('/app/jobs');
  await expect(page.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toHaveCount(0);
  await page.goto('/account');
  await page.getByRole('button', { name: 'בדיקת נתונים לפני ייבוא' }).click();
  await expect(page.getByRole('heading', { name: 'תצוגה מקדימה' })).toBeVisible();
  await expect(page.getByText('1 משרות שמורות', { exact: false })).toBeVisible();
  expect((await (await page.request.get('/api/account/state')).json()).saved).toHaveLength(0);
  await page.getByRole('button', { name: 'אישור ייבוא לחשבון' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'הייבוא לחשבון הזה כבר בוצע' }),
  ).toBeVisible();
  for (
    let i = 0;
    i < 3 && (await page.locator('html').getAttribute('data-theme-preference')) !== 'dark';
    i++
  ) {
    await page.getByRole('button', { name: /^ערכת נושא:/ }).click();
    await expect
      .poll(async () => (await (await page.request.get('/api/account/state')).json()).theme)
      .toBe(await page.locator('html').getAttribute('data-theme-preference'));
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await (await page.request.get('/app')).text()).toContain(
    'name="niva-account-theme" content="dark"',
  );
  await page.getByRole('button', { name: 'מחיקת הנתונים השמורים בחשבון', exact: true }).click();
  await page.getByRole('button', { name: 'כן, מחיקת נתוני החשבון' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'נתוני החשבון השמורים נמחקו' }),
  ).toBeVisible();
  const state = await (await page.request.get('/api/account/state')).json();
  expect(state.saved).toEqual([]);
  expect(state.importedAt).toBeTruthy();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('niva.demo.v1')!).saved.length),
  ).toBe(1);
});
test('password reset completes through the real local email fixture', async ({ page }) => {
  const email = `reset-${crypto.randomUUID()}@example.test`;
  await registerAndLogin(page, email);
  await page.goto('/account');
  await page.getByRole('button', { name: 'יציאה מהחשבון' }).click();
  await page.goto('/forgot-password');
  await page.getByLabel('כתובת דוא״ל').fill(email);
  await page.getByRole('button', { name: 'שליחת הוראות איפוס' }).click();
  await expect(page.getByRole('status')).toContainText('אם הכתובת רשומה');
  await page.goto(await waitMail(email, 'איפוס'));
  await expect(page).toHaveURL(/reset-password\?token=/);
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password + '-reset');
  await page.getByRole('button', { name: 'שמירת סיסמה חדשה' }).click();
  await expect(page.getByRole('status')).toContainText('הסיסמה עודכנה');
  await page.goto('/login');
  await page.getByLabel('כתובת דוא״ל').fill(email);
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(password + '-reset');
  await page.getByRole('button', { name: 'כניסה לחשבון', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});
test('auth forms and map retain contrast and mobile layout in both themes', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhK0AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  for (const theme of ['light', 'dark']) {
    await page.goto('/login');
    for (
      let i = 0;
      i < 3 && (await page.locator('html').getAttribute('data-theme-preference')) !== theme;
      i++
    )
      await page.getByRole('button', { name: /^ערכת נושא:/ }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/app/jobs?view=map&category=qa-automation',
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'חיפה ·', exact: false }).click();
    await expect(page.getByRole('button', { name: 'סגירת פרטי המיקום' })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.goto('/login');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
});
