import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { Preferences } from '../src/app/core/preferences';

for (const theme of ['light', 'dark'] as const) {
  test(`search preferences layout and saving in ${theme}`, async ({ page, context }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.setupCompleted = true;
    state.preferences = {
      role: 'qa-automation',
      district: 'tel-aviv',
      workStyles: ['onsite', 'hybrid', 'remote'],
      exclusions: '',
    };
    const writes: Preferences[] = [];
    await context.route('**/api/account/state', (route) => {
      if (route.request().method() === 'POST') {
        const { operation } = route.request().postDataJSON();
        expect(operation.type).toBe('preferences');
        writes.push(operation.value);
        state.preferences = operation.value;
        state.revision++;
      }
      return route.fulfill({ json: state });
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/app/preferences');
    const form = page
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'שמירת ההעדפות', exact: true }) });
    await expect(form.getByRole('checkbox', { name: 'מרחוק', exact: true })).toBeChecked();
    await page.evaluate(() => document.fonts.ready);
    await form.screenshot({
      path: `docs/screenshots/changes/preferences-layout-${info.project.name}-${theme}/${process.env['PREFERENCES_LAYOUT_BEFORE'] ? 'before' : 'after'}.png`,
    });
    if (process.env['PREFERENCES_LAYOUT_BEFORE']) return;
    for (const width of [320, 700, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      for (const label of await form.locator('.work-style-options label').all()) {
        const box = await label.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await form.getByLabel('תחום שמעניין אותך').selectOption('design');
    await form.getByLabel('מחוז מועדף').selectOption('haifa');
    for (const name of ['במשרד', 'היברידי', 'מרחוק'])
      await form.getByRole('checkbox', { name, exact: true }).uncheck();
    const hybrid = form.getByRole('checkbox', { name: 'היברידי', exact: true });
    await hybrid.focus();
    await page.keyboard.press('Space');
    await expect(hybrid).toBeChecked();
    await form.locator('input[name=exclusions]').fill('Synthetic Employer');
    await form.getByRole('button', { name: 'שמירת ההעדפות', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('ההעדפות נשמרו');
    expect(writes).toEqual([
      {
        role: 'design',
        district: 'haifa',
        workStyles: ['hybrid'],
        exclusions: 'Synthetic Employer',
      },
    ]);
    await page.reload();
    await expect(form.getByLabel('מחוז מועדף')).toHaveValue('haifa');
    await expect(hybrid).toBeChecked();
    await expect(form.locator('input[name=exclusions]')).toHaveValue('Synthetic Employer');
  });
}
