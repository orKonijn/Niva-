import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyAccountState } from '../src/app/core/models/account-state';
const job = {
  id: 'greenhouse-appsflyer-123',
  title: 'Pilot API fixture — Data Engineer',
  company: 'AppsFlyer',
  initials: 'AF',
  color: '#e4f1fa',
  district: 'tel-aviv',
  workStyle: 'unknown',
  category: 'data-analytics',
  posted: 'עודכן במקור: 2026-10-20',
  description: 'A provider response fixture, not a verified external listing.',
  skills: [],
  reason: 'מקור: AppsFlyer / Greenhouse. סיווג לפי כותרת בלבד.',
  offices: [
    {
      id: 'herzliya-city',
      country: 'IL',
      district: 'tel-aviv',
      city: 'הרצליה',
      latitude: 32.16627,
      longitude: 34.82536,
      precision: 'city',
      demonstration: false,
      coordinateSource: 'https://www.geonames.org/294778/herzliya.html',
    },
  ],
  source: {
    kind: 'real',
    name: 'AppsFlyer / Greenhouse',
    url: 'https://careers.appsflyer.com/',
    applicationUrl: 'https://careers.appsflyer.com/jobs/position/123',
    updatedAt: '2026-10-20T00:00:00Z',
    fetchedAt: '2026-10-24T00:00:00Z',
    location: 'Herzliya',
    classification: 'סיווג לפי כותרת',
    active: true,
  },
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
});
test('hosted normal experience defaults to source jobs and keeps legacy demo data out of the main flow', async ({
  page,
}) => {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        accounts: true,
        platform: 'sites',
        realJobs: true,
        email: false,
        google: false,
        apple: false,
      },
    }),
  );
  await page.route('**/api/session', (r) =>
    r.fulfill({
      json: {
        user: {
          id: 'sites:fixture',
          name: 'בדיקה',
          email: 'fixture@example.test',
          emailVerified: true,
        },
      },
    }),
  );
  await page.route('**/api/account/state', (r) => r.fulfill({ json: emptyAccountState() }));
  await page.route('**/api/account/methods', (r) => r.fulfill({ json: { methods: ['chatgpt'] } }));
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ json: { jobs: [job], fetchedAt: job.source.fetchedAt, stale: false } }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'מתחילים לחפש עבודה', exact: false }),
  ).toHaveAttribute('href', '/login');
  await page.goto('/app');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'ההגשות שלי', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'השהיית פעילות', exact: true })).toHaveCount(0);
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'נתוני הדגמה', exact: true })).toHaveCount(0);
  await expect(page.getByText(/פיילוט|גרסת פיתוח/)).toHaveCount(0);
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'המשך לחשבון שלי' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'המשך עם Google' })).toHaveCount(0);
  await page.goto('/account');
  await page.locator('summary').filter({ hasText: 'נתונים קודמים מהמכשיר' }).click();
  await expect(page.getByRole('heading', { name: 'ייבוא חד־פעמי מההדגמה במכשיר' })).toBeVisible();
});
test('production layout loads under the hosted script CSP without inline stylesheet activation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ json: { jobs: [job], fetchedAt: job.source.fetchedAt, stale: false } }),
  );
  await page.route('**/app/jobs?source=real', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': "script-src 'self'; style-src 'self' 'unsafe-inline'",
      },
    });
  });
  await page.goto('/app/jobs?source=real');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('.job-card')).toHaveCSS('border-radius', '18px');
  await expect(page.locator('.workspace')).toHaveCSS(
    'display',
    page.viewportSize()!.width <= 768 ? 'block' : 'grid',
  );
  expect(
    await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.every((link) => (link as HTMLLinkElement).media !== 'print')),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('real-feed UI boundary fixture remains separate from demo, preserves unknown style and original link', async ({
  page,
}, info) => {
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ json: { jobs: [job], fetchedAt: job.source.fetchedAt, stale: false } }),
  );
  await page.goto('/app/jobs?source=real');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('משרה אמיתית');
  await expect(page.locator('niva-job-card')).toContainText('סגנון עבודה לא נמסר');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
  await expect(page.locator('niva-job-card')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).uncheck();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'שמירת המשרה', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'לשמירת משרות אמיתיות' })).toBeVisible();
  await page.getByRole('link', { name: job.title, exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'פתיחת המשרה והגשה באתר המקור (חלון חדש)' }),
  ).toHaveAttribute('href', job.source.applicationUrl);
  await expect(page.getByText('פתיחת הקישור אינה הגשת מועמדות.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'אישור' })).toHaveCount(0);
  await page.goto('/app/jobs?source=demo');
  await expect(page.locator('niva-job-card')).toHaveCount(11);
  await page.goto('/app/jobs?source=real');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.screenshot({
    path: `test-results/pilot-jobs-${info.project.name}.png`,
    fullPage: true,
  });
});
test('forms validate after interaction, retain failed values, and protect unsaved edits', async ({
  page,
}, info) => {
  await page.goto('/register');
  await expect(page.locator('.field-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await expect(page.locator('.field-error')).toHaveCount(3);
  await page.getByLabel('שם להצגה').fill('נועה');
  await page.getByLabel('כתובת דוא״ל').fill('name@example.test');
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill('A-long-test-password-2026');
  await page.route('**/api/auth/sign-up/email', (r) =>
    r.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }),
  );
  await page.getByRole('button', { name: 'יצירת חשבון', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('לא ניתן');
  await expect(page.getByLabel('כתובת דוא״ל')).toHaveValue('name@example.test');
  await page.goto('/app/preferences');
  await page.getByLabel('תחום שמעניין אותך').selectOption('qa-manual');
  page.once('dialog', (d) => d.dismiss());
  const menu = page.getByRole('button', { name: 'פתיחת תפריט' });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole('link', { name: 'הפרופיל שלי', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/preferences$/);
  if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'שמירת ההעדפות', exact: false }).click();
  await expect(page.getByRole('status')).toContainText('ההעדפות נשמרו');
  await page.screenshot({
    path: `test-results/pilot-preferences-${info.project.name}.png`,
    fullPage: true,
  });
});
test('hosted identity configuration offers a top-level real sign-in path and no pretend email form', async ({
  page,
}, info) => {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        accounts: true,
        platform: 'sites',
        realJobs: true,
        email: false,
        google: false,
        apple: false,
      },
    }),
  );
  await page.route('**/api/session', (r) => r.fulfill({ json: { user: null } }));
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ json: { jobs: [job], fetchedAt: job.source.fetchedAt, stale: false } }),
  );
  await page.goto('/login?returnTo=%2Fapp%2Fprofile');
  await expect(page.getByRole('link', { name: 'המשך עם ChatGPT' })).toHaveAttribute(
    'href',
    '/signin-with-chatgpt?return_to=%2Fapp%2Fprofile',
  );
  await expect(page.getByRole('link', { name: 'המשך עם ChatGPT' })).toHaveAttribute(
    'target',
    '_top',
  );
  await expect(page.getByLabel('סיסמה ל־Niva', { exact: true })).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/pilot-login-${info.project.name}.png`,
    fullPage: true,
  });
});
test('real-feed failure gives a retry and does not substitute demo results', async ({ page }) => {
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ status: 503, json: { error: 'FEED_UNAVAILABLE' } }),
  );
  await page.goto('/app/jobs?source=real');
  await expect(page.getByRole('alert')).toContainText('לא ניתן לרענן');
  await expect(page.locator('niva-job-card')).toHaveCount(0);
  await page.unroute('**/api/jobs');
  await page.route('**/api/jobs', (r) =>
    r.fulfill({ json: { jobs: [job], fetchedAt: job.source.fetchedAt, stale: true } }),
  );
  await page.getByRole('button', { name: 'רענון משרות' }).click();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.getByText('מוצג עותק קודם', { exact: false })).toBeVisible();
});
