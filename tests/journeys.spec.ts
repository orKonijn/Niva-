import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
});
test('homepage is accessible, has no horizontal overflow and explains demo scope', async ({
  page,
}, info) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('פחות חיפוש');
  await page.locator('summary').filter({ hasText: 'מה קורה לקורות החיים שלי?' }).click();
  await expect(page.getByText('בהדגמה נבדקים רק סוג הקובץ', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  // Start a fresh visit so accessibility probes do not leave focus in the screenshot.
  await page.goto('/');
  await page.screenshot({ path: `test-results/home-${info.project.name}.png`, fullPage: true });
});
test('onboarding can finish without a CV and preferences affect the job list', async ({ page }) => {
  await page.getByRole('link', { name: 'מתחילים עם קורות החיים', exact: true }).click();
  await page.getByLabel('איך לקרוא לך?', { exact: false }).fill('דנה');
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await page.getByLabel('תחום שמעניין אותך').selectOption('design');
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.getByRole('button', { name: 'לסביבה האישית שלי' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('דנה');
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(2);
});
test('review requires acknowledgement, persists once and supports pause', async ({
  page,
}, info) => {
  await page.goto('/app/jobs/product-designer');
  const approve = page.getByRole('button', { name: 'אישור בהדגמה', exact: true });
  await expect(approve).toBeDisabled();
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await approve.click();
  await expect(page.getByText('המשרה אושרה בהדגמה', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('המשרה אושרה בהדגמה', { exact: true })).toBeVisible();
  await page.goto('/app/applications');
  await expect(page.locator('.application-row')).toHaveCount(1);
  await page.goto('/app');
  await page.getByRole('button', { name: 'השהיית פעילות' }).click();
  await expect(page.getByRole('button', { name: 'חידוש הפעילות' })).toBeVisible();
  await page.goto('/app/jobs/frontend-engineer');
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await expect(page.getByRole('button', { name: 'אישור בהדגמה', exact: true })).toBeDisabled();
  await page.goto('/app');
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
});
test('search, saved jobs, exclusions, upload validation and reset work', async ({ page }) => {
  await page.goto('/app/jobs');
  await page.getByRole('textbox', { name: 'חיפוש תפקיד או חברה' }).fill('Forma');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'שמירת המשרה', exact: true }).click();
  await page.getByRole('button', { name: 'השמורות שלי', exact: false }).click();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.goto('/app/preferences');
  await page.getByLabel('חברות שעדיף לא להציג', { exact: false }).fill('Forma');
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByText('ההעדפות נשמרו.', { exact: false })).toBeVisible();
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(10);
  await page.goto('/app/profile');
  await page
    .getByLabel('בחירת קובץ קורות חיים', { exact: true })
    .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('example') });
  await expect(page.getByRole('alert')).toContainText('PDF או DOCX');
  await page.getByRole('button', { name: 'איפוס נתוני ההדגמה', exact: true }).click();
  await page.getByRole('button', { name: 'כן, איפוס הנתונים' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נמחקו' })).toBeVisible();
  await page.goto('/app/applications');
  await expect(page.getByText('כאן תתחיל הדרך שלך')).toBeVisible();
});
test('workspace review and setup pass automated accessibility checks', async ({ page }) => {
  for (const route of ['/app', '/signup', '/app/jobs/product-designer']) {
    await page.goto(route);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations, route).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    ).toBe(true);
  }
});
