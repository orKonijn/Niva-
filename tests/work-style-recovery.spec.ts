import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
const fixture = JSON.parse(readFileSync('tests/fixtures/qa-work-style-20261025.json', 'utf8'));
for (const theme of ['light', 'dark'] as const) {
  test(`saved QA preferences retain unspecified work styles in ${theme}`, async ({
    context,
    page,
  }, info) => {
    await reviewFixture(context, true);
    const state = emptyAccountState();
    state.theme = theme;
    state.preferences = {
      role: 'qa-automation',
      district: 'tel-aviv',
      workStyles: ['onsite', 'hybrid', 'remote'],
      exclusions: '',
    };
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    await context.route('**/api/feed**', (r) => {
      const include = new URL(r.request().url()).searchParams.get('unknownStyle') === 'true';
      const jobs = include ? fixture.jobs : [];
      return r.fulfill({
        json: {
          jobs,
          total: jobs.length,
          health: [],
          stale: false,
          fetchedAt: fixture.verifiedAt,
          snapshot: 'real-qa-style',
          nextCursor: null,
          coverage: [
            {
              category: 'qa-automation',
              district: 'tel-aviv',
              style: 'unknown',
              n: fixture.jobs.length,
            },
          ],
        },
      });
    });
    await page.goto('/app/jobs');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const directory = `docs/screenshots/changes/unknown-style-recovery-${info.project.name}-${theme}`;
    if (process.env['FILTER_BEFORE']) {
      await expect(page.locator('niva-job-card')).toHaveCount(0);
      await page.screenshot({ path: `${directory}/before.png`, fullPage: true });
      return;
    }
    await expect(page.locator('niva-job-card')).toHaveCount(fixture.jobs.length);
    await expect(page.getByRole('region', { name: 'העדפות החיפוש ששמרת' })).toContainText(
      'אוטומציית בדיקות',
    );
    const include = page.getByRole('checkbox', { name: 'לכלול סגנון עבודה שלא נמסר' });
    await expect(include).toBeChecked();
    await expect(page.locator('niva-job-card').first()).toContainText('סגנון עבודה לא נמסר');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${directory}/after.png`, fullPage: true });
    await include.uncheck();
    await expect(page).toHaveURL(/unknownStyle=false/);
    await expect(page.locator('niva-job-card')).toHaveCount(0);
    await page.reload();
    await expect(include).not.toBeChecked();
    await expect(page.locator('niva-job-card')).toHaveCount(0);
    await include.check();
    await expect(page.locator('niva-job-card')).toHaveCount(fixture.jobs.length);
    await page.reload();
    await expect(page.locator('niva-job-card')).toHaveCount(fixture.jobs.length);
  });
}
