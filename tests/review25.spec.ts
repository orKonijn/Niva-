import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { ResumeVersion } from '../src/app/core/models/career';
async function fixture(context: BrowserContext) {
  let epoch = 'base',
    erasure = 'account0',
    revision = 0;
  let resumes: ResumeVersion[] = ['A', 'B'].map((id) => ({
    id,
    name: 'Synthetic ' + id,
    text: id === 'A' ? 'ניסיון מלא ב-Python וב-SQL' : 'Synthetic B Angular experience',
    kind: 'original',
    confirmed: true,
    active: id === 'A',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  }));
  const config = {
    ai: true,
    uploads: false,
    processor: '',
    retentionDays: 30,
    maxUploadBytes: 750000,
  };
  await context.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === '/api/config')
      data = {
        accounts: true,
        discovery: true,
        realJobs: true,
        platform: 'sites',
        email: false,
        google: false,
        apple: false,
      };
    else if (path === '/api/session')
      data = {
        user: {
          id: 'synthetic-review25',
          name: 'Synthetic fixture',
          email: 'fixture@example.test',
          emailVerified: true,
        },
      };
    else if (path === '/api/account/state') {
      if (
        route.request().method() === 'POST' &&
        route.request().postDataJSON().operation?.type === 'delete-data'
      ) {
        erasure = 'erased';
        epoch = 'erased';
        resumes = [];
        revision++;
      }
      data = { ...emptyAccountState(), revision };
    } else if (path === '/api/career/snapshot')
      data = {
        epoch,
        erasure,
        revision: String(revision),
        resumes,
        config,
        operations: {
          scheduledObserved: false,
          schedulerOverdue: true,
          cleanupOverdue: true,
          cleanupBoundMinutes: 60,
          alerts: { configured: false, operator: null },
          rows: [],
        },
      };
    else if (path === '/api/career/resumes') data = resumes;
    else if (path === '/api/career/config') data = config;
    else if (path === '/api/career/conversations') data = [];
    else if (path.endsWith('/delete')) {
      const id = path.split('/').at(-2);
      resumes = resumes.filter((r) => r.id !== id);
      epoch = 'scope-' + ++revision;
      data = { ok: true };
    } else if (path === '/api/feed')
      data = {
        jobs: [],
        archived: [],
        total: 0,
        nextCursor: null,
        snapshot: 'synthetic',
        health: [],
        coverage: [],
        stale: false,
      };
    else if (path === '/api/career/chat')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: 'event: context\ndata: {"conversationId":"fixture-chat","jobs":[]}\n\nevent: delta\ndata: {"text":"REJECTED [job:invented] https://untrusted.invalid"}\n\nevent: failure\ndata: {"error":"AI_REJECTED"}\n\n',
      });
    await route.fulfill({
      json: data,
      headers: { 'X-Niva-Lifecycle': epoch, 'X-Niva-Erasure': erasure },
    });
  });
  return {
    activate(id: string) {
      resumes = resumes.map((r) => ({ ...r, active: r.id === id }));
      revision++;
    },
    expire() {
      resumes = resumes.map((r) => ({
        ...r,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }));
      revision++;
    },
    erase() {
      resumes = [];
      epoch = 'erased';
      erasure = 'erased';
      revision++;
    },
  };
}
test('deleting B in another tab preserves A and new-text drafts; deleting A clears only A', async ({
  context,
  page,
}) => {
  await fixture(context);
  await page.goto('/app/resumes');
  await page.getByRole('button', { name: 'Synthetic A', exact: true }).click();
  const draft = 'UNSAVED synthetic A Python SQL';
  const newText = 'UNSAVED new synthetic candidate draft';
  await page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true }).fill(draft);
  await page.getByText('הוספת גרסה חדשה', { exact: true }).click();
  await page.getByLabel('טקסט קורות החיים', { exact: true }).fill(newText);
  const other = await context.newPage();
  await other.goto('/app/resumes');
  await other
    .locator('.career-version')
    .filter({ hasText: 'Synthetic B' })
    .getByRole('button', { name: 'מחיקת גרסה', exact: true })
    .click();
  await other.getByRole('button', { name: 'אישור מחיקה לצמיתות', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synthetic B', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true })).toHaveValue(draft);
  await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue(newText);
  await other
    .locator('.career-version')
    .filter({ hasText: 'Synthetic A' })
    .getByRole('button', { name: 'מחיקת גרסה', exact: true })
    .click();
  await other.getByRole('button', { name: 'אישור מחיקה לצמיתות', exact: true }).click();
  await expect(page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue(newText);
  await other.close();
});
test('focus synchronizes active/expired resumes without erasing edits; account erasure clears all', async ({
  context,
  page,
}) => {
  const state = await fixture(context);
  await page.goto('/app/resumes');
  await page.getByRole('button', { name: 'Synthetic A', exact: true }).click();
  await page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true }).fill('UNSAVED A draft Python SQL');
  await page.getByText('הוספת גרסה חדשה', { exact: true }).click();
  await page
    .getByLabel('טקסט קורות החיים', { exact: true })
    .fill('UNSAVED brand-new synthetic text');
  state.activate('B');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.career-version').filter({ hasText: 'Synthetic B' })).toContainText(
    'פעילה',
  );
  await expect(
    page.locator('.career-version').filter({ hasText: 'Synthetic A' }),
  ).not.toContainText('פעילה');
  await expect(page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true })).toHaveValue(
    'UNSAVED A draft Python SQL',
  );
  state.expire();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Synthetic B', exact: true })).toBeVisible();
  state.erase();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Synthetic A', exact: true })).toHaveCount(0);
});
test('rejected provisional legacy output is removed with a clear retryable error', async ({
  context,
  page,
}) => {
  await fixture(context);
  await page.goto('/app/assistant');
  await page.getByRole('checkbox', { name: /אני מסכים/ }).check();
  await page.getByLabel('ההודעה שלך', { exact: true }).fill('Synthetic rejected query');
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('התשובה נדחתה');
  await expect(page.getByRole('log')).not.toContainText('REJECTED');
  await expect(page.getByRole('log')).not.toContainText('untrusted.invalid');
  await expect(page.getByRole('button', { name: 'ניסיון חוזר', exact: true })).toBeEnabled();
});
test('maintenance diagnostics and enlarged Hebrew forms retain keyboard access and both-theme contrast', async ({
  context,
  page,
}) => {
  await fixture(context);
  await page.goto('/app/resumes');
  await page.getByText('שמירה, פרטיות ותחזוקה', { exact: true }).focus();
  await page.getByText('שמירה, פרטיות ותחזוקה', { exact: true }).press('Enter');
  await page.getByText('פרטים טכניים למפעיל', { exact: true }).focus();
  await page.getByText('פרטים טכניים למפעיל', { exact: true }).press('Enter');
  await expect(page.getByText(/לא הוגדר יעד התראה ומפעיל/)).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => (document.documentElement.dataset['theme'] = t), theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
