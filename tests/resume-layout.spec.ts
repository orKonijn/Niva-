import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`resume versions and disclosures remain usable in ${colorScheme}`, async ({
    context,
    page,
  }, info) => {
    const data = await reviewFixture(context);
    data.resumes[0].name = 'Synthetic_Candidate_CV_senior.pdf';
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/app/resumes');
    await expect(page.getByRole('button', { name: data.resumes[0].name })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/changes/resume-layout-${info.project.name}-${colorScheme}/${process.env['RESUME_LAYOUT_BEFORE'] ? 'before' : 'after'}.png`,
      fullPage: true,
    });
    if (process.env['RESUME_LAYOUT_BEFORE']) return;
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const list = page.locator('.resume-library');
    const create = page.locator('.resume-create');
    const privacy = page.locator('.resume-privacy').first();
    const listBox = await list.boundingBox();
    const createBox = await create.boundingBox();
    const privacyBox = await privacy.boundingBox();
    expect(createBox!.y - (listBox!.y + listBox!.height)).toBeGreaterThanOrEqual(15);
    expect(privacyBox!.y - (createBox!.y + createBox!.height)).toBeGreaterThanOrEqual(15);
    await create.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'מתחילים מטקסט' })).toBeVisible();
    await privacy.locator('summary').first().click();
    await expect(page.getByRole('heading', { name: 'פרטיות ושליטה' })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: data.resumes[0].name }).click();
    await expect(page.getByRole('region', { name: 'בדיקה והשוואת גרסאות' })).toBeVisible();
    await page.getByRole('button', { name: 'מחיקת גרסה', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'ביטול', exact: true }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  });
}

test('resume library reflows maximum-length names and an empty library opens creation', async ({
  context,
  page,
}) => {
  const data = await reviewFixture(context);
  const original = structuredClone(data.resumes[0]);
  data.resumes = Array.from({ length: 20 }, (_, index) => ({
    ...original,
    id: `synthetic-${index}`,
    name: `${index}-` + 'Resume_Name'.repeat(10),
    active: index === 0,
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 700, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/resumes');
    await expect(page.locator('.career-version')).toHaveCount(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const name = page.getByRole('button', { name: data.resumes[0].name, exact: true });
    const bounds = await name.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await name.click();
    await expect(page.getByRole('region', { name: 'בדיקה והשוואת גרסאות' })).toBeVisible();
  }
  data.resumes = [];
  await page.goto('/app/resumes');
  await expect(page.locator('.resume-create')).toHaveAttribute('open');
  await expect(page.getByRole('heading', { name: 'מתחילים מטקסט' })).toBeVisible();
});
