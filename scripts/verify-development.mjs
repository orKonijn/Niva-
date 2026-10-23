import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const messages = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) messages.push(message.text());
  });
  page.on('pageerror', (error) => messages.push(error.message));
  for (const route of [
    '/',
    '/app/preferences',
    '/app/profile',
    '/app/jobs',
    '/app/applications',
    '/signup',
  ]) {
    await page.goto(`http://127.0.0.1:4301${route}`);
    await expect(page.locator('h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await expect(page.locator('.step-content h2')).toBeFocused();
  await page.getByLabel('תחום שמעניין אותך').selectOption('design');
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await expect(page.locator('.step-content h2')).toBeFocused();
  expect(messages).toEqual([]);
  console.log('Development routes and preference fields: no console warnings/errors.');
} finally {
  await browser.close();
}
