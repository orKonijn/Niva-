import { test, expect } from '@playwright/test';
import { reviewFixture } from './ui-review-fixture';

test('personal dashboard tile opens personal search', async ({ page, context }, info) => {
  await reviewFixture(context);
  await page.goto('/app');
  const tile = page.getByRole('link').filter({ hasText: 'משרות לפי ההעדפות שלך' });
  await expect(tile).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/changes/review29-${info.project.name}/${process.env['REPAIR_BEFORE'] ? 'before' : 'after'}.png`,
    fullPage: true,
  });
  await tile.click();
  await expect(page).toHaveURL(/scope=personal/);
});

test('dashboard shows the personal total rather than only the loaded page', async ({
  page,
  context,
}) => {
  await reviewFixture(context);
  const { reviewJobs } = await import('./ui-review-fixture');
  await context.route('**/api/feed**', (r) =>
    r.fulfill({
      json: {
        jobs: reviewJobs,
        total: 23,
        nextCursor: 'next',
        snapshot: 'synthetic',
        health: [],
        stale: false,
      },
    }),
  );
  await page.goto('/app');
  const tile = page.getByRole('link').filter({ hasText: 'משרות לפי ההעדפות שלך' });
  await expect(tile.locator('strong')).toHaveText('23');
  await expect(tile).toHaveAttribute('href', '/app/jobs?scope=personal');
});

test('rapid independent filter changes preserve the final choices', async ({ page, context }) => {
  await reviewFixture(context);
  await page.goto('/app/jobs?saved=true');
  await expect(page.locator('niva-work-style-fields')).toBeVisible();
  // Same-event-loop actions deliberately exercise pending router navigation.
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.trim() === 'כל המשרות')!.click();
    const checkboxes = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    for (const label of ['במשרד', 'היברידי', 'לכלול סגנון עבודה שלא נמסר'])
      checkboxes.find((c) => c.closest('label')?.textContent?.includes(label))!.click();
  });
  await expect(page).not.toHaveURL(/saved=true/);
  await expect.poll(() => new URL(page.url()).searchParams.get('styles')).toBe('onsite,hybrid');
  await expect(page).toHaveURL(/unknownStyle=false/);
  await expect(page.getByRole('checkbox', { name: 'במשרד', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'היברידי', exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'במשרד', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'היברידי', exact: true })).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'לכלול סגנון עבודה שלא נמסר' }),
  ).not.toBeChecked();
});
