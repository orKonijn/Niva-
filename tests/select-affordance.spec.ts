import { test, expect, type Page } from '@playwright/test';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';

async function checkSelects(page: Page) {
  const styles = await page
    .locator('select:not([multiple]):not([size]),select[size="1"]:not([multiple])')
    .evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        return {
          appearance: style.appearance,
          paddingEnd: style.paddingInlineEnd,
          image: style.backgroundImage,
          position: style.backgroundPosition,
          size: style.backgroundSize,
        };
      }),
    );
  expect(styles.length).toBeGreaterThan(0);
  for (const style of styles) {
    expect(style.appearance).toBe('none');
    expect(style.paddingEnd).toBe('44px');
    expect(style.image).toContain('data:image/svg+xml');
    expect(style.position).toBe('16px 50%');
    expect(style.size).toBe('12px 12px');
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`dropdown arrow inset across account screens in ${theme}`, async ({
    page,
    context,
  }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.setupCompleted = true;
    state.preferences.district = 'tel-aviv';
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const route of ['/app/preferences', '/app/profile', '/app/jobs']) {
      await page.goto(route);
      await expect(page.locator('select').first()).toBeVisible();
      if (route === '/app/preferences') {
        await page.evaluate(() => document.fonts.ready);
        await page
          .locator('select[name=district]')
          .locator('..')
          .screenshot({
            path: `docs/screenshots/changes/select-arrow-${info.project.name}-${theme}/${process.env['SELECT_ARROW_BEFORE'] ? 'before' : 'after'}.png`,
          });
      }
      if (process.env['SELECT_ARROW_BEFORE']) continue;
      await checkSelects(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  });
}

test('dropdown styling preserves native keyboard selection in onboarding', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await page.goto('/signup');
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  const district = page.getByLabel('מחוז מועדף');
  await expect(district).toBeVisible();
  await checkSelects(page);
  await district.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(district).toHaveValue('north');
  await district.evaluate((el) => el.setAttribute('dir', 'ltr'));
  const ltr = await district.evaluate((el) => ({
    padding: getComputedStyle(el).paddingInlineEnd,
    position: getComputedStyle(el).backgroundPosition,
  }));
  expect(ltr.padding).toBe('44px');
  expect(ltr.position).toContain('100%');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(district).toHaveCSS('appearance', 'auto');
  await expect(district).toHaveCSS('background-image', 'none');
});
