import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import type { AccountUser } from '../src/app/core/account-session';

for (const member of [false, true])
  for (const theme of ['light', 'dark'] as const) {
    test(`homepage for ${member ? 'member' : 'visitor'} in ${theme}`, async ({
      context,
      page,
    }, info) => {
      await reviewFixture(context);
      await context.route('**/api/config', (r) =>
        r.fulfill({
          json: {
            accounts: true,
            email: false,
            google: false,
            apple: false,
            platform: 'sites',
            realJobs: true,
            discovery: true,
          },
        }),
      );
      await context.route('**/api/session', (r) =>
        r.fulfill({
          json: {
            user: member
              ? {
                  id: 'synthetic-review',
                  name: 'בדיקת ממשק',
                  email: 'synthetic@example.test',
                  emailVerified: true,
                }
              : null,
          },
        }),
      );
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.locator('.hero h1')).toBeVisible();
      if (!process.env['HOME_SESSION_BEFORE']) {
        if (member) {
          await expect(page.locator('.hero h1')).toContainText('טוב שחזרת');
          await expect(page.locator('.header-actions a[href="/app"]')).toBeVisible();
          await expect(page.locator('.hero-actions a[href="/app/jobs"]')).toBeVisible();
          await expect(
            page.locator('.marketing a[href="/login"],.marketing a[href="/register"]'),
          ).toHaveCount(0);
          await expect(page.locator('.final-cta a[href="/app"]')).toBeVisible();
        } else {
          await expect(page.locator('.hero h1')).toContainText('מחפשים עבודה');
          await expect(page.locator('.header-actions .button')).toHaveText(/יצירת חשבון/);
          await expect(page.locator('.hero-actions a').first()).toHaveAttribute('href', '/login');
        }
      } else await expect(page.locator('.header-actions .button')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `docs/screenshots/changes/home-session-${member ? 'member' : 'visitor'}-${info.project.name}-${theme}/${process.env['HOME_SESSION_BEFORE'] ? 'before' : 'after'}.png`,
      });
      if (process.env['HOME_SESSION_BEFORE']) return;
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      for (const width of [320, 390, 768, 900, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'פתיחת תפריט', exact: true }).click();
      const mobileLink = page.locator('nav .home-mobile-session-link');
      await expect(mobileLink).toBeVisible();
      await expect(mobileLink).toHaveAttribute('href', member ? '/account' : '/login');
    });
  }

test('home waits for the session, reacts to logout/login and preserves setup routing', async ({
  context,
  page,
}) => {
  await reviewFixture(context);
  await context.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        accounts: true,
        email: false,
        google: false,
        apple: false,
        platform: 'sites',
        setupRequired: true,
        realJobs: true,
        discovery: true,
      },
    }),
  );
  const member: AccountUser = {
    id: 'synthetic-review',
    name: 'בדיקת ממשק',
    email: 'synthetic@example.test',
    emailVerified: true,
  };
  let user: AccountUser | null = member;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/session', async (r) => {
    await gate;
    return r.fulfill({ json: { user } });
  });
  await page.goto('/');
  await expect(page.locator('.hero-actions').getByRole('status')).toHaveText('בודקים את החיבור…');
  await expect(
    page.locator(
      '.marketing a[href="/login"],.marketing a[href="/register"],.marketing a[href="/signup"]',
    ),
  ).toHaveCount(0);
  release();
  await expect(page.locator('.hero h1')).toContainText('טוב שחזרת');
  user = null;
  await page.evaluate(() => {
    const channel = new BroadcastChannel('niva.account.session');
    channel.postMessage('refresh');
    channel.close();
  });
  await expect(page.locator('.header-actions .button')).toContainText('יצירת חשבון');
  await expect(page.locator('.header-actions a[href="/app"]')).toHaveCount(0);
  user = member;
  await page.evaluate(() => {
    const channel = new BroadcastChannel('niva.account.session');
    channel.postMessage('refresh');
    channel.close();
  });
  await expect(page.locator('.hero h1')).toContainText('טוב שחזרת');
  await page.locator('.header-actions a[href="/app"]').click();
  await expect(page).toHaveURL(/\/setup\?returnTo=/);
});

test('visitors use the configured registration flow', async ({ context, page }) => {
  await reviewFixture(context);
  await context.route('**/api/config', (r) =>
    r.fulfill({ json: { accounts: true, email: true, google: false, apple: false } }),
  );
  await context.route('**/api/session', (r) => r.fulfill({ json: { user: null } }));
  await page.goto('/');
  await expect(page.locator('.header-actions .button')).toHaveAttribute('href', '/register');
  await expect(page.locator('.hero-actions a').first()).toHaveAttribute('href', '/register');
  await expect(page.locator('.final-cta .button')).toHaveAttribute('href', '/register');
});
