import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
const snapshot = JSON.parse(readFileSync('tests/fixtures/public-jobs-20261025.json', 'utf8'));
for (const theme of ['light', 'dark'] as const) {
  test(`real public listing evidence in ${theme}`, async ({ context, page }, info) => {
    await reviewFixture(context, true);
    await context.route('**/api/feed**', (r) =>
      r.fulfill({
        json: {
          jobs: snapshot.jobs,
          total: 2,
          health: [],
          stale: false,
          fetchedAt: snapshot.verifiedAt,
          snapshot: 'real-baseline',
          nextCursor: null,
        },
      }),
    );
    await context.route('**/api/account/state', (r) =>
      r.fulfill({
        json: {
          revision: 0,
          profile: { name: '', headline: '' },
          preferences: { role: 'all', district: 'all', workStyles: [], exclusions: '' },
          saved: [],
          applications: [],
          paused: false,
          theme,
          importedAt: null,
        },
      }),
    );
    await page.goto('/app/jobs');
    await expect(page.locator('niva-job-card')).toHaveCount(2);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const directory = `docs/screenshots/changes/discovery-trust-${info.project.name}-${theme}`;
    if (process.env['DISCOVERY_BEFORE']) {
      await page.screenshot({ path: `${directory}/before.png`, fullPage: true });
      return;
    }
    await expect(page.getByText('אין מספיק מידע', { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: `${directory}/after.png`, fullPage: true });
    await page.goto('/app/profile');
    await expect(page.getByRole('region', { name: 'פרטים לבדיקת התאמה' })).toBeVisible();
    await page.screenshot({ path: `${directory}/profile-after.png`, fullPage: true });
  });
}
