import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
const root = resolve('.test-data/staging42'),
  access = JSON.parse(readFileSync(resolve(root, 'private-test-access.json'), 'utf8'));
if (access.origin !== 'http://127.0.0.1:4310') throw Error('DISPOSABLE_LOOPBACK_ONLY');
const evidence = resolve('docs/screenshots/changes/repair42');
mkdirSync(evidence, { recursive: true });
async function login(page: Page, account: any) {
  await page.goto('/login');
  const cookies = page.getByRole('button', { name: 'רק הכרחיות', exact: true });
  if (await cookies.isVisible()) await cookies.click();
  await page.getByLabel('כתובת דוא״ל').fill(account.email);
  await page.getByLabel('סיסמה ל־Niva', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'כניסה לחשבון', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:setup|app)(?:\?|$)/);
}
async function setup(page: Page, extension: string) {
  await expect(page).toHaveURL(/\/setup/);
  const before = await page.request.get('/api/career/snapshot');
  expect((await before.json()).resumes).toHaveLength(0);
  await page
    .getByLabel('קובץ לבדיקה', { exact: true })
    .setInputFiles(resolve(root, 'synthetic-resume.' + extension));
  await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue(
    /Synthetic QA Candidate/,
  );
  expect((await (await page.request.get('/api/career/snapshot')).json()).resumes).toHaveLength(0);
  await page.screenshot({
    path: resolve(evidence, 'onboarding-' + extension + '.png'),
    fullPage: true,
  });
  await page.getByRole('checkbox', { name: /בדקתי את הטקסט והעובדות נכונות/ }).check();
  await page.getByRole('button', { name: 'שמירה והמשך להעדפות', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'שלב 2 · מה מתאים לך?' })).toBeVisible();
  await page.getByLabel('תחום שמעניין אותך').selectOption('qa-automation');
  await page.getByLabel('מחוז מועדף').selectOption('tel-aviv');
  await page.getByRole('checkbox', { name: 'היברידי', exact: true }).check();
  await page.getByRole('button', { name: 'שמירת ההעדפות וכניסה למרחב שלי', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
test('F15 F16 F18 F19 real local backend PDF DOCX first-time setup independent sessions and owner isolation', async ({
  page,
  browser,
}) => {
  await login(page, access.accounts[0]);
  const initial = await (await page.request.get('/api/account/state')).json();
  if (initial.setupCompleted) {
    const cleared = await page.request.post('/api/account/state', {
      headers: { Origin: access.origin, 'x-niva-csrf': '1' },
      data: { revision: initial.revision, operation: { type: 'delete-data' } },
    });
    expect(cleared.ok()).toBe(true);
    await page.goto('/app');
  }
  await setup(page, 'pdf');
  await page.goto('/app/preferences');
  await expect(page.getByLabel('מחוז מועדף')).toHaveValue('tel-aviv');
  await page.reload();
  await expect(page.getByLabel('תחום שמעניין אותך')).toHaveValue('qa-automation');
  await page.goto('/app/jobs/greenhouse-canopycare-5285235008');
  await page.getByRole('button', { name: 'שמירת משרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'הסרה מהשמורות', exact: true })).toBeVisible();
  const aliceState = await (await page.request.get('/api/account/state')).json();
  const aliceSnap = await (await page.request.get('/api/career/snapshot')).json();
  expect(aliceSnap.resumes[0].confirmed).toBe(true);
  const second = await browser.newContext({ baseURL: access.origin });
  const other = await second.newPage();
  await login(other, access.accounts[0]);
  expect((await (await other.request.get('/api/account/state')).json()).saved).toEqual(
    aliceState.saved,
  );
  await other.goto('/app/jobs/greenhouse-canopycare-5285235008');
  await expect(other.getByRole('button', { name: 'הסרה מהשמורות', exact: true })).toBeVisible();
  await other.getByRole('button', { name: 'הסרה מהשמורות', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'שמירת משרה', exact: true })).toBeVisible();
  await second.close();
  const bobContext = await browser.newContext({ baseURL: access.origin });
  const bob = await bobContext.newPage();
  await login(bob, access.accounts[1]);
  const bobInitial = await (await bob.request.get('/api/account/state')).json();
  if (bobInitial.setupCompleted) {
    const cleared = await bob.request.post('/api/account/state', {
      headers: { Origin: access.origin, 'x-niva-csrf': '1' },
      data: { revision: bobInitial.revision, operation: { type: 'delete-data' } },
    });
    expect(cleared.ok()).toBe(true);
    await bob.goto('/app');
  }
  await setup(bob, 'docx');
  expect((await (await bob.request.get('/api/account/state')).json()).saved).toEqual([]);
  const foreign = await bob.request.get(
    '/api/career/resumes/' + aliceSnap.resumes[0].id + '/export',
  );
  expect(foreign.status()).toBe(404);
  expect(await foreign.text()).not.toContain('Synthetic QA Candidate');
  const bobSnap = await (await bob.request.get('/api/career/snapshot')).json();
  expect(bobSnap.resumes[0].id).not.toBe(aliceSnap.resumes[0].id);
  await bobContext.close();
  const sql = new DatabaseSync(resolve(root, 'niva.sqlite'));
  const clicks = Number(
    (sql.prepare("SELECT count(*) n FROM niva_documents WHERE kind='apply-click'").get() as any).n,
  );
  const handoff = await page.request.get('/api/apply/greenhouse-canopycare-5285235008', {
    maxRedirects: 0,
  });
  expect(handoff.status()).toBe(303);
  expect(handoff.headers()['location']).toBe(
    'https://job-boards.greenhouse.io/canopycare/jobs/5285235008',
  );
  expect(
    Number(
      (sql.prepare("SELECT count(*) n FROM niva_documents WHERE kind='apply-click'").get() as any)
        .n,
    ),
  ).toBe(clicks + 1);
  const event = JSON.parse(
    String(
      (
        sql
          .prepare(
            "SELECT data FROM niva_documents WHERE kind='apply-click' ORDER BY rowid DESC LIMIT 1",
          )
          .get() as any
      ).data,
    ),
  );
  expect(Object.keys(event).sort()).toEqual(['at', 'availability', 'jobId', 'path']);
  sql.close();
  writeFileSync(
    '.test-data/repair42/staging-journey-receipt.json',
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          'Local Node SQLite actual HTTP backend; no mocked identity or account/CV/state routes',
        firstTimeOnboarding: true,
        pdf: true,
        docx: true,
        reviewBeforeWrite: true,
        preferenceReload: true,
        independentAliceSession: true,
        saveUnsaveReload: true,
        bobCannotExportAlice: true,
        redirectStatus: 303,
        destination: handoff.headers()['location'],
        loggedClick: true,
        externalApplicationRequest: false,
        hosted: false,
      },
      null,
      2,
    ),
  );
});
