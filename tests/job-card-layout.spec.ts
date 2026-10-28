import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';

const fixture = JSON.parse(readFileSync('tests/fixtures/qa-work-style-20261025.json', 'utf8'));
for (const theme of ['light', 'dark'] as const) {
  test(`job card hierarchy and actions in ${theme}`, async ({ page, context }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    await context.route('**/api/feed**', (r) =>
      r.fulfill({
        json: {
          jobs: fixture.jobs,
          total: 2,
          health: [],
          stale: false,
          nextCursor: null,
          fetchedAt: fixture.verifiedAt,
        },
      }),
    );
    await page.goto('/app/jobs?scope=all');
    const cards = page.locator('niva-job-card');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('h1').click();
    const path = `docs/screenshots/changes/job-card-layout/${info.project.name}-${theme}`;
    if (process.env['CARD_BEFORE']) {
      await page.locator('.jobs-grid').screenshot({ path: `${path}-before.png` });
      return;
    }
    for (const card of await cards.all()) {
      await expect(card.locator('.job-source-details')).not.toHaveAttribute('open');
      const apply = card.locator('.job-apply');
      await expect(apply).toHaveAttribute('target', '_blank');
      await expect(apply).toHaveAttribute('href', /^\/api\/apply\//);
      await expect(apply).toHaveAccessibleName(/פתיחת המשרה והגשה באתר המקור \(חלון חדש\)/);
      await expect(card.locator('.job-meta bdi').first()).toBeVisible();
    }
    if (info.project.name === 'desktop') {
      const boxes = await cards.locator('.job-apply').all();
      const [a, b] = await Promise.all(boxes.map((link) => link.boundingBox()));
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.jobs-grid').screenshot({ path: `${path}-after.png` });
    await cards.first().locator('.job-source-details summary').click();
    await expect(cards.first().locator('.job-source-details time')).toBeVisible();
    await cards.first().locator('.job-source-details summary').click();
    await cards.first().locator('.match-panel summary').click();
    await expect(cards.first().locator('.match-panel')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
