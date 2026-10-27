import { expect, it } from 'vitest';
import { discoveryRank, matchesDiscoverySearch } from '../src/app/core/discovery-ranking';
import { normalizeJobicy } from './jobicy-source';
import { passesDiscovery } from '../src/app/core/discovery-filters';
import {
  benchmarkCandidate,
  benchmarkPreferences,
  relevanceBenchmarkJobs,
} from '../tests/relevance-benchmark-data';
import { jobOpportunity } from '../src/app/core/job-opportunity';
import { repairHarness } from './repair-harness';
import { discoveryPage } from './discovery';

it('ranks matching confirmed skills ahead of same-family jobs needing other tools', () => {
  for (const split of ['development', 'held-out'] as const) {
    const rows = relevanceBenchmarkJobs(split);
    const rank = (i: number) =>
      discoveryRank(rows[i].job, '', benchmarkPreferences, benchmarkCandidate).rank;
    expect(rank(6)).toBeGreaterThan(rank(1));
    expect(rank(5)).toBeGreaterThan(rank(1));
    expect(rank(6)).toBeGreaterThan(rank(0));
  }
});
it('keeps software customer-platform QA and rejects explicit non-software QA in related search', () => {
  const rows = relevanceBenchmarkJobs('development');
  expect(matchesDiscoverySearch(rows[5].job, 'QA', true)).toBe(true);
  expect(matchesDiscoverySearch(rows[11].job, 'QA', true)).toBe(false);
  expect(matchesDiscoverySearch(rows[12].job, 'QA', true)).toBe(false);
  expect(matchesDiscoverySearch(rows[11].job, 'QA', false)).toBe(true);
  const software = { ...rows[5].job, title: 'Software QA Engineer — Manufacturing Platform' };
  expect(matchesDiscoverySearch(software, 'QA', true)).toBe(true);
  expect(
    discoveryRank(software, '', benchmarkPreferences, benchmarkCandidate).reasons,
  ).not.toContain('תחום אחר בכותרת');
});
it('retains every explicitly allowed residence and does not turn a negated or partial list into a blocker', () => {
  const make = (text: string) =>
    normalizeJobicy(
      {
        jobs: [
          {
            id: 999001,
            url: 'https://jobicy.com/jobs/999001-synthetic',
            jobTitle: 'QA Engineer',
            companyName: 'Synthetic',
            jobDescription: `<p>${text}</p>`,
          },
        ],
      },
      '2026-10-27T10:00:00Z',
    )[0];
  const job = make('Candidates must be located in Italy or Israel.');
  expect(job.facts!.applicantCountries!.value).toEqual(['IT', 'IL']);
  expect(passesDiscovery(job, { country: 'IL' }, benchmarkPreferences, benchmarkCandidate)).toBe(
    true,
  );
  for (const text of [
    'Candidates are not required to live in Italy.',
    'Candidates must be located in Italy or Atlantis.',
    'Candidates must be located in Italy, Israel or Canada.',
  ]) {
    const row = make(text);
    if (text.endsWith('Canada.'))
      expect(row.facts!.applicantCountries!.value).toEqual(['IT', 'IL', 'CA']);
    else expect(row.facts!.applicantCountries).toBeNull();
  }
  const mixed = make('Candidates must be located within Schengen Area or Israel.');
  expect(mixed.facts!.applicantRegions).toBeNull();
  expect(mixed.facts!.locationConditions).toHaveLength(1);
  expect(passesDiscovery(mixed, { country: 'IL' }, benchmarkPreferences, benchmarkCandidate)).toBe(
    true,
  );
});

