import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function setTheme(page: import('@playwright/test').Page, value: string): Promise<void> {
  for (
    let i = 0;
    i < 3 && (await page.locator('html').getAttribute('data-theme-preference')) !== value;
    i++
  ) {
    await page
      .getByRole('button', { name: /^ערכת נושא:/ })
      .filter({ visible: true })
      .first()
      .click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', value);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
});

test('district and category combine with multiple work styles, and zero styles means all', async ({
  page,
}) => {
  await page.goto('/app/preferences');
  await page.getByLabel('תחום שמעניין אותך').selectOption('qa-automation');
  await page.getByLabel('מחוז מועדף').selectOption('haifa');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
  await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).check();
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByRole('status')).toContainText('1 משרות');
  await page.reload();
  await expect(page.getByLabel('מחוז מועדף')).toHaveValue('haifa');
  await expect(page.getByRole('checkbox', { name: 'היברידי', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'מרחוק', exact: true })).toBeChecked();
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('QA Automation Engineer');
  await page.goto('/app/preferences');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).uncheck();
  await page.getByLabel('תחום שמעניין אותך').selectOption('all');
  await page.getByLabel('מחוז מועדף').selectOption('all');
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByRole('status')).toContainText('11 משרות');
  await expect(
    page.getByText('אם לא בוחרים, אין סינון לפי אופן העבודה.', { exact: false }),
  ).toBeVisible();
});

test('onboarding shares the multi-select and describes district, category and styles in its summary', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await page.getByLabel('תחום שמעניין אותך').selectOption('workflow-automation');
  await page.getByLabel('מחוז מועדף').selectOption('central');
  const hybrid = page.getByRole('checkbox', { name: 'היברידי', exact: true });
  await hybrid.focus();
  await page.keyboard.press('Space');
  await expect(hybrid).toBeChecked();
  await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).check();
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await expect(page.locator('.summary-card')).toContainText('מחוז המרכז');
  await expect(page.locator('.summary-card')).toContainText('היברידי / מרחוק');
  await expect(page.locator('.summary-card')).toContainText('אוטומציית תהליכים ואינטגרציות');
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.getByRole('button', { name: 'לסביבה האישית שלי' }).click();
  await page.locator('.welcome-panel a').click();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('Workflow Automation Specialist');
});

test('existing persisted state migrates without losing saved jobs, approvals, exclusions or pause', async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'niva.demo.v1',
      JSON.stringify({
        preferences: {
          role: 'engineering',
          location: 'הרצליה',
          model: 'היברידי',
          exclusions: 'Forma',
        },
        saved: ['ux-designer'],
        applications: [{ jobId: 'product-designer', approvedAt: '2026-10-23T10:00:00.000Z' }],
        paused: true,
      }),
    ),
  );
  await page.goto('/app/preferences');
  await expect(page.getByLabel('מחוז מועדף')).toHaveValue('tel-aviv');
  await expect(page.getByRole('checkbox', { name: 'היברידי', exact: true })).toBeChecked();
  await expect(page.getByLabel('חברות שעדיף לא להציג', { exact: false })).toHaveValue('Forma');
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByText('ההעדפות נשמרו.', { exact: false })).toBeVisible();
  const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('niva.demo.v1') ?? '{}'));
  expect(raw).toMatchObject({
    version: 2,
    saved: ['ux-designer'],
    paused: true,
    applications: [{ jobId: 'product-designer', approvedAt: '2026-10-23T10:00:00.000Z' }],
  });
  expect(raw.preferences).toEqual({
    role: 'engineering',
    district: 'tel-aviv',
    workStyles: ['hybrid'],
    exclusions: 'Forma',
  });
  await page.goto('/app/jobs?saved=true');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('מחוץ להעדפות');
  await page.goto('/app/profile');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת נתוני ההדגמה' }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString()).preferences).toEqual(raw.preferences);
});

test('legacy model URL becomes canonical while district/category filters remain transient', async ({
  page,
}) => {
  await page.goto('/app/jobs?model=' + encodeURIComponent('היברידי'));
  await expect(page).toHaveURL(/styles=hybrid/);
  await expect(page).not.toHaveURL(/model=/);
  await page.getByRole('combobox', { name: 'סינון לפי מחוז', exact: true }).selectOption('haifa');
  await page
    .getByRole('combobox', { name: 'סינון לפי תחום', exact: true })
    .selectOption('qa-automation');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'היברידי', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'סינון לפי מחוז', exact: true })).toHaveValue(
    'haifa',
  );
  await page.goto('/app/preferences');
  await expect(page.getByLabel('מחוז מועדף')).toHaveValue('all');
  await expect(page.getByLabel('תחום שמעניין אותך')).toHaveValue('all');
});

test('theme initialization applies saved dark before the Angular bundle runs', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('niva.theme', 'dark'));
  await page.route('**/main-*.js', (route) => route.abort());
  await page.goto('/app/preferences');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.style.backgroundColor)).toBe(
    'rgb(14, 23, 39)',
  );
  expect(await page.locator('app-root').innerHTML()).toBe('');
});

test('System follows the OS; explicit choices persist, synchronize tabs and survive demo reset', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await setTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
  const second = await context.newPage();
  await second.goto('/app');
  await setTheme(page, 'dark');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'איפוס נתוני ההדגמה', exact: true }).click();
  await page.getByRole('button', { name: 'כן, איפוס הנתונים' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נמחקו' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await second.close();
});

test('both themes cover routes, responsive forms and modal navigation with accessible contrast', async ({
  page,
}, info) => {
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of [
        '/',
        '/signup',
        '/app/preferences',
        '/app/jobs',
        '/app/profile',
        '/app/applications',
        '/privacy',
      ]) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${theme} ${width} ${route}`,
        ).toBe(true);
      }
    }
    for (const route of ['/app/preferences', '/app/jobs', '/signup', '/']) {
      await page.goto(route);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
        `${theme} ${route}`,
      ).toEqual([]);
    }
    await page.goto('/app/preferences');
    await page.getByLabel('תחום שמעניין אותך').selectOption('workflow-automation');
    await page.getByLabel('מחוז מועדף').selectOption('central');
    await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
    await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).check();
    await page.screenshot({
      path: `test-results/preferences-${theme}-${info.project.name}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.setViewportSize({ width: 390, height: 800 });
    await page.screenshot({
      path: `test-results/preferences-${theme}-phone-${info.project.name}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 568 });
    await page.goto('/app');
    const trigger = page.getByRole('button', { name: 'פתיחת תפריט', exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/drawer-${theme}-${info.project.name}.png` });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});
