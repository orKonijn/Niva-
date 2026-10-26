import { readFileSync, writeFileSync } from 'node:fs';
import { discoveryRank, matchesDiscoverySearch } from '../src/app/core/discovery-ranking';
import { assessJob } from '../src/app/core/job-assessment';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { defaultPreferences } from '../src/app/core/preferences';
import type { Job } from '../src/app/core/models/job';
const marker = '.test-data/repair42/fresh-public.json';
const fetchData = process.argv.includes('--fetch');
let data: any;
if (fetchData) {
  const samples = [];
  for (const q of ['Engineer', 'QA']) {
    const url = 'https://getnivajobs.com/api/feed?scope=all&limit=50&q=' + q;
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) throw Error('FRESH_FEED_UNAVAILABLE');
    const body = (await r.json()) as any;
    samples.push({ url, at: new Date().toISOString(), total: body.total, jobs: body.jobs });
  }
  data = {
    observedAt: new Date().toISOString(),
    samples,
    jobs: [...new Map(samples.flatMap((s) => s.jobs).map((j: any) => [j.id, j])).values()],
  };
  writeFileSync(marker, JSON.stringify(data, null, 2));
} else data = JSON.parse(readFileSync(marker, 'utf8'));
const c = {
  ...emptyCriteria(),
  confirmed: true,
  skills: ['Python', 'TypeScript', 'Playwright', 'Selenium', 'SQL', 'APIs', 'GitHub Actions'],
  yearsExperience: 5,
  currentCountry: 'IL',
  authorizationCountry: 'IL',
  workAuthorization: 'authorized' as const,
  authorizationExclusive: true,
  citizenshipCountry: 'US',
  citizenshipStatus: 'not-citizen' as const,
};
const p = {
  ...defaultPreferences(),
  role: 'qa-automation' as const,
  district: 'tel-aviv' as const,
  workStyles: ['onsite', 'hybrid', 'remote'] as ('onsite' | 'hybrid' | 'remote')[],
};
// Independently reviewed role labels for this bounded fresh sample, not inferred from ranking scores.
const originalQuality: Record<string, number> = {
  'greenhouse-canopycare-5285235008': 2,
  'greenhouse-transmitsecurity-8887486002': 1,
  'greenhouse-unframe-4904270101': 1,
  'greenhouse-unframe-5003021101': 1,
  'greenhouse-wedev-4652209101': 0,
  'jobicy-israel-qa-156544': 1,
  'lever-veeva-israel-fdca1089-4737-4b89-8fa7-03c36262d3ab': 1,
  'jobicy-israel-qa-144408': 0,
};
const labels = data.jobs.map((j: Job) => ({
  id: j.id,
  title: j.title,
  company: j.company,
  grade: originalQuality[j.id] ?? 0,
  reason:
    originalQuality[j.id] != null
      ? 'QA role/seniority judgment rechecked in original audit cohort; LQA language/gaming and junior role limitations retained'
      : 'Not a QA target role in this sample; independently inspected title and available requirements',
  eligibility: assessJob(j, p, '', false, c).eligibility,
}));
const measures = [];
for (const [name, rank, related] of [
  ['baseline-literal-source', false, false],
  ['same-pool-global-order', true, false],
  ['explicit-QA-alias-global-order', true, true],
] as const) {
  const jobs = (data.jobs as Job[]).filter(
    (j) =>
      matchesDiscoverySearch(j, 'Engineer', related) &&
      assessJob(j, p, '', false, c).eligibility !== 'blocked',
  );
  jobs.sort((a, b) =>
    rank
      ? discoveryRank(b, 'Engineer', p, c).rank - discoveryRank(a, 'Engineer', p, c).rank ||
        a.id.localeCompare(b.id)
      : a.id.localeCompare(b.id),
  );
  const precision = (k: number) => {
    const ids = jobs.slice(0, k).map((j) => j.id);
    const useful = ids.filter((id) => labels.find((r: any) => r.id === id)?.grade >= 1).length;
    return { n: ids.length, relevant: useful, value: ids.length ? useful / ids.length : null };
  };
  measures.push({
    name,
    p10: precision(10),
    p20: precision(20),
    n: jobs.length,
    ids: jobs.map((j) => j.id),
  });
}
writeFileSync(
  'docs/verification/relevance42-fresh.json',
  JSON.stringify(
    {
      observedAt: data.observedAt,
      n: data.jobs.length,
      sourceQueries: data.samples.map((s: any) => ({
        url: s.url,
        at: s.at,
        total: s.total,
        n: s.jobs.length,
      })),
      method:
        'Purposive bounded sample: first50 public Engineer plus all available QA results. Not a full catalog evaluation or a random inventory estimate. QA lead/gaming/AI/Java qualifications remain unresolved. Grade>=1 is role relevance only; explicit blockers excluded separately.',
      labels,
      measures,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ n: data.jobs.length, measures: measures.map(({ ids, ...m }) => m) }, null, 2),
);
