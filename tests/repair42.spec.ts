import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { auditJobs } from './audit40-data';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
import AxeBuilder from '@axe-core/playwright';
import type { Job } from '../src/app/core/models/job';
for (const theme of ['light', 'dark'] as const)
  test(`repair42 structure freshness and catalog ordering in ${theme}`, async ({
    page,
    context,
  }, info) => {
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.preferences = {
      role: 'qa-automation',
      district: 'tel-aviv',
      workStyles: [],
      exclusions: '',
    };
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    const sql = new DatabaseSync(':memory:');
    for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
      sql.exec(readFileSync('server/migrations/' + m + '.sql', 'utf8'));
    const publicJobs = auditJobs();
    const jobs: Job[] = [];
    for (let i = 0; i < 82; i++) {
      const j = structuredClone(publicJobs[0]);
      j.id = 'greenhouse-canopycare-' + (7000000 + i);
      j.title = i < 60 ? 'Synthetic Sales Engineer' : 'Synthetic QA Automation Engineer';
      j.category = i < 60 ? 'engineering' : 'qa-automation';
      if (i === 80) j.title = 'Distributed Systems Testing Software Engineer';
      if (i === 81) j.title = 'Synthetic Manufacturing Quality Engineer';
      j.source!.applicationUrl =
        'https://job-boards.greenhouse.io/canopycare/jobs/' + (7000000 + i);
      jobs.push(j);
    }
    const insert = sql.prepare(
      'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
    );
    for (const j of jobs)
      insert.run(
        j.id,
        'greenhouse-canopycare',
        j.source!.applicationUrl,
        j.company.toLowerCase(),
        j.title.toLowerCase(),
        j.district,
        j.category,
        j.workStyle,
        j.title.toLowerCase(),
        'repair42',
        JSON.stringify(j),
      );
    sql
      .prepare(
        "INSERT INTO niva_sources(id,checked_at,error) VALUES('greenhouse-canopycare','2026-10-25T10:00:00Z','SOURCE_UNAVAILABLE'),('greenhouse-wedev','2026-10-26T11:00:00Z',NULL)",
      )
      .run();
    sql
      .prepare(
        "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','source-attempt','greenhouse-canopycare','{\"attemptedAt\":\"2026-10-26T12:00:00Z\"}',9007199254740991)",
      )
      .run();
    await context.route('**/api/feed**', async (r) =>
      r.fulfill({
        json: await discoveryPage(
          sqliteCareerDb(sql),
          'repair42',
          Object.fromEntries(new URL(r.request().url()).searchParams),
          state.preferences,
        ),
      }),
    );
    await context.route('**/api/listings/**', (r) => {
      const id = r.request().url().split('/').at(-1);
      const job = publicJobs.find((j) => j.id === id) ?? jobs.find((j) => j.id === id);
      return r.fulfill({ status: job ? 200 : 404, json: job ?? { error: 'NOT_FOUND' } });
    });
    const root = `docs/screenshots/changes/repair42/${info.project.name}-${theme}`;
    try {
      await page.goto('/app/jobs/greenhouse-canopycare-5285235008');
      await expect(page.getByRole('heading', { name: 'Your Mission', exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Your Mission', exact: true, level: 3 }),
      ).toBeVisible();
      expect(await page.locator('niva-job-description').locator('li').count()).toBeGreaterThan(20);
      await page.locator('niva-job-description').screenshot({ path: root + '-description.png' });
      await page.goto('/app/jobs?scope=all&q=Engineer&sort=relevance');
      await expect(page.locator('niva-job-card')).toHaveCount(50);
      await expect(page.locator('niva-job-card').first().getByRole('heading')).toContainText(
        'QA Automation',
      );
      for (let i = 0; i < 20; i++)
        await expect(page.locator('niva-job-card').nth(i).getByRole('heading')).toContainText(
          'QA Automation',
        );
      await page.getByRole('link', { name: 'לתוצאות החיפוש', exact: true }).click();
      await page.screenshot({ path: root + '-ranking.png' });
      await page.goto('/app/jobs?scope=all&q=Engineer&related=true&sort=relevance');
      await expect(page.locator('niva-job-card')).toHaveCount(21);
      await expect(
        page.getByRole('heading', {
          name: 'Distributed Systems Testing Software Engineer',
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(page.getByRole('status').filter({ hasText: /מתוך/ })).toHaveText(/21 מתוך 21/);
      await page.goto('/app/jobs?scope=all&q=Engineer&sort=relevance');
      await page.getByRole('combobox', { name: 'מיון המשרות' }).selectOption('source');
      await expect(page.locator('niva-job-card').first().getByRole('heading')).toContainText(
        'Sales Engineer',
      );
      await page.getByText('מקורות ומועדי בדיקה (2)', { exact: true }).click();
      await expect(page.getByText(/בדיקת המקור המוצלחת החדשה ביותר:/)).toContainText(
        '2026-10-26T11:00:00Z',
      );
      await expect(page.getByText(/בדיקת המקור המוצלחת הישנה ביותר:/)).toContainText(
        '2026-10-25T10:00:00Z',
      );
      await expect(page.getByText(/ניסיון בדיקת המקור האחרון/)).toContainText(
        '2026-10-26T12:00:00Z',
      );
      await page
        .locator('details')
        .filter({ hasText: 'משרות מהלוחות המחוברים' })
        .screenshot({ path: root + '-freshness.png' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    } finally {
      sql.close();
    }
  });
