import { test, expect } from '@playwright/test';

test('every lazy route survives direct navigation and refresh with its production assets', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  const failedAssets: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failedAssets.push(response.url());
  });
  for (const route of [
    '/',
    '/signup',
    '/login',
    '/app',
    '/app/jobs',
    '/app/jobs/1',
    '/app/preferences',
    '/app/profile',
    '/app/applications',
    '/privacy',
    '/terms',
    '/accessibility',
    '/missing',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  }
  expect(failedAssets).toEqual([]);
});

test('outline actions remain readable and menu controls only appear on mobile', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/jobs');
  const action = page.getByRole('main').getByRole('link', { name: 'העדפות חיפוש', exact: true });
  await expect(action).toBeVisible();
  expect(
    await action.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.color !== style.backgroundColor && style.color !== 'rgb(255, 255, 255)';
    }),
  ).toBe(true);
  await expect(page.getByRole('button', { name: 'סגירת תפריט' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'פתיחת תפריט' })).toBeHidden();
  await page.setViewportSize({ width: 810, height: 1000 });
  expect(
    await page
      .locator('.filter-panel')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(500);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('button', { name: 'פתיחת תפריט' })).toBeVisible();
});
