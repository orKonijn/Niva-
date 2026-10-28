import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture, reviewResume } from './ui-review-fixture';

test('resume Save explains invalid drafts, preserves failed input and saves a corrected draft', async ({
  page,
  context,
}, info) => {
  const data = await reviewFixture(context, true);
  let writes = 0;
  await context.route('**/api/career/resumes', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes++;
    if (writes === 1)
      return route.fulfill({
        status: 503,
        contentType: 'text/html',
        body: '<h1>Service temporarily unavailable</h1>',
      });
    const body = route.request().postDataJSON();
    const resume = {
      ...reviewResume,
      id: 'synthetic-save-check',
      name: body.name,
      text: body.text.trim(),
      confirmed: false,
      active: false,
    };
    data.resumes.push(resume);
    return route.fulfill({ status: 201, json: resume });
  });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/app/resumes');
  const input = page.getByLabel('טקסט קורות החיים', { exact: true });
  const save = page.getByRole('button', { name: 'שמירת טיוטה לבדיקה', exact: true });
  await input.fill('dddd');
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  const before = process.env['NIVA_SAVE_BEFORE'] === '1';
  await page.locator('.resume-create').screenshot({
    path: `docs/screenshots/changes/resume-save/${info.project.name}-${before ? 'before' : 'after'}.png`,
  });
  if (before) {
    await expect(save).toBeDisabled();
    return;
  }
  await expect(save).toBeEnabled();
  await expect(input).toHaveAccessibleDescription(/20–30,000.*4 תווים/);
  await save.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('לפחות 20');
  await page.locator('.resume-create').screenshot({
    path: `docs/screenshots/changes/resume-save/${info.project.name}-validation.png`,
  });
  expect(writes).toBe(0);
  await input.fill('   ' + 'a'.repeat(19) + '   ');
  await save.click();
  expect(writes).toBe(0);
  await input.fill('a'.repeat(20));
  await page.getByLabel('שם הגרסה', { exact: true }).fill('   ');
  await save.click();
  await expect(page.getByLabel('שם הגרסה', { exact: true })).toBeFocused();
  expect(writes).toBe(0);
  await page.getByLabel('שם הגרסה', { exact: true }).fill('Synthetic save validation');
  await save.click();
  await expect(page.getByRole('alert')).toContainText('אפשר לנסות שוב');
  await expect(input).toHaveValue('a'.repeat(20));
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('status')).toContainText('הטיוטה נשמרה');
  await expect(page.getByRole('heading', { name: /בדיקת הגרסה/ })).toBeVisible();
  await expect(input).toHaveValue('');
  await input.fill('Next synthetic draft');
  await expect(page.locator('.resume-create')).toHaveAttribute('open');
  await expect(input).toBeVisible();
  await input.fill('');
  await page.reload();
  await page.getByRole('button', { name: 'Synthetic save validation', exact: true }).click();
  await expect(page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true })).toHaveValue('a'.repeat(20));
  expect(writes).toBe(2);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
