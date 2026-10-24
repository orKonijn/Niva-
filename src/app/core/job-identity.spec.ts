import { it, expect } from 'vitest';
import { canonicalJobUrl, uniqueJobs } from './job-identity';
import { JOBS } from './data/sample-jobs';
it('retains distinct provider requisition parameters and removes only known tracking', () => {
  expect(canonicalJobUrl('https://example.test/job?gh_jid=2&utm_source=test#apply')).toBe(
    'https://example.test/job?gh_jid=2',
  );
  expect(canonicalJobUrl('https://example.test/job?gh_jid=1')).not.toBe(
    canonicalJobUrl('https://example.test/job?gh_jid=2'),
  );
  expect(canonicalJobUrl('https://example.test/job?source=1')).not.toBe(
    canonicalJobUrl('https://example.test/job?source=2'),
  );
  expect(new Set(uniqueJobs([JOBS[0], JOBS[1]]).map((j) => j.id))).toEqual(
    new Set([JOBS[0].id, JOBS[1].id]),
  );
});
