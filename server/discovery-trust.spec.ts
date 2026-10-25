import { describe, expect, it, vi, afterEach } from 'vitest';
import { enrichJob } from './job-facts';
import { assessJob } from '../src/app/core/job-assessment';
import { passesDiscovery } from '../src/app/core/discovery-filters';
import { defaultPreferences } from '../src/app/core/preferences';
import { emptyCriteria } from '../src/app/core/models/discovery';
import { normalizeCriteria } from '../src/app/core/candidate-validation';
import { trustedJobUrl, SOURCES } from './job-sources';
import { normalizeJobicy } from './jobicy-source';
import { normalizeGreenhouse } from './greenhouse-source';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteCareerDb } from './career-db';
import { ingest, discoveryPage } from './discovery';
import { verifyJob } from './job-verification';
const at = '2026-10-25T16:00:00Z';
const source = SOURCES.find((x) => x.board === 'canopycare')!;
const row = {
  id: 42,
  title: 'Senior QA Automation Engineer',
  location: { name: 'Tel Aviv, Israel Hybrid' },
  absolute_url: 'https://job-boards.greenhouse.io/canopycare/jobs/42',
  updated_at: at,
  content:
    'Requirements: Experience with Python and SQL. Minimum 3 years of experience required. Candidates must be physically located in Italy. We cannot provide visa sponsorship. Selenium is a bonus.',
};
const make = () => enrichJob(normalizeGreenhouse({ jobs: [row] }, source, at)[0]);
const preferences = {
  ...defaultPreferences(),
  role: 'qa-automation' as const,
  district: 'tel-aviv' as const,
  workStyles: ['hybrid' as const],
};
const candidate = {
  ...emptyCriteria(),
  confirmed: true,
  yearsExperience: 4,
  currentCountry: 'IL',
  sponsorship: 'needed' as const,
};
afterEach(() => vi.unstubAllGlobals());
describe('trust foundation (synthetic boundary fixtures)', () => {
  it('separates expired deadlines, explicit authorization conflicts and incomplete profile evidence', () => {
    const job = make();
    job.facts!.deadline = {
      value: '2026-01-01T00:00:00Z',
      url: row.absolute_url,
      observedAt: at,
      quote: 'Deadline January 1',
      provenance: 'supplied',
    };
    job.facts!.authorizationCountry = {
      value: 'IL',
      url: row.absolute_url,
      observedAt: at,
      quote: 'Must be authorized to work in Israel',
      provenance: 'supplied',
    };
    const a = assessJob(job, preferences, 'Python SQL', true, {
      ...candidate,
      authorizationCountry: 'IL',
      workAuthorization: 'not-authorized',
    });
    expect(a.blockers.some((x) => x.includes('מועד ההגשה'))).toBe(true);
    expect(a.blockers.some((x) => x.includes('אישור העבודה'))).toBe(true);
    expect(passesDiscovery(job, {}, preferences, candidate)).toBe(false);
    expect(assessJob(make(), preferences, '', false).score).toBeNull();
  });
  it('keeps optional skills, office locations, remote scope and missing sponsorship distinct', () => {
    const job = make();
    expect(job.facts?.requiredSkills?.map((x) => x.value)).toEqual(['Python', 'SQL']);
    expect(job.facts?.preferredSkills?.map((x) => x.value)).toContain('QA Automation');
    expect(job.facts?.applicantCountries?.value).toEqual(['IT']);
    expect(job.facts?.minimumYears?.value).toBe(3);
    expect(job.facts?.salary).toBeNull();
    const assessment = assessJob(job, preferences, 'Python SQL', true, candidate);
    expect(assessment.eligibility).toBe('blocked');
    expect(assessment.blockers).toHaveLength(2);
    expect(passesDiscovery(job, {}, preferences, candidate)).toBe(false);
    expect(passesDiscovery(job, { eligibility: 'blocked' }, preferences, candidate)).toBe(true);
  });
  it('scores deterministically with original weights; absent salary never increases points', () => {
    const job = make();
    const a = assessJob(job, preferences, 'Python SQL', true, candidate);
    expect(a.score).toBe(90);
    expect(a.dimensions.find((x) => x.key === 'salary')?.points).toBe(0);
    expect(assessJob(job, preferences, 'Python SQL', true, candidate)).toEqual(a);
    expect(assessJob(job, preferences, 'Python', false, candidate).score).toBeNull();
    expect(assessJob(job, preferences, 'No Python. No SQL.', true, candidate).score).toBe(55);
    expect(
      assessJob({ ...job, facts: undefined }, preferences, 'Python SQL', true, candidate).score,
    ).toBeNull();
  });
  it('does not equate an Anywhere label with authorization or worldwide eligibility', () => {
    const [job] = normalizeJobicy(
      {
        jobs: [
          {
            id: 1,
            url: 'https://jobicy.com/jobs/1-test',
            jobTitle: 'SDET',
            companyName: 'Synthetic',
            jobGeo: 'Anywhere',
            jobDescription: 'Python SQL',
            pubDate: at,
          },
        ],
      },
      at,
    );
    const a = assessJob(enrichJob(job), defaultPreferences(), 'Python SQL', true);
    expect(a.eligibility).toBe('confirmation');
    expect(a.blockers).toEqual([]);
    expect(a.score).toBeNull();
    expect(job.facts?.applicantCountries).toBeNull();
  });
  it('uses one trusted source registry and rejects credential URLs, other boards and HTTP', () => {
    expect(trustedJobUrl('greenhouse-canopycare-42', row.absolute_url)).toBe(true);
    for (const url of [
      'http://job-boards.greenhouse.io/canopycare/jobs/42',
      'https://job-boards.greenhouse.io/other/jobs/42',
      'https://u:p@job-boards.greenhouse.io/canopycare/jobs/42',
      'https://evil.example/42',
    ])
      expect(trustedJobUrl('greenhouse-canopycare-42', url)).toBe(false);
    expect(trustedJobUrl('jobicy-israel-qa-1', 'https://jobicy.com/jobs/1-test')).toBe(true);
    expect(() => normalizeCriteria({ ...emptyCriteria(), confirmed: false })).toThrow();
    expect(() => normalizeCriteria({ ...candidate, currentCountry: 'Israel' })).toThrow();
    expect(normalizeCriteria(candidate).workAuthorization).toBe('unknown');
  });
  it('handles rolling absence, immutable firstSeen, outage preservation and explicit closures', async () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const name of ['003_career', '004_lifecycle', '005_career_erasure'])
      sqlite.exec(readFileSync(`server/migrations/${name}.sql`, 'utf8'));
    const db = sqliteCareerDb(sqlite),
      now = Date.now();
    let phase = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/status?'))
          return Response.json({
            success: true,
            jobs: [{ id: 1, status: phase === 3 ? 'closed' : 'unknown' }],
          });
        if (url.includes('jobicy.com'))
          return Response.json({
            jobs:
              phase === 0
                ? [
                    {
                      id: 1,
                      url: 'https://jobicy.com/jobs/1-test',
                      jobTitle: 'SDET',
                      companyName: 'Synthetic',
                      jobGeo: 'Anywhere',
                      jobDescription: 'Required experience with Python SQL.',
                      pubDate: at,
                    },
                  ]
                : [],
            hasMore: false,
            nextCursor: null,
          });
        if (phase === 2) return new Response('', { status: 503 });
        return Response.json(url.includes('greenhouse') ? { jobs: [] } : []);
      }),
    );
    await ingest(db, now);
    const first = (await discoveryPage(db, 'secret', {})).jobs.find(
      (j) => j.id === 'jobicy-israel-qa-1',
    )!;
    expect(first.source?.firstSeenAt).toBeTruthy();
    phase = 1;
    await ingest(db, now + 3600001);
    let stored = JSON.parse(
      (await db.all<{ data: string }>('SELECT data FROM niva_jobs WHERE id=?', first.id))[0].data,
    );
    expect(stored.source.availability).toBe('unknown');
    expect(stored.source.firstSeenAt).toBe(first.source?.firstSeenAt);
    phase = 2;
    await ingest(db, now + 7200002);
    expect((await discoveryPage(db, 'secret', {})).stale).toBe(true);
    phase = 3;
    await ingest(db, now + 15000000);
    stored = JSON.parse(
      (await db.all<{ data: string }>('SELECT data FROM niva_jobs WHERE id=?', first.id))[0].data,
    );
    expect(stored.source.availability).toBe('closed');
    sqlite.close();
  });
  it('generic HTTP 200 and timeout do not establish published status or a completed application', async () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const name of ['003_career', '004_lifecycle', '005_career_erasure'])
      sqlite.exec(readFileSync(`server/migrations/${name}.sql`, 'utf8'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('boards-api')
          ? Response.json({ message: 'generic page' })
          : new Response('<html>home page</html>', { headers: { 'content-type': 'text/html' } }),
      ),
    );
    const job = await verifyJob(sqliteCareerDb(sqlite), make());
    expect(job.source?.availability).toBe('unknown');
    expect(job.source?.applicationCheck?.status).toBe('reachable');
    expect(job.source?.applicationCheck?.note).toContain('לא אושרו');
    sqlite.close();
  });
});
