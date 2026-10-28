import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { CandidateCriteria } from '../src/app/core/models/discovery';

for (const theme of ['light', 'dark'] as const) {
  test(`candidate form groups and controls in ${theme}`, async ({ context, page }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.setupCompleted = true;
    const writes: CandidateCriteria[] = [];
    await context.route('**/api/account/state', (route) => {
      if (route.request().method() === 'POST') {
        const { operation } = route.request().postDataJSON();
        expect(operation.type).toBe('criteria');
        writes.push(operation.value);
        state.profile.criteria = operation.value;
        state.revision++;
      }
      return route.fulfill({ json: state });
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/app/profile');
    const profile = page.getByRole('region', { name: 'פרטים לבדיקת התאמה' });
    await expect(profile).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await profile.screenshot({
      path: `docs/screenshots/changes/candidate-layout-${info.project.name}-${theme}/${process.env['CANDIDATE_LAYOUT_BEFORE'] ? 'before' : 'after'}.png`,
    });
    if (process.env['CANDIDATE_LAYOUT_BEFORE']) return;
    await expect(profile.getByRole('group')).toHaveCount(3);
    await expect(profile.locator('input:not([type=checkbox]),select')).toHaveCount(17);
    const save = profile.getByRole('button', { name: 'שמירת פרטים לבדיקת התאמה' });
    await expect(save).toBeDisabled();
    await profile.getByRole('checkbox', { name: 'בדקתי ומאשר/ת את הפרטים האלה' }).check();
    await expect(save).toBeEnabled();
    await expect(profile.getByRole('combobox', { name: /^אישור עבודה במדינה שצוינה/ })).toHaveValue(
      'unknown',
    );
    await expect(profile.getByRole('combobox', { name: /^אזרחות במדינה שצוינה/ })).toHaveValue(
      'unknown',
    );
    for (const width of [320, 700, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
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
    await profile.getByLabel('כישורים', { exact: false }).fill('Python, SQL');
    await profile.getByLabel('שנות ניסיון רלוונטי', { exact: true }).fill('3');
    await profile.getByLabel('מדינה נוכחית', { exact: true }).fill('il');
    await profile.getByLabel('מטבע', { exact: false }).fill('ils');
    await save.click();
    await expect(profile.getByRole('status')).toHaveText('הפרטים נשמרו. ההתאמות חושבו מחדש.');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      skills: ['Python', 'SQL'],
      yearsExperience: 3,
      currentCountry: 'IL',
      currency: 'ILS',
      workAuthorization: 'unknown',
      citizenshipStatus: 'unknown',
      authorizationExclusive: false,
      confirmed: true,
    });
    await page.reload();
    await expect(profile.getByLabel('שנות ניסיון רלוונטי', { exact: true })).toHaveValue('3');
    await expect(profile.getByLabel('מדינה נוכחית', { exact: true })).toHaveValue('IL');
    await expect(save).toBeDisabled();
  });
}
