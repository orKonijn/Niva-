import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import {
  benchmarkCandidate,
  benchmarkPreferences,
  relevanceBenchmarkJobs,
} from './relevance-benchmark-data';
import { discoveryRank } from '../src/app/core/discovery-ranking';

test('relevance reasons and talent-pool disclosure', async ({ page, context }, info) => {
  await reviewFixture(context);
  const state = emptyAccountState();
  state.theme = 'light';
  state.profile.criteria = benchmarkCandidate;
  state.preferences = benchmarkPreferences;
  state.setupCompleted = true;
  await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
  const all = relevanceBenchmarkJobs('development');
  const jobs = [all[0].job, all[5].job].sort(
    (a, b) =>
      discoveryRank(b, '', benchmarkPreferences, benchmarkCandidate).rank -
      discoveryRank(a, '', benchmarkPreferences, benchmarkCandidate).rank,
  );
  await context.route('**/api/feed**', (r) =>
    r.fulfill({
      json: {
        jobs,
        total: jobs.length,
        nextCursor: null,
        snapshot: 'synthetic-relevance',
        health: [],
        stale: false,
      },
    }),
  );
  await page.goto('/app/jobs?scope=all&sort=relevance');
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  const before = process.env['NIVA_RELEVANCE_BEFORE'] === '1';
  await page.screenshot({
    path: `docs/screenshots/changes/relevance/${info.project.name}-${before ? 'before' : 'after'}.png`,
    fullPage: true,
  });
  if (before) return;
  await expect(page.locator('niva-job-card').first()).toContainText('Customer Platform');
  await expect(
    page.getByText('מאגר מועמדים · לא משרה פתוחה מאומתת', { exact: true }),
  ).toBeVisible();
  await page
    .locator('niva-job-card')
    .first()
    .getByText('למה כדאי לבדוק את התוצאה?', { exact: true })
    .click();
  await expect(page.getByText(/עדות בפרופיל המאושר/).first()).toBeVisible();
  await page
    .locator('niva-job-card')
    .first()
    .screenshot({
      path: `docs/screenshots/changes/relevance/${info.project.name}-lead-detail.png`,
      scale: 'css',
    });
  await page
    .locator('niva-job-card')
    .last()
    .screenshot({
      path: `docs/screenshots/changes/relevance/${info.project.name}-pool-detail.png`,
      scale: 'css',
    });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
