import { expect, it, vi, afterEach } from 'vitest';
import { normalizeJobicy } from './jobicy-source';
import { enrichJob } from './job-facts';
import { assessJob } from '../src/app/core/job-assessment';
import { resumeMatch } from '../src/app/core/matching';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { defaultPreferences } from '../src/app/core/preferences';
import { passesDiscovery } from '../src/app/core/discovery-filters';
import { auditJobs } from '../tests/audit40-data';
import { repairHarness } from './repair-harness';
import { verifyJob } from './job-verification';
import { jobicyDescription, boundedHtml } from './jobicy-description';
import { applicantLocationMatch } from '../src/app/core/applicant-location';
import { discoveryPage } from './discovery';

const at = '2026-10-27T10:00:00Z';
const prefs = defaultPreferences();
export const repairDescription =
  '<h2>What we are looking for in you</h2><ul><li>Experience with Python or Go development.</li><li>Experience with SQL.</li></ul><h2>Nice-to-have skills</h2><ul><li>Experience with AWS.</li></ul>';
export const regionDescription =
  '<h2>Requirements</h2><p>Candidate must be located within Schengen Area.</p>';
export function comparisonJob(html = repairDescription) {
  return normalizeJobicy(
    {
      jobs: [
        {
          id: 151013,
          url: 'https://jobicy.com/jobs/151013-synthetic-test-engineer',
          jobTitle: 'Synthetic Test Engineer',
          companyName: 'Synthetic Employer',
          jobDescription: html,
          jobGeo: 'Anywhere',
          pubDate: at,
        },
      ],
    },
    at,
  )[0];
}
afterEach(() => vi.unstubAllGlobals());

it('S01 retains explicit residence regions independently of citizenship and filters known conflicts', () => {
  const job = comparisonJob(regionDescription);
  expect(job.facts?.applicantRegions?.value).toEqual(['SCHENGEN']);
  expect(job.facts?.applicantCountries).toBeNull();
  expect(job.facts?.citizenshipCountry).toBeNull();
  expect(assessJob(job, prefs).completeness).toBeGreaterThan(0);
  for (const country of ['IL', 'US', 'IE', 'CY']) {
    expect(passesDiscovery(job, { country }, prefs)).toBe(false);
    const criteria = { ...emptyCriteria(), confirmed: true, currentCountry: country };
    expect(assessJob(job, prefs, '', false, criteria).blockers.join(' ')).toContain('שנגן');
  }
  for (const country of ['PT', 'BG', 'RO', 'NO'])
    expect(passesDiscovery(job, { country, missing: 'hide' }, prefs)).toBe(true);
  expect(assessJob(job, prefs, '', false, emptyCriteria()).eligibility).toBe('confirmation');
  expect(passesDiscovery(job, { remoteScope: 'known' }, prefs)).toBe(true);
  expect(passesDiscovery(job, { remoteScope: 'unknown' }, prefs)).toBe(false);
  for (const description of [
    'Candidates are not required to be located within Schengen Area.',
    'Schengen residence is preferred.',
    'We work with clients in the Schengen Area.',
  ])
    expect(comparisonJob(description).facts?.applicantRegions).toBeNull();
});

it('S03 retains required alternatives as one qualification, keeping optional and collaborator clauses separate', () => {
  const job = comparisonJob();
  expect(job.facts?.requiredSkillAlternatives?.map((e) => e.value)).toEqual([['Python', 'Go']]);
  expect(job.facts?.requiredSkills?.map((e) => e.value)).toEqual(['SQL']);
  expect(job.facts?.preferredSkills?.map((e) => e.value)).toEqual(['AWS']);
  for (const language of ['Python', 'Go']) {
    expect(resumeMatch(job, `${language} SQL`, true).missing).toEqual([]);
    expect(assessJob(job, prefs, `${language} SQL`, true).skillsScore).toBe(100);
  }
  const neither = assessJob(job, prefs, 'SQL', true);
  expect(neither.skillsCoverage).toEqual({ matched: 1, required: 2 });
  expect(neither.gaps.join(' ')).toMatch(/Python.*Go/);
  expect(job.description.split('\n')).toContain('What we are looking for in you');
  const groupOnly = comparisonJob(
    '<h2>Requirements</h2><p>Experience with Python or Go development.</p>',
  );
  expect(assessJob(groupOnly, prefs).completeness).toBeGreaterThan(0);
  expect(assessJob(groupOnly, prefs, 'Python', true).skillsScore).toBeNull();
});

