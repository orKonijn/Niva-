import { chromium } from '@playwright/test';
const baseURL = process.env.NIVA_CAPTURE_BASE_URL ?? 'http://127.0.0.1:4300';
const label = process.env.NIVA_CAPTURE_LABEL ?? 'after';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  for (const scene of [
    { name: 'home', path: '/', width: 1440, height: 1000, theme: 'light' },
    { name: 'dashboard', path: '/app', width: 1440, height: 1000, theme: 'dark' },
    {
      name: 'preferences-mobile',
      path: '/app/preferences',
      width: 390,
      height: 800,
      theme: 'dark',
    },
    { name: 'jobs', path: '/app/jobs', width: 1440, height: 1000, theme: 'light' },
  ]) {
    await page.setViewportSize({ width: scene.width, height: scene.height });
    await page.goto(baseURL);
    await page.evaluate((theme) => localStorage.setItem('niva.theme', theme), scene.theme);
    await page.goto(baseURL + scene.path);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(
      () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
    );
    await page.screenshot({
      path: `docs/screenshots/refactor-${label}-${scene.name}.png`,
      fullPage: true,
    });
  }
} finally {
  await browser.close();
}
