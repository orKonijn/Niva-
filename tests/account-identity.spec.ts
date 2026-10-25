import { test, expect } from '@playwright/test';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';

const photo = 'https://lh3.googleusercontent.com/synthetic-profile';
for (const theme of ['light', 'dark']) {
  test(`account name and Google photo in ${theme}`, async ({ context, page }, info) => {
    await reviewFixture(context, true);
    const account = emptyAccountState();
    account.theme = theme as 'light' | 'dark';
    await context.route('**/api/account/state', (r) => r.fulfill({ json: account }));
    await context.addInitScript((value) => localStorage.setItem('niva.theme', value), theme);
    await context.route('**/api/session', (r) =>
      r.fulfill({
        json: {
          user: {
            id: 'synthetic-identity',
            name: 'נועה לדוגמה',
            email: 'synthetic@example.test',
            emailVerified: true,
            image: photo,
          },
        },
      }),
    );
    await context.route(photo, (r) =>
      r.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#436a8c"/><circle cx="40" cy="29" r="15" fill="#f0cda7"/><path d="M10 80a30 30 0 0 1 60 0" fill="#e5dce9"/></svg>',
      }),
    );
    await page.goto('/app');
    await expect(page.locator('h1')).toContainText('טוב לראות אותך');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const directory = `docs/screenshots/changes/account-identity-${info.project.name}-${theme}`;
    if (process.env['IDENTITY_BEFORE']) {
      await page.screenshot({ path: `${directory}/before.png` });
      return;
    }
    await expect(page.locator('h1')).toContainText('היי נועה לדוגמה,');
    const avatar = page.locator('.user-avatar img');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveJSProperty('naturalWidth', 80);
    await page.screenshot({ path: `${directory}/after.png` });
    await context.unroute(photo);
    await context.route(photo, (r) => r.abort());
    await page.reload();
    await expect(page.locator('.user-avatar')).toHaveText('נ');
    await expect(avatar).toHaveCount(0);
  });
}

test('chosen profile name takes precedence and missing or untrusted photos use an initial', async ({
  context,
  page,
}) => {
  await reviewFixture(context, true);
  const state = emptyAccountState();
  state.profile.name = 'שם נבחר';
  await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
  for (const image of [null, 'https://untrusted.example/photo', 'javascript:alert(1)']) {
    await context.route('**/api/session', (r) =>
      r.fulfill({
        json: {
          user: {
            id: 'synthetic-identity',
            name: 'שם מגוגל',
            email: 'synthetic@example.test',
            emailVerified: true,
            image,
          },
        },
      }),
    );
    await page.goto('/app');
    await expect(page.locator('h1')).toContainText('היי שם נבחר,');
    await expect(page.locator('.user-avatar')).toHaveText('ש');
    await expect(page.locator('.user-avatar img')).toHaveCount(0);
  }
});
