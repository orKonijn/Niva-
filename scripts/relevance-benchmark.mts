import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  discoveryRank,
  matchesDiscoverySearch,
  RANKING_VERSION,
} from '../src/app/core/discovery-ranking';
import { passesDiscovery } from '../src/app/core/discovery-filters';
import {
  benchmarkCandidate,
  benchmarkPreferences,
  relevanceBenchmarkJobs,
  benchmarkScenarios,
} from '../tests/relevance-benchmark-data';
const output = process.argv[2] ?? '.test-data/relevance-benchmark-current.json';
const phase = 'current';
const observations = [];
for (const split of ['development', 'held-out'] as const) {
  const rows = relevanceBenchmarkJobs(split);
  for (const scenario of benchmarkScenarios) {
    const selected = rows.filter(
      ({ job }) =>
        passesDiscovery(
          job,
          { country: scenario.country },
          benchmarkPreferences,
          benchmarkCandidate,
        ) &&
        (!scenario.remote || job.workStyle === 'remote') &&
        matchesDiscoverySearch(job, scenario.query, scenario.related),
    );
    selected.sort(
      (a, b) =>
        discoveryRank(b.job, scenario.query, benchmarkPreferences, benchmarkCandidate).rank -
          discoveryRank(a.job, scenario.query, benchmarkPreferences, benchmarkCandidate).rank ||
        a.job.id.localeCompare(b.job.id),
    );
    const sample = selected.slice(0, 5);
    observations.push({
      split,
      scenario: scenario.id,
      total: selected.length,
      topFive: sample.map((r) => ({
        id: r.job.id,
        title: r.job.title,
        expectedSkillAligned: r.expectedSkillAligned,
        expectedQaFamily: r.expectedQaFamily,
        opportunity: r.opportunity,
        rank: discoveryRank(r.job, scenario.query, benchmarkPreferences, benchmarkCandidate),
      })),
      skillAlignedQaAt5: sample.length
        ? sample.filter((r) => r.expectedSkillAligned && r.expectedQaFamily).length / sample.length
        : null,
      explicitCountryConflicts: selected.filter(
        (r) => !r.job.facts?.applicantCountries?.value.includes('IL'),
      ).length,
    });
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      phase,
      ranking: RANKING_VERSION,
      observedAt: new Date().toISOString(),
      corpus:
        '32 frozen synthetic cases, development and held-out; five scenarios per split. Not market precision, live vacancies or proven actionability.',
      targetsFrozenBeforeChanges: {
        skillAlignedQaAt5: 'at least 0.8 for nonempty QA scenarios in each split',
        explicitCountryConflicts: 0,
        emptySearch: 'zero fabricated results',
        preserveAllDistinctResults: true,
      },
      observations,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' }, // Never silently overwrite historical benchmark evidence.
);
console.log(
  observations.map((o) => ({
    split: o.split,
    scenario: o.scenario,
    alignedAt5: o.skillAlignedQaAt5,
    total: o.total,
  })),
);
