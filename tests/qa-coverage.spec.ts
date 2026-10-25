import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { SOURCES } from '../src/app/core/source-registry';
import { matchesPreferences } from '../src/app/core/preferences';
import type { Job } from '../src/app/core/models/job';
const fixture = JSON.parse(readFileSync('tests/fixtures/qa-coverage-20261025.json', 'utf8')) as {
  observedAt: string;
  jobs: Job[];
};
for (const theme of ['light', 'dark'] as const) {
  test(`verified QA coverage and explicit broadening in ${theme}`, async ({
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
    let accountWrites = 0;
    await context.route('**/api/account/state', (r) => {
      if (r.request().method() !== 'GET') accountWrites++;
      return r.fulfill({ json: state });
    });
    await context.route('**/api/feed**', (r) => {
      const p = new URL(r.request().url()).searchParams;
      const all = p.get('scope') === 'all';
      const preferences = {
        ...state.preferences,
        role: all || p.get('related') === 'true' ? ('all' as const) : state.preferences.role,
        district: all || p.get('area') === 'all' ? ('all' as const) : state.preferences.district,
      };
      const jobs = fixture.jobs.filter(
        (j) =>
          SOURCES.some((s) => j.id.startsWith(s.id + '-')) &&
          (all ||
            p.get('related') !== 'true' ||
            ['qa-manual', 'qa-automation'].includes(j.category)) &&
          matchesPreferences(j, preferences, p.get('unknownStyle') !== 'false'),
      );
      return r.fulfill({
        json: {
          jobs,
          total: jobs.length,
          health: [],
          stale: false,
          fetchedAt: fixture.observedAt,
          snapshot: 'real-qa-coverage',
          nextCursor: null,
        },
      });
    });
    await page.goto('/app/jobs');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const directory = `docs/screenshots/changes/qa-coverage-${info.project.name}-${theme}`;
    if (process.env['COVERAGE_BEFORE']) {
      await expect(page.locator('niva-job-card')).toHaveCount(2);
      await page.screenshot({ path: `${directory}/before.png`, fullPage: true });
      return;
    }
    await expect(page.locator('niva-job-card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'כל המשרות', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByRole('link', { name: 'חיפוש משרות ב־LinkedIn (אתר חיצוני)', exact: true }),
    ).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/jobs\/search\//);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `${directory}/after.png`, fullPage: true });
    await page.getByRole('button', { name: 'לפי ההעדפות שלי', exact: true }).click();
    await expect(page.locator('niva-job-card')).toHaveCount(4);
    await page
      .getByRole('button', { name: 'הרחבת המיקום לכל ישראל ולמשרות מרחוק', exact: true })
      .click();
    await expect(page.locator('niva-job-card')).toHaveCount(6);
    await expect(
      page.getByText('המיקום הורחב במפורש; זכאות לעבודה מרחוק עדיין דורשת בירור.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('checkbox', { name: 'לכלול גם תפקידי QA ידניים קרובים', exact: true })
      .check();
    await expect(page.locator('niva-job-card')).toHaveCount(8);
    await page.reload();
    await expect(page.locator('niva-job-card')).toHaveCount(8);
    await page.getByRole('button', { name: 'חזרה למחוז השמור', exact: true }).click();
    await expect(page.locator('niva-job-card')).toHaveCount(6);
    await page
      .getByRole('checkbox', { name: 'לכלול גם תפקידי QA ידניים קרובים', exact: true })
      .uncheck();
    await expect(page.locator('niva-job-card')).toHaveCount(4);
    expect(accountWrites).toBe(0);
  });
}
