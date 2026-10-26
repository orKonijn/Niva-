import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
import type { Job } from '../src/app/core/models/job';
const samples = JSON.parse(readFileSync('tests/fixtures/jsearch-public-20261025.json', 'utf8'))
  .jobs as Job[];
const before = process.env['REVIEW36_BEFORE'] === '1';
for (const theme of ['light', 'dark'] as const)
  test(`review36 fresh publisher context and consistent search in ${theme}`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(60000);
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    const jobs = [samples[0], samples[2]].map(
      (j, n) =>
        ({
          ...structuredClone(j),
          title: `Synthetic Product Manager ${n}`,
          company: 'Synthetic regression only',
          description: 'Synthetic fixture. Python SQL.',
          category: 'product',
          district: 'unknown',
          offices: [
            {
              id: 'tel-aviv',
              country: 'IL',
              district: 'tel-aviv',
              city: 'תל אביב',
              latitude: 32.08,
              longitude: 34.78,
              precision: 'city',
              coordinateSource: 'Synthetic regression fixture',
              demonstration: true,
            },
            {
              id: 'haifa',
              country: 'IL',
              district: 'haifa',
              city: 'חיפה',
              latitude: 32.79,
              longitude: 34.99,
              precision: 'city',
              coordinateSource: 'Synthetic regression fixture',
              demonstration: true,
            },
          ],
        }) as Job,
    );
    let mode: 'context' | 'search' = 'context';
    let feedRequests = 0;
    const requested: string[] = [];
    const sql = new DatabaseSync(':memory:');
    for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
      sql.exec(readFileSync(`server/migrations/${m}.sql`, 'utf8'));
    const j = jobs[0];
    sql
      .prepare(
        'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
      )
      .run(
        j.id,
        j.source!.sourceId!,
        j.source!.applicationUrl,
        j.company.toLowerCase(),
        j.title.toLowerCase(),
        j.district,
        j.category,
        j.workStyle,
        `${j.title} ${j.company}`.toLowerCase(),
        'synthetic-v1',
        JSON.stringify(j),
      );
    await context.route('**/api/feed**', async (r) => {
      feedRequests++;
      const p = Object.fromEntries(new URL(r.request().url()).searchParams);
      const result = await discoveryPage(
        sqliteCareerDb(sql),
        'synthetic-secret',
        p,
        state.preferences,
      );
      return r.fulfill({
        json: mode === 'context' ? { ...result, jobs: [], total: 0, nextCursor: null } : result,
      });
    });
    await context.route('**/api/listings/**', (r) => {
      const id = new URL(r.request().url()).pathname.split('/').at(-1)!;
      requested.push(id);
      const job = jobs.find((j) => j.id === id);
      return r.fulfill({ status: job ? 200 : 404, json: job ?? { error: 'NOT_FOUND' } });
    });
    const directory = `docs/screenshots/changes/review36-${info.project.name}-${theme}`;
    try {
      for (const [n, job] of jobs.entries()) {
        await page.goto('/app/jobs/' + job.id);
        if (before) await expect(page.getByText('המשרה לא נמצאה', { exact: true })).toBeVisible();
        else {
          await expect(page.getByRole('heading', { name: job.title, exact: true })).toBeVisible();
          expect(requested).toContain(job.id);
        }
        await page.locator('main').screenshot({
          path: `${directory}-${n ? 'indeed' : 'linkedin'}/${before ? 'before' : 'after'}.png`,
        });
        if (!before) {
          await page.reload();
          await expect(page.getByRole('heading', { name: job.title, exact: true })).toBeVisible();
          for (const route of ['assistant', 'resumes']) {
            await page.goto(`/app/${route}?job=${job.id}`);
            await expect(page.getByText(job.title, { exact: true }).first()).toBeVisible();
          }
        }
      }
      mode = 'search';
      await page.goto('/app/jobs?scope=all&q=%20Product%20Manager%20');
      await expect(page.locator('niva-job-card')).toHaveCount(before ? 0 : 1);
      await page
        .locator('main')
        .screenshot({ path: `${directory}-search/${before ? 'before' : 'after'}.png` });
      await page.goto('/app/jobs?scope=all&district=haifa');
      await expect(page.locator('niva-job-card')).toHaveCount(before ? 0 : 1);
      await expect(page.getByRole('status').filter({ hasText: /מתוך 1 משרות מהמקור/ })).toHaveText(
        before ? /0 מתוך 1/ : /1 מתוך 1/,
      );
      await page
        .locator('main')
        .screenshot({ path: `${directory}-office/${before ? 'before' : 'after'}.png` });
      if (!before) {
        await page.reload();
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        // Additional on-site map scenario; captured pairs above retain the original remote fixture.
        sql
          .prepare("UPDATE niva_jobs SET style='onsite',data=json_set(data,'$.workStyle','onsite')")
          .run();
        await page.reload();
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        await context.route('https://tile.openstreetmap.org/**', (r) => r.abort());
        await page.getByRole('button', { name: 'מפה', exact: true }).click();
        const locations = page.locator('[aria-label="רשימת מיקומים נגישה"]');
        await expect(
          locations.getByRole('button', { name: 'חיפה · 1 משרות באזור', exact: true }),
        ).toBeVisible();
        await expect(
          locations.getByRole('button', { name: 'תל אביב · 1 משרות באזור', exact: true }),
        ).toBeVisible();
        await expect(
          locations.getByRole('link', { name: /Synthetic Product Manager 0/ }),
        ).toHaveCount(2);
        await page.getByRole('button', { name: 'רשימה', exact: true }).click();
        await page.goto('/app/jobs?scope=all&q=Product%20Manager');
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        const count = feedRequests;
        await page
          .getByRole('textbox', { name: 'חיפוש תפקיד או חברה', exact: true })
          .fill(' Product Manager ');
        await expect(page).toHaveURL(/q=/);
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        expect(feedRequests).toBe(count);
        await page.goto('/app/jobs?scope=all&q=%20%20');
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        await page.goto('/app/jobs?scope=all&district=south');
        await expect(page.locator('niva-job-card')).toHaveCount(0);
        await page.goBack();
        await expect(page.locator('niva-job-card')).toHaveCount(1);
        await page.goForward();
        await expect(page.locator('niva-job-card')).toHaveCount(0);
        await page.goto('/app/jobs/jsearch-indeed-' + 'f'.repeat(24));
        await expect(page.getByText('המשרה לא נמצאה', { exact: true })).toBeVisible();
      }
      await page.goto('/terms');
      await page
        .locator('main')
        .screenshot({ path: `${directory}-copy/${before ? 'before' : 'after'}.png` });
    } finally {
      sql.close();
    }
  });
