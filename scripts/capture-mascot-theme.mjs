import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const label = process.argv[2];
if (!['before', 'after'].includes(label)) throw new Error('Use before or after');
const browser = await chromium.launch();
try {
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1361, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport, colorScheme, reducedMotion: 'reduce' });
      await page.goto('http://127.0.0.1:4319/');
      await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
      await page.locator('#how-it-works').scrollIntoViewIfNeeded();
      for (const image of await page.locator('.step-mascot').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node) => node.decode());
      }
      const directory = `docs/screenshots/changes/niva-artwork-${device}-${colorScheme}`;
      await mkdir(directory, { recursive: true });
      await page.locator('.steps-grid').screenshot({ path: `${directory}/${label}.png` });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
