import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
import { enrichJob } from '../server/job-facts';
import { classify } from '../server/job-feed';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { assessJob } from '../src/app/core/job-assessment';
import { defaultPreferences } from '../src/app/core/preferences';
import type { Job } from '../src/app/core/models/job';

// Labels are fixed before measurement; held-out rows must not be used for weight tuning.
const labels = JSON.parse(readFileSync('docs/verification/relevance42-labels.json', 'utf8'));
const criteria = {
  ...emptyCriteria(),
  confirmed: true,
  skills: ['Python', 'TypeScript', 'Playwright', 'Selenium', 'SQL', 'APIs', 'GitHub Actions'],
  yearsExperience: 5,
  currentCountry: 'IL',
  authorizationCountry: 'IL',
  authorizationExclusive: true,
  workAuthorization: 'authorized' as const,
  citizenshipCountry: 'US',
  citizenshipStatus: 'not-citizen' as const,
};
const preferences = {
  ...defaultPreferences(),
  role: 'qa-automation' as const,
  district: 'tel-aviv' as const,
  workStyles: ['onsite', 'hybrid', 'remote'] as ('onsite' | 'hybrid' | 'remote')[],
};
const fixture = (r: any): Job => {
  const job: Job = {
    id: r.id,
    title: r.title,
    company: 'Synthetic evaluation only',
    initials: 'EV',
    color: '#eef',
    category: classify(r.title),
    district: r.country === 'IL' ? 'tel-aviv' : 'unknown',
    workStyle: 'remote',
    posted: 'Evaluation fixture',
    description: r.description,
    skills: [],
    reason: 'Synthetic labelled fixture; never publish as vacancy',
    offices: [],
    source: {
      kind: 'real',
      sourceId: 'evaluation-only',
      name: 'Synthetic evaluation',
      url: 'https://example.test',
      applicationUrl: 'https://example.test/' + r.id,
      updatedAt: '2026-10-26T00:00:00Z',
      fetchedAt: '2026-10-26T00:00:00Z',
      location:
        r.country === 'IL'
          ? 'Tel Aviv, Israel'
          : r.country === 'US'
            ? 'Remote, United States'
            : 'Remote location not supplied',
      active: true,
      classification: 'Synthetic labelled diagnostic fixture',
    },
  };
  return enrichJob(job);
};
const results: any[] = [];
for (const split of ['development', 'heldout']) {
  const rows = labels.records.filter((r: any) => r.split === split),
    sql = new DatabaseSync(':memory:');
  for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
    sql.exec(readFileSync('server/migrations/' + m + '.sql', 'utf8'));
  const jobs: Job[] = rows.map(fixture);
  const insert = sql.prepare(
    'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
  );
  for (const j of jobs)
    insert.run(
      j.id,
      'evaluation-only',
      j.source!.applicationUrl,
      j.company.toLowerCase(),
      j.title.toLowerCase(),
      j.district,
      j.category,
      j.workStyle,
      j.title.toLowerCase(),
      'evaluation-v1',
      JSON.stringify(j),
    );
  const modes: any[] = [];
  for (const [mode, sort, related] of [
    ['baseline-literal-source', 'source', 'false'],
    ['same-pool-global-order', 'relevance', 'false'],
    ['explicit-QA-alias-global-order', 'relevance', 'true'],
  ]) {
    const feed = await discoveryPage(
      sqliteCareerDb(sql),
      'evaluation-only-secret',
      { scope: 'all', q: 'Engineer', sort, related, limit: '50' },
      preferences,
      [],
      criteria,
    );
    const ordered = feed.jobs.map((j) => rows.find((r: any) => r.id === j.id));
    const relevant = (r: any) => r.relevance >= 1 && r.eligibility !== 'blocked';
    const precision = (k: number) => {
      const sample = ordered.slice(0, k);
      return {
        n: sample.length,
        relevant: sample.filter(relevant).length,
        value: sample.length ? sample.filter(relevant).length / sample.length : null,
      };
    };
    const useful = rows.filter(relevant).length;
    modes.push({
      mode,
      candidateCount: feed.total,
      p10: precision(10),
      p20: precision(20),
      recall: useful ? ordered.filter(relevant).length / useful : null,
      explicitBlockedReturned: ordered.filter((r: any) => r.eligibility === 'blocked').length,
      unknownEligibilityReturned: ordered.filter((r: any) => r.eligibility === 'unknown').length,
      ids: ordered.map((r: any) => r.id),
    });
  }
  const calibration = jobs.map((j, i) => ({
    id: j.id,
    label: rows[i].skillsPercent,
    oldComposite: assessJob(j, preferences, '', true, criteria).score,
    newTermCoverage: assessJob(j, preferences, '', true, criteria).skillsScore,
  }));
  const scored = calibration.filter((r) => r.label != null && r.newTermCoverage != null);
  results.push({
    split,
    n: rows.length,
    positive: rows.filter((r: any) => r.relevance >= 1 && r.eligibility !== 'blocked').length,
    modes,
    termCoverage: {
      n: scored.length,
      meanAbsolutePercentagePointError: scored.length
        ? scored.reduce((s, r) => s + Math.abs(r.newTermCoverage! - r.label), 0) / scored.length
        : null,
      withheld: calibration.filter((r) => r.newTermCoverage == null).length,
      legacyCompositeNotSameConstruct: true,
      rows: calibration,
    },
  });
  sql.close();
}
mkdirSync('docs/verification', { recursive: true });
const out = {
  generatedAt: new Date().toISOString(),
  labelDigest: createHash('sha256').update(JSON.stringify(labels)).digest('hex'),
  method:
    'Single-analyst labelled synthetic diagnostic corpus. Precision counts grade1/2 roles without explicit eligibility blockers; unknown is not confirmed eligible. Heldout not used for tuning. Source-ID order is the actual previous ordering. Full-catalog order measured separately from explicit alias retrieval. Not market prevalence or hiring calibration.',
  results,
};
writeFileSync('docs/verification/relevance42-results.json', JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    results.map((r) => ({
      split: r.split,
      n: r.n,
      modes: r.modes.map((m: any) => ({
        mode: m.mode,
        p10: m.p10,
        p20: m.p20,
        recall: m.recall,
        blocked: m.explicitBlockedReturned,
      })),
      termCoverage: {
        n: r.termCoverage.n,
        mae: r.termCoverage.meanAbsolutePercentagePointError,
        withheld: r.termCoverage.withheld,
      },
    })),
    null,
    2,
  ),
);
