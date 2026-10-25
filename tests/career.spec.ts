import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { Job } from '../src/app/core/models/job';
import type { ResumeVersion } from '../src/app/core/models/career';
import { mkdir } from 'node:fs/promises';
const job = (id: number, title: string, style: 'hybrid' | 'remote' = 'hybrid'): Job => ({
  id: `greenhouse-appsflyer-${id}`,
  title: `משרת בדיקת ממשק — ${title}`,
  company: 'AppsFlyer',
  initials: 'AF',
  color: '#e4f1fa',
  district: 'tel-aviv',
  workStyle: style,
  category: 'qa-automation',
  posted: 'זמן פרסום לא נמסר',
  description: 'Python SQL Playwright testing. UI test fixture, not a real vacancy.',
  skills: [],
  reason: 'נתוני בדיקת ממשק בלבד',
  offices: [],
  source: {
    kind: 'real',
    name: 'AppsFlyer / Greenhouse',
    url: 'https://careers.appsflyer.com/',
    applicationUrl: `https://careers.appsflyer.com/jobs/position/${id}`,
    fetchedAt: '2026-10-24T10:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    location: 'Herzliya',
    active: true,
    version: 'fixture-v1',
    classification: 'נתוני בדיקה',
  },
});
const jobs = [
  job(101, 'QA Automation'),
  job(102, 'Software Test', 'remote'),
  job(103, 'Quality Engineer'),
];
const original: ResumeVersion = {
  id: 'original-fixture',
  name: 'קורות חיים לבדיקת ממשק',
  text: 'Candidate\n\nManual QA at Example A\n2020–2022\n\nPython SQL Playwright at Example B\n2023–2026',
  confirmed: true,
  active: true,
  kind: 'original',
  createdAt: '2026-10-24T10:00:00Z',
  expiresAt: '2026-11-23T10:00:00Z',
};
async function fixture(page: Page, { ai = false } = {}) {
  let resumes = [structuredClone(original)];
  let chatCalls = 0;
  await page.addInitScript(() => localStorage.setItem('niva.cookie-choice', 'necessary'));
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        accounts: true,
        realJobs: true,
        discovery: true,
        platform: 'sites',
        email: false,
        google: false,
        apple: false,
      },
    }),
  );
  await page.route('**/api/session', (r) =>
    r.fulfill({
      json: {
        user: {
          id: 'test-fixture-owner',
          email: 'fixture@example.test',
          name: 'בדיקת ממשק',
          emailVerified: true,
        },
      },
    }),
  );
  await page.route('**/api/account/state', (r) => r.fulfill({ json: emptyAccountState() }));
  await page.route('**/api/listings/*', (r) =>
    r.fulfill({ json: jobs.find((j) => r.request().url().endsWith(j.id)) ?? jobs[0] }),
  );
  await page.route('**/api/career/**', async (r) => {
    const path = new URL(r.request().url()).pathname;
    const body = r.request().method() === 'POST' ? r.request().postDataJSON() : {};
    if (path.endsWith('/snapshot'))
      return r.fulfill({
        json: {
          epoch: 'fixture',
          erasure: 'account0',
          revision: 'fixture',
          resumes,
          config: { ai, uploads: false, processor: '', retentionDays: 30, maxUploadBytes: 750000 },
          operations: null,
        },
      });
    if (path.endsWith('/config'))
      return r.fulfill({
        json: { ai, uploads: false, processor: '', retentionDays: 30, maxUploadBytes: 750000 },
      });
    if (path.endsWith('/conversations')) return r.fulfill({ json: [] });
    if (path.endsWith('/resumes') && r.request().method() === 'GET')
      return r.fulfill({ json: resumes });
    if (path.endsWith('/tailor')) {
      const next: ResumeVersion = {
        ...original,
        id: 'tailored-fixture',
        name: original.name + ' — התאמה',
        parentId: original.id,
        jobId: jobs[0].id,
        jobVersion: 'fixture-v1',
        text: original.text,
        kind: 'tailored',
        active: false,
        confirmed: false,
        explanation: 'סדר המקור נשמר, ללא הוספת עובדות. בדיקת ממשק.',
      };
      resumes.push(next);
      return r.fulfill({ json: next, status: 201 });
    }
    if (path.endsWith('/review')) {
      const resume = resumes.find((x) => path.includes(x.id))!;
      resume.text = body.text;
      resume.confirmed = true;
      return r.fulfill({ json: resume });
    }
    if (path.endsWith('/chat')) {
      chatCalls++;
      if (chatCalls === 1) return r.fulfill({ status: 503, json: { error: 'AI_UNAVAILABLE' } });
      return r.fulfill({
        contentType: 'text/event-stream',
        body:
          'event: context\ndata: ' +
          JSON.stringify({ conversationId: 'chat-fixture', jobs: jobs.slice(0, 1) }) +
          '\n\nevent: delta\ndata: ' +
          JSON.stringify({
            text: 'תגובת בדיקת ספק מדומה: במשרה נדרשים Python ו־SQL. ספרי על דוגמה מהניסיון שלך. [job:greenhouse-appsflyer-101]',
          }) +
          '\n\nevent: done\ndata: {"conversationId":"chat-fixture"}\n\n',
      });
    }
    return r.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });
  await page.route('**/api/feed?**', (r) => {
    const url = new URL(r.request().url());
    const filtered = url.searchParams.get('q')
      ? jobs.filter((j) => j.title.includes(url.searchParams.get('q')!))
      : jobs;
    const more = url.searchParams.has('cursor');
    return r.fulfill({
      json: {
        jobs: filtered.slice(more ? 2 : 0, more ? 3 : 2),
        total: filtered.length,
        nextCursor: !more && filtered.length > 2 ? 'fixture-cursor' : null,
        snapshot: 'fixture-v1',
        health: [
          {
            id: 'greenhouse-appsflyer',
            checked_at: '2026-10-24T10:00:00Z',
            next_at: 0,
            error: null,
          },
          {
            id: 'lever-walkme',
            checked_at: '2026-10-24T10:00:00Z',
            next_at: 0,
            error: 'SOURCE_UNAVAILABLE',
          },
        ],
        stale: true,
        fetchedAt: '2026-10-24T10:00:00Z',
      },
    });
  });
}
test('cursor load-more, refresh and filters preserve the same list/map dataset', async ({
  page,
}, info) => {
  await fixture(page);
  await page.goto('/app/jobs');
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.evaluate(() => (document.documentElement.dataset['theme'] = 'light'));
  await expect(page.getByRole('status').filter({ hasText: '2 מתוך 3' })).toBeVisible();
  await page.getByRole('button', { name: 'טעינת משרות נוספות', exact: true }).click();
  await expect(page.locator('niva-job-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'רענון משרות', exact: true }).click();
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).fill('QA Automation');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'רענון משרות', exact: true }).click();
  await expect(page.getByLabel('חיפוש תפקיד או חברה', { exact: true })).toHaveValue(
    'QA Automation',
  );
  await page.getByRole('button', { name: 'מפה', exact: true }).click();
  await expect(page.locator('niva-job-map')).toBeVisible();
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'רשימה', exact: true }).click();
  await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).fill('');
  await expect(page.locator('niva-job-card')).toHaveCount(2);
  await mkdir('docs/screenshots/career', { recursive: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: `docs/screenshots/career/feed-${info.project.name}.png`,
    fullPage: true,
  });
});
test('resume comparison is editable, requires fact confirmation and does not activate a draft', async ({
  page,
}, info) => {
  await fixture(page);
  await page.goto('/app/resumes?job=greenhouse-appsflyer-101');
  await page.getByRole('button', { name: original.name, exact: true }).click();
  await page.getByRole('button', { name: 'יצירת טיוטה מותאמת למשרה', exact: true }).click();
  await expect(page.getByText('לפני — מקור ללא שינוי', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'הפיכת הגרסה המאושרת לפעילה', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('אחרי — טיוטה לעריכה', { exact: true })).toHaveValue(/Example B/);
  await expect(page.locator('.career-text')).toContainText('Manual QA at Example A');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: `docs/screenshots/career/comparison-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('checkbox', { name: /בדקתי את הטקסט/ }).check();
  await page.getByRole('button', { name: 'אישור עובדות ושמירת עריכה כגרסה', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('העובדות אושרו');
});
test('chat consent, grounded context, provider failure and retry are accessible', async ({
  page,
}, info) => {
  await fixture(page, { ai: true });
  await page.goto('/app/assistant?job=greenhouse-appsflyer-101');
  await page.getByLabel('ההודעה שלך', { exact: true }).fill('Prepare me for a QA interview בעברית');
  await expect(page.getByRole('button', { name: 'שליחה', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /אני מסכים/ }).check();
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('אינו זמין');
  await page.getByRole('button', { name: 'ניסיון חוזר', exact: true }).press('Enter');
  await expect(page.getByRole('log')).toContainText('תגובת בדיקת ספק מדומה');
  await expect(page.getByRole('link', { name: /משרת בדיקת ממשק — QA Automation/ })).toHaveAttribute(
    'href',
    '/app/jobs/greenhouse-appsflyer-101',
  );
  await expect(page.getByRole('log').locator('a')).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => (document.documentElement.dataset['theme'] = value), theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({
    path: `docs/screenshots/career/chat-${info.project.name}.png`,
    fullPage: true,
  });
});
test('missing AI configuration is explicit while local file import remains available', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/app/assistant');
  await expect(page.getByRole('status')).toContainText('טרם הוגדר');
  await expect(page.getByRole('button', { name: 'שליחה', exact: true })).toBeDisabled();
  await page.goto('/app/resumes');
  await page.getByText('הוספת גרסה חדשה', { exact: true }).click();
  await expect(page.getByText(/הקובץ נקרא בדפדפן בלבד/)).toBeVisible();
  await expect(page.getByLabel('קובץ לבדיקה', { exact: true })).toBeEnabled();
});
test('late filter responses cannot replace a newer search', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/feed?**', async (r) => {
    const q = new URL(r.request().url()).searchParams.get('q');
    if (q === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await r
        .fulfill({
          json: {
            jobs: [jobs[0]],
            total: 1,
            stale: false,
            nextCursor: null,
            snapshot: 'slow',
            fetchedAt: '',
          },
        })
        .catch(() => {});
    } else await r.fallback();
  });
  await page.goto('/app/jobs');
  await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).fill('slow');
  await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).fill('Software Test');
  await expect(page.locator('niva-job-card')).toHaveCount(1);
  await expect(page.locator('niva-job-card')).toContainText('Software Test');
  await expect(page.locator('niva-job-card h3')).not.toContainText('QA Automation');
});
test('stopping chat aborts the request and preserves a retry without saving a partial answer', async ({
  page,
}) => {
  await fixture(page, { ai: true });
  let started = false;
  await page.route('**/api/career/chat', async (route) => {
    started = true;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route
      .fulfill({
        contentType: 'text/event-stream',
        body: 'event: delta\ndata: {"text":"late answer"}\n\n',
      })
      .catch(() => {});
  });
  await page.goto('/app/assistant');
  await page.getByRole('checkbox', { name: /אני מסכים/ }).check();
  await page.getByLabel('ההודעה שלך', { exact: true }).fill('Please help with interview questions');
  await page.getByRole('button', { name: 'שליחה', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: 'עצירת תשובה', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('נעצרה ולא נשמרה');
  await expect(page.getByRole('log')).not.toContainText('late answer');
  await expect(page.getByLabel('ההודעה שלך', { exact: true })).toHaveValue(
    'Please help with interview questions',
  );
  await expect(page.getByRole('button', { name: 'ניסיון חוזר', exact: true })).toBeEnabled();
});

test('resume switching and repeated selection preserve unsaved edits; tailoring requires saved facts', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/app/resumes?job=greenhouse-appsflyer-101');
  await page.getByRole('button', { name: original.name, exact: true }).click();
  await page.getByRole('button', { name: 'יצירת טיוטה מותאמת למשרה', exact: true }).click();
  const tailored = page.getByLabel('אחרי — טיוטה לעריכה', { exact: true });
  await tailored.fill(original.text + '\nUnsaved tailored fact');
  await page.getByRole('button', { name: original.name, exact: true }).click();
  const editor = page.getByLabel('טקסט לבדיקה ולתיקון', { exact: true });
  await editor.fill(original.text + '\nUnsaved original fact');
  await page.getByRole('button', { name: original.name, exact: true }).click();
  await expect(editor).toHaveValue(original.text + '\nUnsaved original fact');
  await page.getByRole('button', { name: 'יצירת טיוטה מותאמת למשרה', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('לשמור ולאשר');
  await page
    .locator('.career-version')
    .filter({ hasText: 'טיוטה לבדיקה' })
    .getByRole('button')
    .first()
    .click();
  await expect(tailored).toHaveValue(original.text + '\nUnsaved tailored fact');
});
test('reopening a conversation restores verified links with changed and closed status', async ({
  page,
}) => {
  await fixture(page, { ai: true });
  await page.route('**/api/career/conversations', (r) =>
    r.fulfill({
      json: [
        {
          id: 'persisted-chat',
          createdAt: '2026-10-24T10:00:00Z',
          expiresAt: '2026-11-24T10:00:00Z',
          messages: [
            { role: 'user', text: 'Saved conversation' },
            {
              role: 'assistant',
              text: 'Checked [job:greenhouse-appsflyer-101]',
              references: [
                {
                  id: jobs[0].id,
                  title: jobs[0].title,
                  company: jobs[0].company,
                  version: 'old-v1',
                  checkedAt: '2026-10-24T10:00:00Z',
                  status: 'closed',
                },
              ],
            },
          ],
        },
      ],
    }),
  );
  await page.goto('/app/assistant');
  await page.getByRole('button', { name: 'Saved conversation', exact: true }).click();
  await expect(page.getByRole('link', { name: /משרת בדיקת ממשק — QA Automation/ })).toHaveAttribute(
    'href',
    '/app/jobs/' + jobs[0].id,
  );
  await expect(page.getByText(/המשרה נסגרה/)).toBeVisible();
  await expect(page.getByText(/ביטול צירוף קורות החיים/)).toBeVisible();
});