it('S03 withholds section scope when a legacy flattened paragraph cannot establish boundaries', () => {
  const job = comparisonJob(
    'Introduction What we are looking for in you Experience with Python or Go development Nice-to-have skills Experience with AWS.',
  );
  expect(job.facts?.requiredSkills).toBeNull();
  expect(job.facts?.preferredSkills).toBeNull();
  expect(job.facts?.requirementsUnresolved).toBe(true);
  expect(assessJob(job, prefs, 'Python AWS', true).skillsScore).toBeNull();
});

it('S03 does not turn an unsupported or mixed alternative into a mandatory known skill', () => {
  for (const clause of [
    'Experience with Python or Rust.',
    'Experience with Python or Go or Rust.',
    'Experience with Python and SQL or Go.',
  ]) {
    const job = comparisonJob(`<h2>Requirements</h2><p>${clause}</p>`);
    expect(job.facts?.requiredSkills).toBeNull();
    expect(job.facts?.requiredSkillAlternatives).toBeNull();
    expect(job.facts?.requirementsUnresolved).toBe(true);
  }
});

it('B05 uses word-safe excerpts with ellipses and retains the matched term in bilingual long clauses', () => {
  for (const prefix of [
    'A long introductory sentence '.repeat(8),
    'נִסָּיוֹן בבדיקות תוכנה 😀 '.repeat(12),
  ]) {
    const job = structuredClone(auditJobs()[0]);
    delete job.facts;
    delete job.descriptionBlocks;
    job.description = `Requirements\n${prefix}Experience with Python and SQL in complex distributed systems ${'and reliable products '.repeat(25)}.`;
    const facts = enrichJob(job).facts!;
    for (const fact of facts.requiredSkills ?? []) {
      expect(fact.quote.length).toBeLessThanOrEqual(300);
      expect(fact.quote).toContain(fact.value);
      expect(fact.quote).toMatch(/^…/);
      expect(fact.quote).toMatch(/…$/);
      expect(fact.quote.replace(/^…|…$/g, '').trim()).not.toMatch(/^\p{M}|[\uD800-\uDBFF]$/u);
    }
  }
});

