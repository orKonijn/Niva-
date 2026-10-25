import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`mascot artwork loads without overflow in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('.step-mascot')).toHaveCount(3);
    await expect(page.locator('.step-mascot').first()).toHaveCSS(
      'background-color',
      colorScheme === 'dark' ? 'rgb(14, 23, 39)' : 'rgb(247, 250, 255)',
    );
    for (const img of await page.locator('.step-mascot').all()) {
      await expect
        .poll(() =>
          img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
        )
        .toBe(true);
    }
    await page.locator('.cta-mascot').scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator('.cta-mascot')
          .evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
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
  });
}

test('mascot motion respects reduced motion and settles without hiding content', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const art = page.locator('.mascot-frame');
  await expect(art).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(art).toHaveCSS('animation-name', 'niva-greet');
  await expect(art).toHaveCSS('animation-iteration-count', '1');
  await expect(art).toHaveCSS('animation-duration', '4s');
});
