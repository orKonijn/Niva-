import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteCareerDb } from './career-db';
import { discoveryPage, normalizeLever, ingest } from './discovery';
import { normalizeGreenhouse } from './greenhouse-source';
import { SOURCES, trustedJobUrl } from './job-sources';
import { canonicalJobUrl } from '../src/app/core/job-identity';
import { defaultPreferences } from '../src/app/core/preferences';
import type { Job } from '../src/app/core/models/job';
import { enrichJob } from './job-facts';
import { verifyJob } from './job-verification';
const fixture = JSON.parse(readFileSync('tests/fixtures/qa-coverage-20261025.json', 'utf8')) as {
  jobs: Job[];
};
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['003_career', '004_lifecycle', '005_career_erasure'])
    sqlite.exec(readFileSync(`server/migrations/${name}.sql`, 'utf8'));
  return { sqlite, db: sqliteCareerDb(sqlite) };
}
function insert(sqlite: DatabaseSync, job: Job) {
  sqlite
    .prepare(
      'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
    )
    .run(
      job.id,
      job.source!.sourceId!,
      canonicalJobUrl(job.source!.applicationUrl),
      job.company.toLowerCase(),
      job.title.toLowerCase(),
      job.district,
      job.category,
      job.workStyle,
      job.title.toLowerCase(),
      job.source!.version ?? 'fixture-v1',
      JSON.stringify(job),
    );
}
afterEach(() => vi.unstubAllGlobals());
describe('worldwide catalogue and explicit personal search', () => {
  it('caps rolling-feed pages and rotates at most 100 explicit status checks without losing history', async () => {
    const { sqlite, db } = database();
    try {
      const source = SOURCES.find((s) => s.provider === 'jobicy')!;
      const staleAt = new Date(Date.now() - 172800000).toISOString();
      for (let n = 1; n <= 101; n++) {
        const job = structuredClone(fixture.jobs.find((j) => j.source?.sourceId === source.id)!);
        job.id = `${source.id}-${n}`;
        job.source!.sourceId = source.id;
        job.source!.lastVerifiedAt = staleAt;
        job.source!.availability = 'published';
        job.source!.applicationUrl = `https://jobicy.com/jobs/${n}-old`;
        insert(sqlite, job);
      }
      let pages = 0;
      let statusIds: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.includes('/api/jobs/status')) {
            statusIds = new URL(url).searchParams.get('ids')!.split(',');
            return Response.json({
              success: true,
              jobs: statusIds.map((id) => ({ id: Number(id), status: 'active' })),
            });
          }
          if (url.includes('jobicy.com')) {
            pages++;
            return Response.json({
              jobs: [
                {
                  id: 1000 + pages,
                  url: `https://jobicy.com/jobs/${1000 + pages}-new`,
                  jobTitle: 'Engineer',
                  companyName: 'Synthetic',
                  jobGeo: 'Anywhere',
                  jobDescription: 'Python SQL',
                  pubDate: new Date().toISOString(),
                },
              ],
              hasMore: true,
              nextCursor: `page-${pages}`,
            });
          }
          return url.includes('greenhouse') ? Response.json({ jobs: [] }) : Response.json([]);
        }),
      );
      await ingest(db);
      expect(pages).toBe(5);
      expect(statusIds).toHaveLength(100);
      const stored = await db.all<{ active: number; data: string }>(
        'SELECT active,data FROM niva_jobs WHERE source_id=?',
        source.id,
      );
      expect(stored).toHaveLength(106);
      const withheld = stored.filter((j) => !j.active);
      expect(withheld).toHaveLength(1);
      expect(JSON.parse(withheld[0].data).source.availability).toBe('unknown');
      expect(
        JSON.parse(
          stored.find((j) => JSON.parse(j.data).id === `${source.id}-${statusIds[0]}`)!.data,
        ).description,
      ).toContain(' ');
      const page = await discoveryPage(db, 'secret', { scope: 'all' });
      expect(page.health.find((h) => h.id === source.id)?.partial).toBe(true);
    } finally {
      sqlite.close();
    }
  });
  it('retains detail enrichment across an unchanged metadata snapshot and invalidates it on a provider update', async () => {
    const { sqlite, db } = database();
    try {
      const source = SOURCES.find((s) => s.board === 'elastic')!;
      const at = '2026-10-25T00:00:00Z';
      const row = {
        id: 77,
        title: 'Backend Engineer',
        location: { name: 'London, United Kingdom' },
        absolute_url: 'https://jobs.elastic.co/jobs/77',
        updated_at: at,
      };
      const job = enrichJob(
        normalizeGreenhouse(
          {
            jobs: [
              {
                ...row,
                content:
                  'Requirements: experience with Python and SQL. ' +
                  'Synthetic detail text. '.repeat(10),
              },
            ],
          },
          source,
          at,
          'global',
        )[0],
      );
      job.source!.version = 'fixture-v1';
      job.source!.descriptionFetchedAt = at;
      insert(sqlite, job);
      let updated = at;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.includes('greenhouse')
            ? Response.json({ jobs: [{ ...row, updated_at: updated }] })
            : url.includes('jobicy.com')
              ? Response.json({ jobs: [], hasMore: false, nextCursor: null })
              : Response.json([]),
        ),
      );
      await ingest(db);
      let stored = JSON.parse(
        (await db.all<{ data: string }>('SELECT data FROM niva_jobs WHERE id=?', job.id))[0].data,
      ) as Job;
      expect(stored.description).toBe(job.description);
      expect(stored.source?.descriptionFetchedAt).toBe(at);
      updated = '2026-10-25T01:00:00Z';
      await ingest(db, Date.now() + 1000000);
      stored = JSON.parse(
        (await db.all<{ data: string }>('SELECT data FROM niva_jobs WHERE id=?', job.id))[0].data,
      ) as Job;
      expect(stored.source?.descriptionFetchedAt).toBeUndefined();
      expect(stored.description).not.toContain('Synthetic detail');
    } finally {
      sqlite.close();
    }
  });
  it('global browsing ignores saved role/area/styles, but keeps exclusions, screen filters and stable paging', async () => {
    const { sqlite, db } = database();
    try {
      for (const job of fixture.jobs) insert(sqlite, job);
      const p = {
        ...defaultPreferences(),
        role: 'qa-automation' as const,
        district: 'tel-aviv' as const,
        workStyles: ['onsite', 'hybrid', 'remote'] as const,
      };
      const prefs = { ...p, workStyles: [...p.workStyles] },
        before = structuredClone(prefs);
      expect((await discoveryPage(db, 'secret', { scope: 'personal' }, prefs)).total).toBe(4);
      expect(
        (await discoveryPage(db, 'secret', { scope: 'personal', area: 'all' }, prefs)).total,
      ).toBe(6);
      expect(
        (
          await discoveryPage(
            db,
            'secret',
            { scope: 'personal', area: 'all', related: 'true' },
            prefs,
          )
        ).total,
      ).toBe(8);
      const first = await discoveryPage(db, 'secret', { scope: 'all', limit: '3' }, prefs);
      expect(first.total).toBe(10);
      expect(first.jobs).toHaveLength(3);
      expect(first.jobs.every((j) => typeof j.description === 'string')).toBe(true);
      const next = await discoveryPage(
        db,
        'secret',
        { scope: 'all', limit: '3', cursor: first.nextCursor! },
        prefs,
      );
      expect(next.jobs.every((j) => !first.jobs.some((old) => old.id === j.id))).toBe(true);
      await expect(
        discoveryPage(db, 'secret', { scope: 'personal', cursor: first.nextCursor! }, prefs),
      ).rejects.toThrow('CURSOR_EXPIRED');
      expect(
        (await discoveryPage(db, 'secret', { scope: 'all', location: 'Seoul' }, prefs)).total,
      ).toBe(1);
      expect(
        (await discoveryPage(db, 'secret', { scope: 'all' }, { ...prefs, exclusions: 'Veeva' }))
          .total,
      ).toBe(9);
      expect(
        (await discoveryPage(db, 'secret', { scope: 'all', unknownStyle: 'false' }, prefs)).total,
      ).toBe(fixture.jobs.filter((j) => j.workStyle !== 'unknown').length);
      expect(prefs).toEqual(before);
    } finally {
      sqlite.close();
    }
  });
  it('normalizes global Greenhouse and generic Lever sources without inventing an Israeli office abroad', () => {
    const source = SOURCES.find((s) => s.board === 'gongio')!;
    const row = {
      id: 77,
      title: 'Backend Engineer',
      location: { name: 'New York, United States' },
      absolute_url: 'https://job-boards.greenhouse.io/gongio/jobs/77',
      updated_at: '2026-10-25T00:00:00Z',
      content: 'Requirements: experience with Python SQL.',
    };
    expect(normalizeGreenhouse({ jobs: [row] }, source, '2026-10-25T00:00:00Z')).toEqual([]);
    const [global] = normalizeGreenhouse({ jobs: [row] }, source, '2026-10-25T00:00:00Z', 'global');
    expect(global.district).toBe('unknown');
    expect(global.offices).toEqual([]);
    expect(global.source?.location).toBe(row.location.name);
    const veeva = SOURCES.find((s) => s.id === 'lever-veeva-israel')!;
    const posting = {
      id: 'fdca1089-4737-4b89-8fa7-03c36262d3ab',
      text: 'QA Automation Engineer - CDH',
      hostedUrl: 'https://jobs.lever.co/veeva/fdca1089-4737-4b89-8fa7-03c36262d3ab',
      categories: { location: 'Israel - Kiryat Ono' },
      workplaceType: 'on-site',
      descriptionPlain: 'Synthetic boundary fixture',
    };
    const [job] = normalizeLever([posting], '2026-10-25T00:00:00Z', veeva, 'global');
    expect(job.company).toBe('Veeva');
    expect(job.district).toBe('tel-aviv');
    expect(trustedJobUrl(job.id, job.source!.applicationUrl)).toBe(true);
    expect(
      normalizeLever(
        [{ ...posting, hostedUrl: posting.hostedUrl.replace('/veeva/', '/walkme/') }],
        'now',
        veeva,
        'global',
      ),
    ).toEqual([]);
  });
  it('enriches metadata-only detail from verified provider JSON and preserves first-seen time', async () => {
    const { sqlite, db } = database();
    try {
      const source = SOURCES.find((s) => s.board === 'gongio')!;
      const row = {
        id: 77,
        title: 'Backend Engineer',
        location: { name: 'New York, United States' },
        absolute_url: 'https://job-boards.greenhouse.io/gongio/jobs/77',
        updated_at: '2026-10-25T00:00:00Z',
      };
      const job = enrichJob(
        normalizeGreenhouse({ jobs: [row] }, source, '2026-10-25T00:00:00Z', 'global')[0],
      );
      job.source!.version = 'fixture-v1';
      job.source!.firstSeenAt = '2026-01-01T00:00:00Z';
      insert(sqlite, job);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.includes('boards-api')
            ? Response.json({
                ...row,
                content:
                  'Requirements: experience with Python and SQL. Minimum 3 years of experience required.',
              })
            : new Response('<html>Source page</html>', {
                headers: { 'content-type': 'text/html' },
              }),
        ),
      );
      const result = await verifyJob(db, job);
      expect(result.description).toContain('Python');
      expect(result.facts?.requiredSkills?.map((f) => f.value)).toEqual(['Python', 'SQL']);
      expect(result.source?.firstSeenAt).toBe('2026-01-01T00:00:00Z');
      expect(result.source?.availability).toBe('published');
      const [stored] = await db.all<{ data: string }>(
        'SELECT data FROM niva_jobs WHERE id=?',
        job.id,
      );
      expect(JSON.parse(stored.data).description).toContain('Python');
    } finally {
      sqlite.close();
    }
  });
  it('does not pull every large description into the global eligibility scan', async () => {
    const { sqlite, db } = database();
    try {
      const base = fixture.jobs[0];
      sqlite.exec('BEGIN');
      for (let n = 0; n < 500; n++) {
        const job = structuredClone(base);
        job.id = `greenhouse-canopycare-${900000 + n}`;
        job.description = 'Synthetic large description '.repeat(650);
        job.source!.applicationUrl = `https://job-boards.greenhouse.io/canopycare/jobs/${900000 + n}`;
        job.source!.version = 'fixture-v1';
        insert(sqlite, job);
      }
      sqlite.exec('COMMIT');
      let scanBytes = 0;
      const all = db.all.bind(db);
      db.all = async <T>(sql: string, ...args: (string | number | null)[]) => {
        const result = await all<T>(sql, ...args);
        if (sql.includes('json_remove')) scanBytes = JSON.stringify(result).length;
        return result;
      };
      const result = await discoveryPage(db, 'secret', { scope: 'all', limit: '12' });
      expect(result.total).toBe(500);
      expect(result.jobs[0].description.length).toBeGreaterThan(15000);
      expect(scanBytes).toBeLessThan(2000000);
      expect(scanBytes).toBeGreaterThan(0);
    } finally {
      sqlite.close();
    }
  });
});
