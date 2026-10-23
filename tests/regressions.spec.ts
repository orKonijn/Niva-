import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'רק הכרחיות', exact: true }).click();
});

test('skip keeps the route, profile memory and current main focused', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('איך לקרוא לך?', { exact: false }).fill('דנה');
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await expect(page.locator('.step-content h2')).toBeFocused();
  await page.getByRole('button', { name: 'חזרה', exact: true }).click();
  await expect(page.locator('.step-content h2')).toBeFocused();
  await expect(page.getByLabel('איך לקרוא לך?', { exact: false })).toHaveValue('דנה');
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await expect(page.locator('.step-content h2')).toBeFocused();
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.getByRole('button', { name: 'לסביבה האישית שלי' }).click();
  for (const path of ['/app', '/app/jobs', '/signup', '/privacy']) {
    // Navigate with Angular links so in-memory profile state survives.
    if (path !== '/app') {
      // Public navigation requires actual route loading; memory assertion is made before that.
      if (path === '/app/jobs') await page.locator('.welcome-panel a').click();
      else await page.goto(path);
    }
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('h1')).toBeVisible();
    const pathname = new URL(page.url()).pathname;
    const skip = page.getByRole('link', { name: 'דילוג לתוכן' });
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    expect(new URL(page.url()).pathname).toBe(pathname);
    if (path === '/app') await expect(page.locator('h1')).toContainText('דנה');
  }
});

test('two tabs merge saves, respect pause and synchronize reset', async ({ page, context }) => {
  await page.goto('/app/jobs');
  const second = await context.newPage();
  await second.goto('/app/jobs');
  await Promise.all([
    page.locator('niva-job-card').nth(0).getByRole('button').click(),
    second.locator('niva-job-card').nth(1).getByRole('button').click(),
  ]);
  await page.getByRole('button', { name: 'השמורות שלי', exact: false }).click();
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await second.goto('/app/jobs/ux-designer');
  await second.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.goto('/app');
  await page.getByRole('button', { name: 'השהיית פעילות' }).click();
  await expect(second.getByRole('button', { name: 'אישור בהדגמה', exact: true })).toBeDisabled();
  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'איפוס נתוני ההדגמה', exact: true }).click();
  await page.getByRole('button', { name: 'כן, איפוס הנתונים' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נמחקו' })).toBeVisible();
  await second.reload();
  expect(await second.evaluate(() => localStorage.getItem('niva.demo.v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('niva.cookie-choice'))).toBe('necessary');
  await second.close();
});

test('real removeItem failure reports only session clearing and data returns on reload', async ({
  page,
}) => {
  await page.goto('/app/jobs');
  await page.locator('niva-job-card').first().getByRole('button').click();
  await expect(page.locator('niva-job-card').first().getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('niva.demo.v1')))
    .toContain('product-designer');
  await page.goto('/app/profile');
  await page.evaluate(() => {
    Storage.prototype.removeItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });
  await page.getByRole('button', { name: 'איפוס נתוני ההדגמה', exact: true }).click();
  await page.getByRole('button', { name: 'כן, איפוס הנתונים' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'נתונים ישנים' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('niva.demo.v1'))).toContain(
    'product-designer',
  );
  await page.goto('/app/jobs?saved=true');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
});

test('URL controls refresh and history while saved jobs survive preference changes', async ({
  page,
}) => {
  await page.goto('/app/jobs');
  await page.locator('niva-job-card').first().getByRole('button').click();
  await expect(page.locator('niva-job-card').first().getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('niva.demo.v1')))
    .toContain('product-designer');
  await page.goto('/app/preferences');
  await page.getByLabel('תחום שמעניין אותך').selectOption('engineering');
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByText('ההעדפות נשמרו.', { exact: false })).toBeVisible();
  await page.goto('/app/jobs?saved=true');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.getByText('מחוץ להעדפות הנוכחיות', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'כל המשרות', exact: true }).click();
  await expect(page).not.toHaveURL(/saved=true/);
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/saved=true/);
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'חיפוש תפקיד או חברה' }).fill('Forma');
  await expect(page).toHaveURL(/q=Forma/);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'חיפוש תפקיד או חברה' })).toHaveValue('Forma');
  await page.goto('/app/preferences');
  await page.getByLabel('חברות שעדיף לא להציג', { exact: false }).fill('Forma');
  await page.getByRole('button', { name: 'שמירת ההעדפות' }).click();
  await expect(page.getByText('ההעדפות נשמרו.', { exact: false })).toBeVisible();
  await page.goto('/app/jobs?saved=true');
  await expect(page.locator('niva-job-card')).toHaveCount(0);
  await expect(page.getByText('משרות שמורות מוסתרות', { exact: false })).toBeVisible();
  await expect(page.locator('#main')).not.toContainText('Forma');
  await page.getByRole('button', { name: 'ניקוי הסינון במסך' }).click();
  await expect(page).not.toHaveURL(/saved=|q=|model=/);
});

