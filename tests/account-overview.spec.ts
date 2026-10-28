import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { emptyCriteria } from '../src/app/core/models/discovery';

for (const theme of ['light', 'dark'] as const) {
  test(`account overview shows saved user data in ${theme}`, async ({ context, page }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.profile = {
      name: 'דנה בדיקה',
      headline: 'בודקת תוכנה',
      criteria: {
        ...emptyCriteria(),
        confirmed: true,
        skills: ['Python', 'SQL'],
        yearsExperience: 0,
        currentCountry: 'IL',
        salaryMin: 0,
        currency: 'ILS',
        languages: ['עברית', 'אנגלית'],
      },
    };
    state.saved = ['greenhouse-appsflyer-801', 'greenhouse-appsflyer-802'];
    state.preferences = {
      role: 'qa-automation',
      district: 'tel-aviv',
      workStyles: ['hybrid', 'remote'],
      exclusions: 'Synthetic Company',
    };
    const writes: string[] = [];
    await context.route('**/api/account/state', (r) => {
      if (r.request().method() !== 'GET') writes.push(r.request().method());
      return r.fulfill({ json: state });
    });
    await context.route('**/api/account/methods', (r) =>
      r.fulfill({ json: { methods: ['google'] } }),
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'שיטות התחברות מחוברות' })).toBeVisible();
    if (!process.env['ACCOUNT_OVERVIEW_BEFORE']) {
      const summary = page.getByRole('region', { name: 'פרטי החשבון' });
      await expect(summary).toContainText('דנה בדיקה');
      await expect(summary).toContainText('synthetic@example.test');
      await expect(summary).toContainText('בודקת תוכנה');
      const prefs = page.getByRole('region', { name: 'החיפוש שלי' });
      await expect(prefs).toContainText('מחוז תל אביב');
      await expect(prefs).toContainText('היברידי');
      await expect(prefs).toContainText('Synthetic Company');
      await expect(summary.locator('.account-saved-count')).toHaveText('2');
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/changes/account-overview-${info.project.name}-${theme}/${process.env['ACCOUNT_OVERVIEW_BEFORE'] ? 'before' : 'after'}.png`,
      fullPage: true,
    });
    if (process.env['ACCOUNT_OVERVIEW_BEFORE']) return;
    await page.getByText('פרטי ההתאמה ששמרתי', { exact: true }).click();
    const criteria = page.locator('.account-matching-summary');
    await expect(criteria).toContainText('Python, SQL');
    await expect(
      criteria
        .locator('div')
        .filter({ has: page.getByText('שנות ניסיון רלוונטי', { exact: true }) })
        .locator('dd'),
    ).toHaveText('0');
    await expect(
      criteria
        .locator('div')
        .filter({ has: page.getByText('שכר מינימום מבוקש', { exact: true }) })
        .locator('dd'),
    ).toHaveText('0');
    await expect(criteria).toContainText('לא ידוע / לא נמסר');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test('empty and unavailable account data stay distinct from loading', async ({ context, page }) => {
  await reviewFixture(context);
  const state = emptyAccountState();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/account/state', async (r) => {
    await gate;
    return r.fulfill({ json: state });
  });
  await context.route('**/api/account/methods', (r) =>
    r.fulfill({ json: { methods: ['google'] } }),
  );
  await page.goto('/account');
  await expect(page.getByText('טוענים את נתוני החשבון…', { exact: true })).toBeVisible();
  await expect(page.locator('.account-saved-count')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'החיפוש שלי' })).toHaveCount(0);
  release();
  await expect(page.locator('.account-saved-count')).toHaveText('0');
  await expect(page.getByRole('region', { name: 'פרטי החשבון' })).toContainText('בדיקת ממשק');
  await expect(page.getByRole('region', { name: 'פרטי החשבון' })).toContainText(
    'עוד לא הוגדרה כותרת מקצועית',
  );
  await page.getByText('פרטי ההתאמה ששמרתי', { exact: true }).click();
  await expect(page.getByText('עוד לא נשמרו פרטים לבדיקת התאמה.', { exact: false })).toBeVisible();
  await context.route('**/api/account/state', (r) =>
    r.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('לא ניתן לטעון את נתוני החשבון');
  await expect(page.locator('.account-saved-count')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'החיפוש שלי' })).toHaveCount(0);
});

test('changing account clears the previous user summary before loading the next', async ({
  context,
  page,
}) => {
  await reviewFixture(context);
  let owner = 'a';
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/session', (r) =>
    r.fulfill({
      json: {
        user: {
          id: `owner-${owner}`,
          name: `Identity ${owner}`,
          email: `owner-${owner}@example.test`,
          emailVerified: true,
        },
      },
    }),
  );
  await context.route('**/api/account/methods', (r) =>
    r.fulfill({ json: { methods: [owner === 'a' ? 'google' : 'apple'] } }),
  );
  await context.route('**/api/account/state', async (r) => {
    const requested = owner;
    if (requested === 'b') await gate;
    const state = emptyAccountState();
    state.profile = { name: `Saved owner ${requested}`, headline: `Headline ${requested}` };
    return r.fulfill({ json: state });
  });
  await page.goto('/account');
  await expect(page.getByRole('region', { name: 'פרטי החשבון' })).toContainText('Saved owner a');
  await expect(page.locator('main ul')).toContainText('Google');
  owner = 'b';
  await page.evaluate(() => {
    const channel = new BroadcastChannel('niva.account.session');
    channel.postMessage('refresh');
    channel.close();
  });
  await expect(page.getByRole('region', { name: 'פרטי החשבון' })).toContainText(
    'owner-b@example.test',
  );
  await expect(page.getByText('Saved owner a', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Headline a', { exact: true })).toHaveCount(0);
  await expect(page.locator('.account-saved-count')).toHaveCount(0);
  await expect(page.locator('main ul')).toContainText('Apple');
  await expect(page.locator('main ul')).not.toContainText('Google');
  release();
  await expect(page.getByRole('region', { name: 'פרטי החשבון' })).toContainText('Saved owner b');
});
