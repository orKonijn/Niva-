import { expect, it } from 'vitest';
import { arrangementEvidence } from './source-evidence';
import { reviewJobs } from '../tests/ui-review-fixture';
import { enrichJob } from './job-facts';

it('keeps work arrangement evidence on word boundaries with disclosed omissions', () => {
  const description =
    'Introduction '.repeat(8) +
    'Collaborate across teams and visit our New York office. Hybrid work flexibility, with Tel Aviv-based employees expected in-office 3 days per week. ' +
    'Additional benefits '.repeat(20);
  const job = { ...reviewJobs[0], workStyle: 'unknown' as const, facts: undefined, description };
  const quote = arrangementEvidence(job).workArrangements[0].quote;
  expect(quote).toContain('Hybrid work flexibility');
  expect(quote).toMatch(/^… \S+/);
  expect(quote).toMatch(/ …$/);
  const body = quote.replace(/^… /, '').replace(/ …$/, '');
  const start = description.indexOf(body);
  expect(start).toBeGreaterThan(0);
  expect(description[start - 1]).toMatch(/\s/);
  expect(description[start + body.length]).toMatch(/\s/);
});

it('replaces a cached extracted description excerpt instead of retaining the broken quote', () => {
  const description =
    'Introduction '.repeat(8) +
    'Collaborate across teams and visit our New York office. Hybrid work flexibility, with Tel Aviv-based employees expected in-office 3 days per week. ' +
    'Additional benefits '.repeat(20);
  const job = enrichJob({ ...reviewJobs[0], workStyle: 'unknown', facts: undefined, description });
  const index = description.indexOf('Hybrid work');
  const broken = description.slice(index - 40, index + 180);
  job.facts!.workArrangements = [{ ...job.facts!.workArrangements![0], quote: broken }];
  const updated = enrichJob(job);
  expect(updated.facts!.workArrangements).toHaveLength(1);
  expect(updated.facts!.workArrangements![0].quote).not.toBe(broken);
  expect(enrichJob(updated).facts!.workArrangements).toEqual(updated.facts!.workArrangements);
});
