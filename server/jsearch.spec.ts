import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteCareerDb } from './career-db';
import { ingestJsearch, normalizeJsearch } from './jsearch-source';
import { createCareer } from './career';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { trustedJobUrl, trustedPublisherUrl } from '../src/app/core/source-registry';
const DAY = 86400000;
const row = (publisher = 'LinkedIn') => ({
  job_id: 'public-provider-id',
  job_title: 'QA Automation Engineer',
  employer_name: 'Synthetic Employer',
  job_publisher: publisher,
  job_apply_link:
    publisher === 'LinkedIn'
      ? 'https://il.linkedin.com/jobs/view/synthetic-12345678'
      : 'https://www.indeed.com/viewjob?jk=abcdef1234567890',
  job_description: 'Experience with Python and SQL required.',
  job_location: 'Tel Aviv, Israel',
  job_is_remote: false,
});
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const n of ['003_career', '004_lifecycle', '005_career_erasure'])
    sqlite.exec(readFileSync(`server/migrations/${n}.sql`, 'utf8'));
  return { sqlite, db: sqliteCareerDb(sqlite) };
}
afterEach(() => vi.unstubAllGlobals());
describe('publisher feed within the free-plan budget', () => {
  it('registers the publisher work with Worker keepAlive before awaiting it and keeps it independent of request cancellation', async () => {
    const { sqlite, db } = database();
    try {
      let release!: () => void, started!: () => void;
      const entered = new Promise<void>((r) => (started = r)),
        gate = new Promise<void>((r) => (release = r));
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (String(url).includes('openwebninja')) {
            started();
            await gate;
            return Response.json({
              status: 'OK',
              data: { jobs: [row(String(url).includes('linkedin') ? 'LinkedIn' : 'Indeed')] },
            });
          }
          return Response.json(
            String(url).includes('greenhouse')
              ? { jobs: [] }
              : String(url).includes('jobicy')
                ? { jobs: [], hasMore: false, nextCursor: null }
                : [],
          );
        }),
      );
      const keepAlive = vi.fn();
      const app = createCareer({
        db,
        env: { JSEARCH_API_KEY: 'synthetic-key' },
        secret: 'synthetic-secret',
        identity: async () => null,
        state: async () => emptyAccountState(),
        keepAlive,
      });
      const controller = new AbortController();
      const request = app.request(
        new Request('https://niva.example/api/feed?scope=all', { signal: controller.signal }),
      );
      await entered;
      expect(keepAlive).toHaveBeenCalled();
      const publisherWork = keepAlive.mock.calls[0][0] as Promise<void>;
      expect(publisherWork).toBeInstanceOf(Promise);
      controller.abort();
      release();
      await publisherWork;
      expect((await db.all('SELECT id FROM niva_jobs')).length).toBe(2);
      expect((await request).status).toBe(200);
    } finally {
      sqlite.close();
    }
  });
  it('accepts actual public samples and rejects spoofed publishers and unsafe application hosts', () => {
    const actual = JSON.parse(readFileSync('tests/fixtures/jsearch-public-20261025.json', 'utf8'));
    expect(actual.jobs).toHaveLength(4);
    for (const j of actual.jobs) expect(trustedJobUrl(j.id, j.source.applicationUrl)).toBe(true);
    const payload = { status: 'OK', data: { jobs: [row()] } };
    const j = normalizeJsearch(payload, 'linkedin', '2026-10-25T00:00:00Z')[0];
    expect(j.workStyle).toBe('unknown');
    expect(j.offices).toEqual([]);
    expect(normalizeJsearch(payload, 'indeed', '2026-10-25T00:00:00Z')).toEqual([]);
    expect(trustedPublisherUrl('linkedin', 'https://linkedin.com.evil.test/jobs/view/123')).toBe(
      false,
    );
    expect(trustedPublisherUrl('indeed', 'http://indeed.com/viewjob?jk=abcdef12')).toBe(false);
    expect(trustedPublisherUrl('indeed', 'https://indeed.com/redirect?jk=abcdef12')).toBe(false);
    expect(
      trustedPublisherUrl('linkedin', 'https://www.linkedin.com/jobs/view/synthetic-12345678'),
    ).toBe(true);
    expect(() => normalizeJsearch({ status: 'OK', data: [] }, 'linkedin', '')).toThrow();
  });
  it('shares daily leases, never sends private profiles, preserves first-seen and retires rolling absence as unknown', async () => {
    const { sqlite, db } = database();
    try {
      let empty = false;
      const calls = vi.fn(async (url: string, options: RequestInit) => {
        expect(options.headers).toEqual({
          'x-api-key': 'synthetic-key',
          Accept: 'application/json',
        });
        expect(url).not.toContain('synthetic-key');
        const u = new URL(url);
        expect(u.searchParams.get('num_pages')).toBe('1');
        return Response.json({
          status: 'OK',
          data: {
            jobs: empty
              ? []
              : [row(u.searchParams.get('query')!.endsWith('linkedin') ? 'LinkedIn' : 'Indeed')],
            cursor: 'has-more',
          },
        });
      });
      vi.stubGlobal('fetch', calls);
      const now = Date.now();
      await ingestJsearch(db, undefined, now);
      expect(calls).not.toHaveBeenCalled();
      await Promise.all([
        ingestJsearch(db, 'synthetic-key', now),
        ingestJsearch(db, 'synthetic-key', now),
      ]);
      expect(calls).toHaveBeenCalledTimes(6);
      const first = await db.all<{ data: string }>('SELECT data FROM niva_jobs');
      expect(first).toHaveLength(2);
      const firstSeen = JSON.parse(first[0].data).source.firstSeenAt;
      await ingestJsearch(db, 'synthetic-key', now + 1000);
      expect(calls).toHaveBeenCalledTimes(6);
      await ingestJsearch(db, 'synthetic-key', now + DAY);
      expect(calls).toHaveBeenCalledTimes(12);
      expect(
        JSON.parse((await db.all<{ data: string }>('SELECT data FROM niva_jobs'))[0].data).source
          .firstSeenAt,
      ).toBe(firstSeen);
      empty = true;
      await ingestJsearch(db, 'synthetic-key', now + 2 * DAY);
      expect(
        (await db.all<{ active: number }>('SELECT active FROM niva_jobs')).every(
          (j) => j.active === 1,
        ),
      ).toBe(true);
      await ingestJsearch(db, 'synthetic-key', now + 9 * DAY);
      const old = await db.all<{ active: number; data: string; version: string }>(
        'SELECT active,data,version FROM niva_jobs',
      );
      expect(
        old.every(
          (j) =>
            !j.active &&
            JSON.parse(j.data).source.availability === 'unknown' &&
            JSON.parse(j.data).source.version === j.version,
        ),
      ).toBe(true);
    } finally {
      sqlite.close();
    }
  });
  it('enforces the shared 180 request ceiling across resets and preserves listings on outage', async () => {
    const { sqlite, db } = database();
    try {
      const now = Date.now();
      const fetcher = vi.fn(async () => Response.json({ status: 'OK', data: { jobs: [row()] } }));
      vi.stubGlobal('fetch', fetcher);
      await ingestJsearch(db, 'synthetic-key', now);
      await db.run("UPDATE niva_documents SET data='{\"used\":179}' WHERE kind='jsearch-budget'");
      await ingestJsearch(db, 'synthetic-key', now + DAY);
      expect(fetcher).toHaveBeenCalledTimes(7);
      const [budget] = await db.all<{ data: string }>(
        "SELECT data FROM niva_documents WHERE kind='jsearch-budget'",
      );
      expect(JSON.parse(budget.data).used).toBe(180);
      expect((await db.all('SELECT id FROM niva_jobs')).length).toBe(1);
      await ingestJsearch(db, 'synthetic-key', now + 31 * DAY);
      expect(fetcher).toHaveBeenCalledTimes(13);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 429 })),
      );
      await ingestJsearch(db, 'synthetic-key', now + 32 * DAY);
      const health = await db.all<{ error: string }>('SELECT error FROM niva_sources');
      expect(health.every((s) => s.error === 'RATE_LIMITED')).toBe(true);
      expect((await db.all('SELECT id FROM niva_jobs')).length).toBe(1);
    } finally {
      sqlite.close();
    }
  });
});