it.each(['node', 'd1'] as const)(
  'B03 recovers an older Jobicy cached description on %s without extra provider calls',
  async (adapter) => {
    const h = repairHarness(adapter);
    try {
      const job = comparisonJob();
      job.description = 'Old flattened source text';
      job.descriptionBlocks = [{ kind: 'paragraph', text: job.description }];
      job.source!.version = 'before';
      job.source!.availability = 'published';
      job.source!.lastVerifiedAt = at;
      await h.db.run(
        'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
        job.id,
        'jobicy-israel-qa',
        job.source!.applicationUrl,
        'synthetic',
        job.title.toLowerCase(),
        'unknown',
        job.category,
        job.workStyle,
        'synthetic',
        'before',
        JSON.stringify(job),
      );
      const fetchMock = vi.fn(
        async () =>
          new Response(
            `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', identifier: { value: '151013' }, title: job.title })}</script><div id="jv-full-description">${repairDescription}<script>bad()</script></div><div>Unrelated recommendations</div>`,
            { headers: { 'content-type': 'text/html' } },
          ),
      );
      vi.stubGlobal('fetch', fetchMock);
      const checkAt = Date.parse(at) + 3600000;
      const updated = await verifyJob(h.db, job, checkAt);
      expect(updated.descriptionBlocks).toContainEqual({
        kind: 'heading',
        level: 2,
        text: 'What we are looking for in you',
      });
      expect(updated.facts?.requiredSkillAlternatives?.[0].value).toEqual(['Python', 'Go']);
      expect(updated.description).not.toMatch(/bad\(|Unrelated/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(updated.source!.lastVerifiedAt).toBe(at);
      expect(updated.source!.descriptionFetchedAt).toBe(new Date(checkAt).toISOString());
      expect(updated.facts!.requiredSkillAlternatives![0].observedAt).toBe(
        new Date(checkAt).toISOString(),
      );
      await verifyJob(h.db, updated, checkAt + 1000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [stored] = await h.db.all<{ data: string }>(
        'SELECT data FROM niva_jobs WHERE id=?',
        job.id,
      );
      expect(JSON.parse(stored.data).descriptionBlocks).toEqual(updated.descriptionBlocks);
    } finally {
      h.sqlite.close();
    }
  },
);

it('B03 refuses unrelated identities, ambiguous containers, invalid metadata and oversized originals', async () => {
  const job = comparisonJob();
  const posting = { '@type': 'JobPosting', identifier: { value: '151013' }, title: job.title };
  const page = (
    data: unknown,
    content = `<div id="jv-full-description">${repairDescription}</div>`,
  ) => `<script type="application/ld+json">${JSON.stringify(data)}</script>${content}`;
  expect(jobicyDescription(page({ ...posting, identifier: { value: '999' } }), job)).toBeNull();
  expect(jobicyDescription(page({ ...posting, title: 'Another job' }), job)).toBeNull();
  job.title = 'Synthetic Engineer - Remote';
  expect(
    jobicyDescription(page({ ...posting, title: 'Synthetic Engineer &amp;#8211; Remote' }), job),
  ).not.toBeNull();
  job.title = posting.title;
  expect(jobicyDescription(page([posting, posting]), job)).toBeNull();
  expect(jobicyDescription(page(posting, '<div>Missing container</div>'), job)).toBeNull();
  expect(
    jobicyDescription(
      page(
        posting,
        '<div id="jv-full-description">One</div><div id="jv-full-description">Two</div>',
      ),
      job,
    ),
  ).toBeNull();
  expect(jobicyDescription('x'.repeat(1_000_001), job)).toBeNull();
  expect(await boundedHtml(new Response('x'.repeat(1_000_001)))).toBeNull();
  expect(await boundedHtml(new Response('מקור 😀'))).toBe('מקור 😀');
  const recovered = jobicyDescription(
    page(
      posting,
      `<div id="jv-full-description"><h2>Requirements</h2><ul><li>SQL<script>steal()</script><iframe src="https://example.test"></iframe></li></ul></div><h2>Unrelated</h2>`,
    ),
    job,
  );
  expect(recovered?.description).toBe('Requirements\nSQL');
  expect(recovered?.descriptionBlocks).toHaveLength(2);
});

it('S01 leaves unknown regions/countries unresolved and never converts residence to work rights', () => {
  const job = comparisonJob(regionDescription);
  expect(applicantLocationMatch(job.facts, 'not-a-country')).toBeNull();
  expect(applicantLocationMatch(job.facts, 'ZZ')).toBeNull();
  job.facts!.applicantRegions!.value = ['UNRECOGNIZED'];
  expect(applicantLocationMatch(job.facts, 'IL')).toBeNull();
  expect(passesDiscovery(job, { country: 'IL', missing: 'hide' }, prefs)).toBe(false);
  expect(job.facts!.authorizationCountry).toBeNull();
});

it.each(['node', 'd1'] as const)(
  'S01 filters the %s catalog before totals and pagination',
  async (adapter) => {
    const h = repairHarness(adapter);
    try {
      const restricted = comparisonJob(regionDescription);
      const unknown = comparisonJob('<p>Location eligibility was not supplied.</p>');
      unknown.id = 'jobicy-israel-qa-151014';
      unknown.source!.applicationUrl = 'https://jobicy.com/jobs/151014-synthetic-engineer';
      unknown.source!.url = unknown.source!.applicationUrl;
      for (const job of [restricted, unknown]) {
        job.source!.version = 'old';
        job.facts!.extractionVersion = 'old';
        await h.db.run(
          'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
          job.id,
          'jobicy-israel-qa',
          job.source!.applicationUrl,
          'synthetic',
          job.title.toLowerCase(),
          'unknown',
          job.category,
          job.workStyle,
          'synthetic',
          'old',
          JSON.stringify(job),
        );
      }
      const il = await discoveryPage(
        h.db,
        'synthetic-test',
        { scope: 'all', country: 'IL', limit: '1' },
        prefs,
      );
      expect(il.total).toBe(1);
      expect(il.jobs.map((j) => j.id)).toEqual([unknown.id]);
      expect(il.nextCursor).toBeNull();
      const pt = await discoveryPage(
        h.db,
        'synthetic-test',
        { scope: 'all', country: 'PT', missing: 'hide', remoteScope: 'known', limit: '1' },
        prefs,
      );
      expect(pt.total).toBe(1);
      expect(pt.jobs.map((j) => j.id)).toEqual([restricted.id]);
      const strict = await discoveryPage(
        h.db,
        'synthetic-test',
        { scope: 'all', country: 'IL', missing: 'hide' },
        prefs,
      );
      expect(strict.total).toBe(0);
    } finally {
      h.sqlite.close();
    }
  },
);
