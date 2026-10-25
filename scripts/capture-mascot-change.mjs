import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
try {
  for (const [device, viewport] of Object.entries({
    desktop: { width: 1265, height: 900 },
    mobile: { width: 390, height: 844 },
  })) {
    for (const colorScheme of ['light', 'dark']) {
      for (const [label, origin] of Object.entries({
        before: 'http://127.0.0.1:4318',
        after: 'http://127.0.0.1:4317',
      })) {
        const page = await browser.newPage({ viewport, colorScheme, reducedMotion: 'reduce' });
        await page.goto(origin);
        await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
        for (const image of await page.locator('.step-mascot, .cta-mascot').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((node) => node.decode());
        }
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        const directory = `docs/screenshots/changes/niva-mascot-${device}-${colorScheme}`;
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
