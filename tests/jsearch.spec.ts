import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
const base = JSON.parse(readFileSync('tests/fixtures/qa-coverage-20261025.json', 'utf8'));
const fixture = JSON.parse(readFileSync('tests/fixtures/jsearch-public-20261025.json', 'utf8'));
for (const theme of ['light', 'dark'])
  test(`publisher jobs inside Niva in ${theme}`, async ({ page, context }, info) => {
    await reviewFixture(context, true);
    const state = emptyAccountState();
    state.theme = theme as 'light' | 'dark';
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    await context.route('**/api/feed**', (r) => {
      const provider = new URL(r.request().url()).searchParams.get('provider');
      const jobs = [...base.jobs, ...fixture.jobs].filter(
        (j) =>
          !provider ||
          (provider === 'jsearch'
            ? j.source.sourceId.startsWith('jsearch-')
            : j.source.sourceId === provider),
      );
      return r.fulfill({
        json: {
          jobs,
          total: jobs.length,
          health: ['linkedin', 'indeed'].map((p) => ({
            id: `jsearch-${p}`,
            name: `${p === 'linkedin' ? 'LinkedIn' : 'Indeed'} · JSearch`,
            checked_at: fixture.at,
            error: null,
            next_at: Date.now() + 86400000,
            partial: true,
          })),
          stale: false,
          fetchedAt: fixture.at,
          snapshot: 'publisher-proof',
          nextCursor: null,
        },
      });
    });
    await page.goto('/app/jobs');
    await expect(page.locator('niva-job-card')).toHaveCount(14);
    await expect(
      page.getByRole('status').filter({ hasText: 'משרות מ־LinkedIn ומ־Indeed' }),
    ).toBeVisible();
    for (const job of fixture.jobs)
      await expect(page.getByRole('heading', { name: job.title, exact: true })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    const dir = `docs/screenshots/changes/jsearch-${info.project.name}-${theme}`;
    await page
      .locator('section[aria-label="חיפוש באתרי משרות נוספים"]')
      .screenshot({ path: `${dir}/after.png` });
    await page
      .getByRole('button', { name: 'משרות LinkedIn ו־Indeed כאן באתר', exact: true })
      .click();
    await expect(page.locator('niva-job-card')).toHaveCount(4);
    await page.getByText('זכאות, מקור וסינון נוסף', { exact: true }).click();
    await page.getByRole('combobox', { name: /^מקור/ }).selectOption('jsearch-indeed');
    await expect(page.locator('niva-job-card')).toHaveCount(2);
    await expect(
      page.getByRole('heading', { name: fixture.jobs[2].title, exact: true }),
    ).toBeVisible();
    await page
      .locator('niva-job-card')
      .first()
      .screenshot({ path: `${dir}/indeed-card.png` });
    await page.reload();
    await expect(page.locator('niva-job-card')).toHaveCount(2);
    await page.getByText('זכאות, מקור וסינון נוסף', { exact: true }).click();
    await expect(page.getByRole('combobox', { name: /^מקור/ })).toHaveValue('jsearch-indeed');
  });
