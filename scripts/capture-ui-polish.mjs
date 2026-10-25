import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
const browser = await chromium.launch();
try {
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 },
  })) {
    for (const colorScheme of ['light', 'dark']) {
      for (const [route, path] of Object.entries({
        home: '/',
        dashboard: '/app',
        jobs: '/app/jobs',
        login: '/login',
      })) {
        const page = await browser.newPage({ viewport, colorScheme, reducedMotion: 'reduce' });
        await page.goto('http://127.0.0.1:4319' + path);
        const cookie = page.getByRole('button', { name: 'רק הכרחיות', exact: true });
        if (await cookie.isVisible()) await cookie.click();
        await page.getByRole('heading', { level: 1 }).waitFor();
        for (const image of await page.locator('.step-mascot, .cta-mascot').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((node) => node.decode());
        }
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const directory = `docs/screenshots/changes/ui-polish-${route}-${device}-${colorScheme}`;
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
