import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { reviewFixture } from './ui-review-fixture';
import { auditJobs } from './audit40-data';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { emptyCriteria } from '../src/app/core/models/discovery';
const before = process.env['AUDIT40_BEFORE'] === '1';
for (const theme of ['light', 'dark'] as const)
  test(`audit40 public evidence in ${theme}`, async ({ page, context }, info) => {
    test.setTimeout(90000);
    await reviewFixture(context);
    const state = emptyAccountState();
    state.theme = theme;
    state.preferences = {
      role: 'qa-automation',
      district: 'tel-aviv',
      workStyles: ['onsite', 'hybrid', 'remote'],
      exclusions: '',
    };
    state.profile.criteria = {
      ...emptyCriteria(),
      confirmed: true,
      skills: ['Python', 'TypeScript', 'SQL', 'QA Automation'],
      yearsExperience: 5,
      currentCountry: 'IL',
      authorizationCountry: 'IL',
      workAuthorization: 'authorized',
      authorizationExclusive: true,
      citizenshipCountry: 'US',
      citizenshipStatus: 'not-citizen',
    };
    await context.route('**/api/account/state', (r) => r.fulfill({ json: state }));
    const jobs = auditJobs(before);
    const sql = new DatabaseSync(':memory:');
    for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
      sql.exec(readFileSync(`server/migrations/${m}.sql`, 'utf8'));
    const insert = sql.prepare(
      'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
    );
    for (const j of jobs)
      insert.run(
        j.id,
        j.source!.sourceId!,
        j.source!.applicationUrl,
        j.company.toLowerCase(),
        j.title.toLowerCase(),
        j.district,
        j.category,
        j.workStyle,
        `${j.title} ${j.company}`.toLowerCase(),
        j.source!.version ?? 'audit40',
        JSON.stringify(j),
      );
    await context.route('**/api/feed**', async (r) => {
      const p = Object.fromEntries(new URL(r.request().url()).searchParams);
      await r.fulfill({
        json: await discoveryPage(
          sqliteCareerDb(sql),
          'audit40-synthetic',
          p,
          state.preferences,
          state.saved,
          state.profile.criteria,
        ),
      });
    });
    await context.route('**/api/listings/**', (r) => {
      const job = jobs.find((j) => r.request().url().endsWith(j.id));
      return r.fulfill({ status: job ? 200 : 404, json: job ?? { error: 'NOT_FOUND' } });
    });
    const root = `docs/screenshots/changes/audit40-${info.project.name}-${theme}`;
    const shot = async (name: string, selector = 'main') =>
      page
        .locator(selector)
        .screenshot({ path: `${root}-${name}/${before ? 'before' : 'after'}.png` });
    try {
      await page.goto(
        '/app/jobs?scope=all&q=QA&category=qa-automation&styles=hybrid&unknownStyle=false',
      );
      await expect(page.getByRole('status').filter({ hasText: /מתוך/ })).toHaveText(
        before ? /0 מתוך 0/ : /2 מתוך 2/,
      );
      await shot('arrangement');
      if (!before) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const search = await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).boundingBox();
        expect(search!.y + search!.height).toBeLessThan(page.viewportSize()!.height);
        writeFileSync(
          `.test-data/audit40/${info.project.name}-${theme}-layout.json`,
          JSON.stringify({
            viewport: page.viewportSize(),
            search,
            deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
          }),
        );
        await page.screenshot({ path: `${root}-first-screen/after.png` });
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
        await context.route('https://tile.openstreetmap.org/**', (r) => r.abort());
        await page.getByRole('button', { name: 'מפה', exact: true }).click();
        await expect(
          page
            .locator('[aria-label="רשימת מיקומים נגישה"]')
            .getByRole('link', { name: /QA.*Automation/ }),
        ).toHaveCount(2);
        await page.getByRole('button', { name: 'רשימה', exact: true }).click();
        await page
          .getByRole('button', { name: 'הסרת סינון: אופן עבודה: היברידי', exact: true })
          .click();
        await expect(page.locator('niva-job-card')).toHaveCount(3);
        await page.goBack();
        await expect(page.locator('niva-job-card')).toHaveCount(2);
      }
      await page.goto('/app/jobs/greenhouse-unframe-4904270101');
      await expect(page.getByRole('heading', { name: 'QA Engineer', exact: true })).toBeVisible();
      await page.locator('niva-match-indicator summary').click();
      await shot('requirements', 'niva-match-indicator');
      if (!before)
        await expect(page.locator('niva-match-indicator')).not.toContainText('Product Management');
      await page.goto('/app/jobs/greenhouse-canopycare-5285235008');
      await expect(
        page.getByRole('heading', { name: 'QA & Automation Engineer', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('heading', { name: 'קצת על התפקיד', exact: true })
        .locator('..')
        .screenshot({ path: `${root}-description/${before ? 'before' : 'after'}.png` });
      if (!before) {
        await expect(page.locator('niva-job-description h3')).not.toHaveCount(0);
        await expect(page.locator('niva-job-description li')).not.toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.goto(
        '/app/jobs?scope=all&eligibility=all&q=Senior%20Sales%20Engineer%20-%20Key%20Accounts',
      );
      await expect(page.locator('niva-job-card')).toHaveCount(1);
      await shot('salary', 'niva-job-card');
      if (!before)
        await expect(page.locator('niva-job-card')).toContainText('149000–198000 USD / שנה');
      await page.goto('/app/jobs/greenhouse-jfrog-8185306');
      await expect(page.getByRole('heading', { name: /Senior Solution Engineer/ })).toBeVisible();
      await page.locator('niva-match-indicator summary').click();
      await shot('eligibility', 'niva-match-indicator');
      if (!before) await expect(page.locator('niva-match-indicator')).toContainText('אזרחות US');
      if (!before && info.project.name === 'mobile') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(
          '/app/jobs?scope=all&q=QA&category=qa-automation&styles=hybrid&unknownStyle=false',
        );
        await expect(page.locator('niva-job-card')).toHaveCount(2);
        await page.evaluate(() => window.scrollTo(0, 0));
        const search = await page.getByLabel('חיפוש תפקיד או חברה', { exact: true }).boundingBox();
        expect(search!.y + search!.height).toBeLessThan(844);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: `${root}-390x844/after.png` });
      }
    } finally {
      await page.close();
      sql.close();
    }
  });
