import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture, reviewJobs } from './ui-review-fixture';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Hebrew copy stays readable across the main screens in ${colorScheme}`, async ({
    context,
    page,
  }, info) => {
    await reviewFixture(context, true);
    await context.route('**/api/feed?**', (r) =>
      r.fulfill({
        json: {
          jobs: [reviewJobs[0]],
          total: 1,
          nextCursor: null,
          snapshot: 'synthetic',
          health: [],
          stale: false,
          fetchedAt: '2026-10-25T00:00:00Z',
        },
      }),
    );
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const [name, path] of Object.entries({
      home: '/',
      dashboard: '/app',
      jobs: '/app/jobs',
      preferences: '/app/preferences',
      login: '/login',
      resumes: '/app/resumes',
      assistant: '/app/assistant',
      setup: '/setup',
    })) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      for (const image of await page.locator('.step-mascot, .cta-mascot').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node: HTMLImageElement) => node.decode());
      }
      if (!process.env['HEBREW_COPY_BEFORE']) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
      await page.evaluate(() => {
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      await page.screenshot({
        path: `docs/screenshots/changes/hebrew-copy-${name}-${info.project.name}-${colorScheme}/${process.env['HEBREW_COPY_BEFORE'] ? 'before' : 'after'}.png`,
        fullPage: true,
      });
    }
  });
}
