import { readFileSync } from 'node:fs';
import type { Job } from '../src/app/core/models/job';
import { SOURCES } from '../src/app/core/source-registry';
import { normalizeGreenhouse } from '../server/greenhouse-source';
import { normalizeLever } from '../server/discovery';
import { enrichJob } from '../server/job-facts';
export const auditFixture = JSON.parse(readFileSync('tests/fixtures/audit40-public.json', 'utf8'));
export function auditJobs(before = false): Job[] {
  return auditFixture.results.map((r: { job: Job; provider: unknown }) => {
    if (before) return structuredClone(r.job);
    const source = SOURCES.find((s) => r.job.id.startsWith(s.id + '-'))!;
    let job: Job | undefined;
    if (r.provider && source.provider === 'greenhouse')
      job = normalizeGreenhouse(
        { jobs: [r.provider] },
        source,
        auditFixture.observedAt,
        'global',
      )[0];
    else if (r.provider && source.provider === 'lever')
      job = normalizeLever([r.provider], auditFixture.observedAt, source, 'global')[0];
    return enrichJob(job ?? structuredClone(r.job));
  });
}