it('also ranks confirmed frontend skills and ignores unconfirmed profile evidence', () => {
  const rows = relevanceBenchmarkJobs('held-out');
  const preferences = { ...benchmarkPreferences, role: 'engineering' as const };
  expect(discoveryRank(rows[14].job, '', preferences, benchmarkCandidate).rank).toBeGreaterThan(
    discoveryRank(rows[13].job, '', preferences, benchmarkCandidate).rank,
  );
  const unknown = { ...benchmarkCandidate, confirmed: false };
  expect(discoveryRank(rows[14].job, '', preferences, unknown)).toEqual(
    discoveryRank(rows[14].job, '', preferences),
  );
});
it('retains source-provenanced pools through projection but does not label generic recruiting or closure as a talent pool', () => {
  const job = relevanceBenchmarkJobs('development')[6].job;
  delete job.facts;
  job.description = 'We are currently building a talent pool for future opportunities.';
  const enriched = normalizeJobicy(
    {
      jobs: [
        {
          id: 991001,
          url: 'https://jobicy.com/jobs/991001-synthetic',
          jobTitle: job.title,
          companyName: job.company,
          jobDescription: job.description,
        },
      ],
    },
    '2026-10-27T10:00:00Z',
  )[0];
  expect(enriched.facts!.opportunity?.quote).toContain('building a talent pool');
  enriched.description = '';
  expect(jobOpportunity(enriched)?.kind).toBe('talent-pool');
  delete job.facts;
  for (const text of [
    'This is not an open vacancy.',
    'We are not building a talent pool.',
    'Our recruiters support a talent pool.',
  ]) {
    job.description = text;
    expect(jobOpportunity(job)).toBeNull();
  }
});

it.each(['node', 'd1'] as const)(
  'globally ranks confirmed evidence on %s before totals and pagination, without dropping results',
  async (adapter) => {
    const h = repairHarness(adapter);
    try {
      const rows = relevanceBenchmarkJobs('held-out');
      for (const { job } of rows) {
        job.source!.version = 'relevance-case';
        await h.db.run(
          'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
          job.id,
          'jobicy-israel-qa',
          job.source!.applicationUrl,
          job.company.toLowerCase(),
          job.title.toLowerCase(),
          job.district,
          job.category,
          job.workStyle,
          job.title.toLowerCase(),
          'relevance-case',
          JSON.stringify(job),
        );
      }
      const query = { scope: 'all', sort: 'relevance', limit: '5' };
      const first = await discoveryPage(
        h.db,
        'synthetic-key',
        query,
        benchmarkPreferences,
        [],
        benchmarkCandidate,
      );
      expect(first.ranking.version).toBe('discovery-evidence-v2');
      expect(first.total).toBe(rows.length);
      expect(
        first.jobs.every(
          (j) =>
            rows.find((r) => r.job.id === j.id)?.expectedSkillAligned &&
            rows.find((r) => r.job.id === j.id)?.expectedQaFamily,
        ),
      ).toBe(true);
      const seen = new Set(first.jobs.map((j) => j.id));
      let cursor = first.nextCursor;
      while (cursor) {
        const next = await discoveryPage(
          h.db,
          'synthetic-key',
          { ...query, cursor },
          benchmarkPreferences,
          [],
          benchmarkCandidate,
        );
        for (const job of next.jobs) {
          expect(seen.has(job.id)).toBe(false);
          seen.add(job.id);
        }
        cursor = next.nextCursor;
      }
      expect(seen.size).toBe(rows.length);
      const related = await discoveryPage(
        h.db,
        'synthetic-key',
        { ...query, q: 'QA', related: 'true' },
        benchmarkPreferences,
        [],
        benchmarkCandidate,
      );
      expect(related.total).toBe(11);
      expect(related.jobs.every((j) => matchesDiscoverySearch(j, 'QA', true))).toBe(true);
      await expect(
        discoveryPage(
          h.db,
          'synthetic-key',
          { ...query, cursor: first.nextCursor! },
          benchmarkPreferences,
          [],
          { ...benchmarkCandidate, skills: ['Java'] },
        ),
      ).rejects.toThrow('CURSOR_EXPIRED');
    } finally {
      h.sqlite.close();
    }
  },
);
