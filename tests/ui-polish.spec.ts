import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`polished app surfaces remain accessible in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
    for (const path of ['/app', '/app/jobs', '/login']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  });
}

test('section entrances run once and all motion stops with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await page.goto('/');
  await page.locator('.steps-grid').scrollIntoViewIfNeeded();
  await expect(page.locator('.steps-grid')).toHaveClass(/niva-revealed/);
  expect(
    await page.evaluate(() =>
      document
        .getAnimations()
        .every((animation) => animation.effect?.getTiming().iterations !== Infinity),
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const selector of [
    '.step-card',
    '.hero-copy',
    '.mascot-frame',
    '.hero-spark',
    '.control-section',
  ]) {
    await expect(page.locator(selector).first()).toHaveCSS('animation-name', 'none');
  }
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await expect(page.locator('.step-mascot').first()).toBeVisible();
});
