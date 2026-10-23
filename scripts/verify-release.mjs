import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Secrets are accepted only over stdin, kept in memory, and sent only to the selected Site.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { url, token, sourceCommit } = JSON.parse(input);
const origin = new URL(url).origin;
const headers = token ? { 'OAI-Sites-Authorization': `Bearer ${token}` } : {};
async function read(path) {
  const response = await fetch(new URL(path, origin), { headers, redirect: 'manual' });
  assert.equal(response.status, 200, `HTTP status for ${path}`);
  return response;
}
assert.equal((await (await read('/build-info.json')).json()).sourceCommit, sourceCommit);
const html = await (await read('/')).text();
assert.match(html, /<app-root/);
const assets = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map((m) => m[1]);
assert.ok(assets.length >= 3);
for (const asset of assets) {
  assert.equal(new URL(asset, origin).origin, origin);
  const response = await read(asset);
  assert.match(response.headers.get('content-type'), asset.endsWith('.js') ? /javascript/ : /css/);
}
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        ...(new URL(route.request().url()).origin === origin ? headers : {}),
      },
    }),
  );
  await context.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text());
  });
  for (const route of [
    '/',
    '/signup',
    '/app',
    '/app/jobs',
    '/app/jobs/product-designer',
    '/app/preferences',
    '/app/profile',
    '/app/applications',
    '/privacy',
    '/terms',
    '/accessibility',
  ]) {
    await page.goto(origin + route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await page.goto(origin + '/app/preferences');
  await page.getByLabel('תחום שמעניין אותך').selectOption('qa-automation');
  await page.getByLabel('מחוז מועדף').selectOption('haifa');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
  await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).check();
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByRole('status')).toContainText('1 משרות');
  await page.goto(origin + '/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('QA Automation Engineer');
  await page.getByRole('button', { name: 'שמירת המשרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'הסרת המשרה מהשמורות' })).toBeVisible();
  await page.goto(origin + '/app/jobs/qa-automation');
  await page.getByRole('checkbox', { name: /בדקתי את/ }).check();
  await page.getByRole('button', { name: 'אישור בהדגמה', exact: true }).click();
  await expect(page.getByText('המשרה אושרה בהדגמה', { exact: true })).toBeVisible();
  await page.goto(origin + '/app/applications');
  await expect(page.locator('.application-row')).toHaveCount(1);
  await page.goto(origin + '/app');
  await page.getByRole('button', { name: 'השהיית פעילות' }).click();
  await expect(page.getByRole('button', { name: 'חידוש הפעילות' })).toBeVisible();
  for (
    let i = 0;
    i < 3 && (await page.locator('html').getAttribute('data-theme-preference')) !== 'dark';
    i++
  ) {
    await page
      .getByRole('button', { name: /^ערכת נושא:/ })
      .filter({ visible: true })
      .click();
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      url: origin,
      sourceCommit,
      assets: assets.length,
      routes: 11,
      checks:
        'assets, refresh, filters, saved jobs, approval history, pause, theme persistence, mobile navigation, console: passed',
    }),
  );
} finally {
  await browser.close();
}