test('CV metadata is committed on completion, restored on revisit and explicitly removed', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('בחירת קובץ קורות חיים להדגמה').setInputFiles({
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('metadata-only'),
  });
  await page.getByRole('button', { name: 'ממשיכים להעדפות' }).click();
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.getByRole('button', { name: 'לסביבה האישית שלי' }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Add real Angular navigation links via existing public brand -> setup.
  const exit = page.getByRole('link', { name: 'בחזרה לאתר', exact: true });
  if ((page.viewportSize()?.width ?? 1440) > 767) await exit.click();
  else {
    await page.getByRole('button', { name: 'פתיחת תפריט', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'בחזרה לאתר', exact: true }).click();
  }
  await page.getByRole('link', { name: 'מתחילים עם קורות החיים', exact: true }).click();
  await expect(page.locator('.upload-zone strong')).toHaveText('sample.pdf');
  await page.getByRole('button', { name: 'הסרת בחירת קורות חיים' }).click();
  await page.getByRole('button', { name: 'ממשיכים עם פרופיל לדוגמה' }).click();
  await page.getByRole('button', { name: 'ממשיכים לסיכום' }).click();
  await expect(page.locator('.summary-card')).toContainText('ללא קובץ');
  await page.getByRole('checkbox', { name: /הבנתי שזו|בדקתי את/ }).check();
  await page.getByRole('button', { name: 'לסביבה האישית שלי' }).click();
  await page.locator('.welcome-panel a').click();
  await page.locator('niva-job-card h3 a').first().click();
  await expect(page.locator('.review-list')).toContainText('ללא קובץ');
  expect(await page.evaluate(() => localStorage.getItem('niva.demo.v1'))).not.toContain(
    'sample.pdf',
  );
});

test('short mobile modal traps focus, dismisses and handles desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto('/app');
  const trigger = page.getByRole('button', { name: 'פתיחת תפריט', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'סגירת תפריט' })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await expect(dialog.getByRole('link', { name: 'סקירה כללית' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/drawer-short.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(10, 250);
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(dialog).not.toBeVisible();
});

test('relevant routes remain readable without overflow at requested widths', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ['/app', '/app/preferences', '/app/profile', '/app/applications']) {
      await page.goto(route);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width} ${route}`,
      ).toBe(true);
    }
  }
  for (const route of ['/app/preferences', '/app/profile', '/app/applications']) {
    await page.goto(route);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('production routes emit no browser errors or warnings', async ({ page }) => {
  const messages: string[] = [];
  page.on('pageerror', (error) => messages.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) messages.push(message.text());
  });
  for (const route of [
    '/',
    '/signup',
    '/app',
    '/app/preferences',
    '/app/profile',
    '/app/jobs',
    '/app/applications',
  ]) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(messages).toEqual([]);
});

test('export contains demo records and excludes private profile metadata', async ({ page }) => {
  await page.goto('/app/profile');
  await page.getByLabel('איך לקרוא לך?', { exact: false }).fill('Private Candidate');
  await page.getByRole('button', { name: 'שמירת שם לביקור הנוכחי' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'הורדת נתוני ההדגמה' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('niva-demo-data.json');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  expect(JSON.parse(raw).mode).toBe('local-demo');
  expect(raw).not.toContain('Private Candidate');
});

test('screen work-model filter survives reload and Back/Forward without changing preferences', async ({
  page,
}) => {
  await page.goto('/app/jobs');
  await page.getByRole('checkbox', { name: 'מרחוק', exact: true }).check();
  await expect(page).toHaveURL(/styles=remote/);
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'מרחוק', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'השמורות שלי', exact: false }).click();
  await expect(page).toHaveURL(/saved=true/);
  await page.goBack();
  await expect(page).not.toHaveURL(/saved=true/);
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await page.goForward();
  await expect(page).toHaveURL(/saved=true/);
  await page.getByRole('button', { name: 'ניקוי הסינון במסך' }).click();
  await expect(page).not.toHaveURL(/saved=|styles=|model=/);
  await expect(page.locator('niva-job-card')).toHaveCount(11);
});
