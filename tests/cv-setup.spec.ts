import { test, expect } from '@playwright/test';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { zipSync, strToU8 } from 'fflate';
import { responsePolicy } from '../server/deployment-policy';
import type { ResumeVersion } from '../src/app/core/models/career';
import AxeBuilder from '@axe-core/playwright';

const candidate = 'Synthetic Candidate\nPython SQL experience 2020–2026';
const docx = () =>
  Buffer.from(
    zipSync({
      'word/document.xml': strToU8(
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${candidate}</w:t></w:r></w:p></w:body></w:document>`,
      ),
    }),
  );
function pdfFixture() {
  const stream =
    'BT /F1 12 Tf 40 700 Td (Synthetic Candidate Python SQL experience 2020-2026) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((value) => String(value).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}

for (const theme of ['light', 'dark'] as const) {
  test(`CV file entry is available in ${theme}`, async ({ context, page }, info) => {
    await reviewFixture(context, true);
    const account = emptyAccountState();
    account.theme = theme;
    await context.route('**/api/account/state', (r) => r.fulfill({ json: account }));
    await page.goto('/app/resumes');
    await expect(page.getByRole('heading', { name: 'מתחילים מטקסט' })).toBeVisible();
    const directory = `docs/screenshots/changes/cv-import-${info.project.name}-${theme}`;
    if (process.env['CV_BEFORE']) {
      await page.screenshot({ path: `${directory}/before.png`, fullPage: true });
      return;
    }
    await expect(page.getByLabel('קובץ לבדיקה', { exact: true })).toBeEnabled();
    await page.screenshot({ path: `${directory}/after.png`, fullPage: true });
  });
}

for (const extension of ['pdf', 'docx'] as const) {
  test(`${extension} is parsed locally under production CSP and requires review before any server write`, async ({
    context,
    page,
  }) => {
    await reviewFixture(context, true);
    const writes: unknown[] = [];
    await context.route('**/api/career/resumes', (r) => {
      if (r.request().method() === 'POST') writes.push(r.request().postDataJSON());
      return r.fulfill({ json: {} });
    });
    await context.route('**/app/resumes', async (r) => {
      const response = await r.fetch();
      return r.fulfill({
        response,
        headers: { ...response.headers(), ...responsePolicy(new URL(r.request().url())) },
      });
    });
    await page.goto('/app/resumes');
    await page.getByLabel('קובץ לבדיקה', { exact: true }).setInputFiles({
      name: `synthetic.${extension}`,
      mimeType:
        extension === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: extension === 'pdf' ? pdfFixture() : docx(),
    });
    await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue(
      /Synthetic Candidate/,
    );
    expect(writes).toEqual([]);
    await expect(
      page.getByRole('button', { name: 'שמירת טיוטה לבדיקה', exact: true }),
    ).toBeEnabled();
  });
}

test('invalid, oversized and compressed oversized files give a recoverable error', async ({
  context,
  page,
}) => {
  await reviewFixture(context, true);
  await page.goto('/app/resumes');
  for (const [name, buffer] of [
    ['bad.pdf', Buffer.from('not a PDF')],
    ['large.pdf', Buffer.alloc(10_000_001)],
    ['bomb.docx', Buffer.from(zipSync({ 'word/document.xml': strToU8('a'.repeat(2_000_001)) }))],
  ] as const) {
    await page
      .getByLabel('קובץ לבדיקה', { exact: true })
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue('');
  }
  await page
    .getByLabel('קובץ לבדיקה', { exact: true })
    .setInputFiles({ name: 'valid.docx', mimeType: 'application/octet-stream', buffer: docx() });
  await expect(page.getByLabel('טקסט קורות החיים', { exact: true })).toHaveValue(candidate);
});

for (const theme of ['light', 'dark'] as const) {
  test(`new accounts confirm a CV and preferences before the workspace in ${theme}`, async ({
    context,
    page,
  }, info) => {
    await reviewFixture(context, true);
    const account = emptyAccountState();
    account.theme = theme;
    let versions: ResumeVersion[] = [],
      failPreferences = true,
      created = 0;
    await context.route('**/api/config', (r) =>
      r.fulfill({
        json: {
          accounts: true,
          setupRequired: true,
          platform: 'sites',
          realJobs: true,
          discovery: true,
          google: true,
          email: false,
          apple: false,
        },
      }),
    );
    await context.route('**/api/account/state', (r) => {
      if (r.request().method() === 'POST') {
        if (failPreferences) {
          failPreferences = false;
          return r.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } });
        }
        const input = r.request().postDataJSON();
        expect(input.operation.type).toBe('complete-setup');
        expect(versions.some((version) => version.active && version.confirmed)).toBe(true);
        account.preferences = input.operation.value;
        account.setupCompleted = true;
        account.revision++;
      }
      return r.fulfill({ json: account });
    });
    await context.route('**/api/career/snapshot', (r) =>
      r.fulfill({
        json: {
          epoch: 'fixture',
          erasure: 'fixture',
          revision: JSON.stringify(versions),
          resumes: versions,
          config: { ai: false, uploads: false, retentionDays: 30, maxUploadBytes: 750000 },
          operations: null,
        },
      }),
    );
    await context.route('**/api/career/resumes**', (r) => {
      const path = new URL(r.request().url()).pathname;
      if (path.endsWith('/resumes')) {
        created++;
        const input = r.request().postDataJSON();
        versions = [
          {
            id: 'setup-resume',
            ...input,
            kind: 'original',
            confirmed: false,
            active: false,
            createdAt: new Date().toISOString(),
            expiresAt: '2099-01-01T00:00:00Z',
          },
        ];
      } else if (path.endsWith('/review')) versions[0].confirmed = true;
      else if (path.endsWith('/activate')) versions[0].active = true;
      return r.fulfill({ json: versions[0] });
    });
    await page.goto('/app/jobs?q=Python');
    await expect(page).toHaveURL(/\/setup\?/);
    await expect(page.getByRole('heading', { name: 'שלב 1 · קורות החיים שלך' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `docs/screenshots/changes/account-setup-${info.project.name}-${theme}/cv-step.png`,
      fullPage: true,
    });
    await expect(page.getByRole('button', { name: 'שמירה והמשך להעדפות' })).toBeDisabled();
    await page.getByLabel('טקסט קורות החיים', { exact: true }).fill(candidate);
    await page.getByRole('checkbox', { name: /בדקתי את הטקסט והעובדות נכונות/ }).check();
    await page.getByRole('button', { name: 'שמירה והמשך להעדפות' }).click();
    await expect(page.getByRole('heading', { name: 'שלב 2 · מה מתאים לך?' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'שלב 2 · מה מתאים לך?' })).toBeVisible();
    await page.getByLabel('תחום שמעניין אותך').selectOption('qa-automation');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `docs/screenshots/changes/account-setup-${info.project.name}-${theme}/preferences-step.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'שמירת ההעדפות וכניסה למרחב שלי' }).click();
    await expect(page.getByRole('alert')).toContainText('ההעדפות לא נשמרו');
    await expect(page).toHaveURL(/\/setup\?/);
    await page.getByRole('button', { name: 'שמירת ההעדפות וכניסה למרחב שלי' }).click();
    await expect(page).toHaveURL('/app/jobs?q=Python');
    expect(created).toBe(1);
    await page.reload();
    await expect(page).toHaveURL('/app/jobs?q=Python');
    versions = [];
    await page.goto('/app');
    await expect(page).toHaveURL(/\/setup\?/);
    await expect(page.getByRole('heading', { name: 'שלב 1 · קורות החיים שלך' })).toBeVisible();
  });
}

test('anonymous visitors sign in before setup or workspace entry', async ({ context, page }) => {
  await reviewFixture(context, true);
  await context.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        accounts: true,
        setupRequired: true,
        realJobs: true,
        google: true,
        email: false,
        apple: false,
      },
    }),
  );
  await context.route('**/api/session', (r) => r.fulfill({ json: { user: null } }));
  for (const path of ['/app', '/app/jobs', '/signup', '/setup']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  }
});
