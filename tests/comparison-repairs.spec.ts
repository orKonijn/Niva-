import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { reviewFixture } from './ui-review-fixture';
import { normalizeJobicy } from '../server/jobicy-source';

// Same synthetic API response, viewport and theme in both captures. The before
// image uses the previous compiled UI; no fabricated before-state styling.
test('comparison repairs show residence and alternative requirements accessibly', async ({
  page,
  context,
}, info) => {
  await reviewFixture(context);
  const job = normalizeJobicy(
    {
      jobs: [
        {
          id: 151013,
          url: 'https://jobicy.com/jobs/151013-synthetic-engineer',
          jobTitle: 'Synthetic Test Engineer',
          companyName: 'Synthetic Employer',
          jobGeo: 'Anywhere',
          jobDescription:
            '<h2>What we are looking for in you</h2><ul><li>Experience with Python or Go development.</li><li>Experience with SQL.</li><li>Candidate must be located within Schengen Area.</li></ul><h2>Nice-to-have skills</h2><ul><li>Experience with AWS.</li></ul>',
          pubDate: '2026-10-27T10:00:00Z',
        },
      ],
    },
    '2026-10-27T10:00:00Z',
  )[0];
  await context.route('**/api/listings/**', (r) => r.fulfill({ json: job }));
  await page.goto('/app/jobs/' + job.id);
  const panel = page.getByRole('region', { name: 'דרישות ועדויות מהמקור' });
  await expect(panel).toBeVisible();
  const phase = process.env['NIVA_COMPARISON_BEFORE'] ? 'before' : 'after';
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `docs/screenshots/changes/comparison-repairs/${info.project.name}-${phase}.png`,
    fullPage: true,
  });
  if (phase === 'before') return;
  await expect(panel).toContainText('אחת מהחלופות');
  await expect(panel).toContainText('Python / Go');
  await expect(panel).toContainText('אזור שנגן');
  await expect(page.getByRole('heading', { name: 'Nice-to-have skills' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
});
