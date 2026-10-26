import { expect, it } from 'vitest';
import { descriptionBlocks } from './description-blocks';
import { sourceFreshness, recordSourceAttempt } from './source-health';
import { repairHarness } from './repair-harness';
import { discoveryPage } from './discovery';
import { auditJobs } from '../tests/audit40-data';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { defaultPreferences } from '../src/app/core/preferences';
import { assessJob } from '../src/app/core/job-assessment';
import { enrichJob } from './job-facts';

it('F11 term coverage withholds unknown evidence and separates explicit eligibility blockers', () => {
  const job = structuredClone(auditJobs()[0]);
  job.description = 'Requirements\nExperience with Python and SQL.';
  delete job.facts;
  const enriched = enrichJob(job);
  const preferences = defaultPreferences();
  const criteria = { ...emptyCriteria(), confirmed: true, skills: ['Python'] };
  const partial = assessJob(enriched, preferences, 'Python', true, criteria);
  expect(partial.skillsScore).toBe(50);
  expect(partial.skillsCoverage).toEqual({ matched: 1, required: 2 });
  expect(assessJob(enriched, preferences, '', false, criteria).skillsScore).toBeNull();
  const unknown = structuredClone(enriched);
  unknown.facts!.requiredSkills = [];
  expect(assessJob(unknown, preferences, 'Python', true, criteria).skillsScore).toBeNull();
  const blocked = assessJob(enriched, preferences, 'Python', true, {
    ...criteria,
    currentCountry: 'US',
    authorizationCountry: 'US',
    authorizationExclusive: true,
    workAuthorization: 'authorized',
  });
  expect(blocked.skillsScore).toBe(50);
  expect(blocked.eligibility).not.toBe('clear');
});

it('B03 preserves arbitrary headings, hierarchy, ordered nested lists and inert bilingual text', () => {
  const blocks = descriptionBlocks(
    '&lt;h2&gt;Your Mission&lt;/h2&gt;<p>QA &amp; APIs בעברית</p><h3>A unique section</h3><ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol><script>bad()</script><img src=x onerror="bad()"><iframe>secret</iframe>',
  );
  expect(blocks.slice(0, 3)).toEqual([
    { kind: 'heading', level: 2, text: 'Your Mission' },
    { kind: 'paragraph', text: 'QA & APIs בעברית' },
    { kind: 'heading', level: 3, text: 'A unique section' },
  ]);
  expect(blocks[3]).toMatchObject({
    kind: 'list',
    ordered: true,
    items: [
      [
        { kind: 'paragraph', text: 'First' },
        { kind: 'list', ordered: false, items: [[{ kind: 'paragraph', text: 'Nested' }]] },
      ],
      [{ kind: 'paragraph', text: 'Second' }],
    ],
  });
  expect(JSON.stringify(blocks)).not.toMatch(/bad\(|secret|onerror|src=/);
  expect(JSON.stringify(descriptionBlocks('<h2>x</h2>'.repeat(20000))).length).toBeLessThan(
    1000000,
  );
});
it('B03 normalizes Canopy source headings instead of guessing their names', () => {
  const job = auditJobs()[0];
  expect(job.descriptionBlocks).toContainEqual({ kind: 'heading', level: 2, text: 'Your Mission' });
  expect(job.descriptionBlocks).toContainEqual({
    kind: 'heading',
    level: 2,
    text: 'Join Us in Revolutionizing Oncology Care',
  });
});
it('N01 keeps successful check bounds separate from newer failed attempts and never-successful sources', async () => {
  expect(
    sourceFreshness([
      { checked_at: '2026-10-25T10:00:00Z', attempted_at: '2026-10-26T12:00:00Z' },
      { checked_at: '2026-10-26T11:00:00Z' },
      { checked_at: null },
    ]),
  ).toEqual({
    oldestSuccessfulAt: '2026-10-25T10:00:00Z',
    newestSuccessfulAt: '2026-10-26T11:00:00Z',
    newestAttemptedAt: '2026-10-26T12:00:00Z',
    neverSucceededCount: 1,
  });
  const h = repairHarness('node');
  try {
    await h.db.run(
      "INSERT INTO niva_sources(id,checked_at,error) VALUES('greenhouse-canopycare','2026-10-25T10:00:00Z','SOURCE_UNAVAILABLE')",
    );
    await recordSourceAttempt(h.db, 'greenhouse-canopycare', Date.parse('2026-10-26T12:00:00Z'));
    const result = await discoveryPage(h.db, 'test', {});
    expect(result.freshness.newestSuccessfulAt).toBe('2026-10-25T10:00:00Z');
    expect(result.freshness.newestAttemptedAt).toBe('2026-10-26T12:00:00.000Z');
    expect(result.health[0].error).toBe('SOURCE_UNAVAILABLE');
  } finally {
    h.sqlite.close();
  }
});
it('F08 globally ranks beyond page one, binds cursors to ranking and preserves every distinct result', async () => {
  const h = repairHarness('node');
  try {
    const base = auditJobs()[0];
    for (let i = 0; i < 80; i++) {
      const job = structuredClone(base);
      job.id = String(i).padStart(4, '0');
      job.title = i < 60 ? 'Sales Engineer' : 'QA Automation Engineer';
      job.category = i < 60 ? 'engineering' : 'qa-automation';
      job.source!.applicationUrl = 'https://example.test/jobs/' + i;
      await h.db.run(
        'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
        job.id,
        'greenhouse-canopycare',
        job.source!.applicationUrl,
        'synthetic',
        job.title.toLowerCase(),
        job.district,
        job.category,
        job.workStyle,
        job.title.toLowerCase(),
        'v1',
        JSON.stringify(job),
      );
    }
    const preferences = { ...defaultPreferences(), role: 'qa-automation' as const };
    const first = await discoveryPage(
      h.db,
      'test',
      { scope: 'all', q: 'Engineer', sort: 'relevance', limit: '10' },
      preferences,
    );
    expect(first.jobs.every((j) => j.category === 'qa-automation')).toBe(true);
    const second = await discoveryPage(
      h.db,
      'test',
      { scope: 'all', q: 'Engineer', sort: 'relevance', limit: '10', cursor: first.nextCursor! },
      preferences,
    );
    expect(new Set([...first.jobs, ...second.jobs].map((j) => j.id)).size).toBe(20);
    expect(second.jobs.every((j) => j.category === 'qa-automation')).toBe(true);
    await expect(
      discoveryPage(
        h.db,
        'test',
        { scope: 'all', q: 'Engineer', sort: 'source', cursor: first.nextCursor! },
        preferences,
      ),
    ).rejects.toThrow('CURSOR_EXPIRED');
  } finally {
    h.sqlite.close();
  }
});
