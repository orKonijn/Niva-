import { test, expect } from '@playwright/test';
import { reviewFixture, reviewJobs } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';

for (const theme of ['light', 'dark'] as const) {
  test(`visits, reloads and explicit refresh check employers in ${theme}`, async ({
    context,
    page,
  }, info) => {
    await reviewFixture(context, true);
    const state = emptyAccountState();
    state.theme = theme;
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    let checks = 0;
    await context.route('**/api/feed**', (r) => {
      if (new URL(r.request().url()).searchParams.get('refresh') === '1') checks++;
      return r.fulfill({
        json: {
          jobs: [{ ...reviewJobs[0], title: `משרת בדיקה ${Math.max(1, checks)}` }],
          total: 1,
          nextCursor: null,
          snapshot: `check-${checks}`,
          stale: false,
          fetchedAt: '2026-10-25T16:00:00Z',
          health: [],
        },
      });
    });
    await page.goto('/app/jobs');
    await expect(page.locator('niva-job-card')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const directory = `docs/screenshots/changes/visit-refresh-${info.project.name}-${theme}`;
    if (process.env['VISIT_BEFORE']) {
      await page.screenshot({ path: `${directory}/before.png`, fullPage: true });
      return;
    }
    expect(checks).toBe(1);
    await expect(page.getByRole('button', { name: 'רענון משרות', exact: true })).toBeEnabled();
    await page.screenshot({ path: `${directory}/after.png`, fullPage: true });
    await page.getByRole('button', { name: 'רענון משרות', exact: true }).click();
    await expect(page.locator('niva-job-card')).toContainText('משרת בדיקה 2');
    expect(checks).toBe(2);
    await page.getByRole('textbox', { name: 'חיפוש תפקיד או חברה' }).fill('בדיקה');
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole('button', { name: 'רענון משרות', exact: true })).toBeEnabled();
    expect(checks).toBe(2);
    await page.reload();
    await expect(page.locator('niva-job-card')).toContainText('משרת בדיקה 3');
    expect(checks).toBe(3);
    await page.goto('/');
    await expect.poll(() => checks).toBe(4);
  });
}

test('loading waits for employer checks and reports failure without a false empty result', async ({
  context,
  page,
}) => {
  await reviewFixture(context, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/feed**', async (r) => {
    await gate;
    return r.fulfill({ status: 503, json: { error: 'SOURCE_REFRESH_TIMEOUT' } });
  });
  await page.goto('/app/jobs');
  await expect(page.getByRole('status').filter({ hasText: 'מחפשים משרות עדכניות' })).toBeVisible();
  await expect(page.getByText('עדיין לא מצאנו כאן התאמה', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'בודקים עדכונים…' })).toBeDisabled();
  release();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'רענון משרות', exact: true })).toBeEnabled();
});
