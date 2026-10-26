import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { repairHarness } from './repair-harness';
import { createCareer } from './career';
import { emptyAccountState } from '../src/app/core/models/account-state';
import type { Job } from '../src/app/core/models/job';
import { catalogJob, discoveryPage } from './discovery';
import { putRecord, readRecord, takeQuota } from './career-records';
import { verifyJob } from './job-verification';
import { matchesDistrict } from '../src/app/core/preferences';
import { trustedJobUrl, isSupportedListingId } from '../src/app/core/source-registry';
import { runMaintenance, maintenanceHealth, CLEANUP_BOUND_MS } from './maintenance';
const sample = JSON.parse(readFileSync('tests/fixtures/jsearch-public-20261025.json', 'utf8'))
  .jobs[0] as Job;
function insert(h: ReturnType<typeof repairHarness>, job: Job, active = 1) {
  h.sqlite
    .prepare(
      'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      job.id,
      job.source!.sourceId!,
      job.source!.applicationUrl,
      job.company.toLowerCase(),
      job.title.toLowerCase(),
      job.district,
      job.category,
      job.workStyle,
      `${job.title} ${job.company}`.toLowerCase(),
      active,
      job.source!.version ?? 'synthetic-v1',
      JSON.stringify(job),
    );
}
const open: ReturnType<typeof repairHarness>[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.sqlite.close();
  vi.unstubAllGlobals();
});
function setup(adapter: 'node' | 'd1') {
  const h = repairHarness(adapter);
  open.push(h);
  const states = new Map([
    ['A', emptyAccountState()],
    ['B', emptyAccountState()],
  ]);
  // Only this disposable boundary maps opaque synthetic session cookies to identity.
  // Caller identity/IP headers are deliberately ignored.
  const app = createCareer({
    db: h.db,
    secret: 'synthetic-application-secret-at-least-32-characters',
    env: {},
    identity: async (req) => {
      const c = req.headers.get('cookie') ?? '';
      return c.includes('review_session=A')
        ? h.owner
        : c.includes('review_session=B')
          ? 'independent-bob'
          : null;
    },
    state: async (owner) => states.get(owner === h.owner ? 'A' : 'B')!,
  });
  const request = (path: string, cookie = '', headers: Record<string, string> = {}) =>
    app.request('https://review.test/api/' + path, {
      headers: { ...headers, ...(cookie ? { cookie } : {}) },
    });
  return { ...h, app, states, request };
}
for (const adapter of ['node', 'd1'] as const)
  describe(`review36 isolated ${adapter} regressions`, () => {
    it('denies expired reads immediately and cleans in two simulated cycles despite source outages', async () => {
      const h = setup(adapter);
      const now = Date.now();
      await h.db.run(
        'INSERT INTO niva_career_limits(key,count,window) VALUES(?,?,?)',
        'apply:visitor:expired-synthetic',
        1,
        Math.floor(now / 60000) - 3,
      );
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 503 })),
      );
      for (const cycle of [0, 1]) {
        const at = now + cycle * (CLEANUP_BOUND_MS - 1000);
        await putRecord(
          h.db,
          h.owner,
          'resume',
          'expired',
          { confirmed: true, text: 'Synthetic only' },
          true,
        );
        await h.db.run("UPDATE niva_documents SET expires_at=? WHERE id='expired'", now - 1);
        await h.db.run(
          'UPDATE niva_career_owners SET active_resume_id=? WHERE owner=?',
          'expired',
          h.owner,
        );
        await expect(readRecord(h.db, h.owner, 'resume', 'expired')).rejects.toMatchObject({
          status: 404,
          message: 'NOT_FOUND',
        });
        expect(await h.db.all("SELECT id FROM niva_documents WHERE id='expired'")).toHaveLength(1);
        await runMaintenance(h.db, { trigger: 'scheduled', now: at });
        expect(
          await h.db.all(
            "SELECT key FROM niva_career_limits WHERE key='apply:visitor:expired-synthetic'",
          ),
        ).toHaveLength(0);
        expect(await h.db.all("SELECT id FROM niva_documents WHERE id='expired'")).toHaveLength(0);
        expect(
          (
            await h.db.all<{ active_resume_id: string | null }>(
              'SELECT active_resume_id FROM niva_career_owners WHERE owner=?',
              h.owner,
            )
          )[0].active_resume_id,
        ).toBeNull();
        const health = await maintenanceHealth(h.db, at + 1);
        expect(health.cleanupOverdue).toBe(false);
        expect(health.rows.find((r) => r.id === 'ingestion')?.error).toBe('SOURCE_FAILURE');
        expect(health.alerts.deliveryVerified).toBe(false);
      }
      expect((await maintenanceHealth(h.db, now + 2 * CLEANUP_BOUND_MS + 1)).cleanupOverdue).toBe(
        true,
      );
    });
    it('does not confuse source-only refresh with retention, and reports cleanup failure', async () => {
      const h = setup(adapter);
      const secret = 'synthetic-maintenance-secret-at-least-32-characters';
      const app = createCareer({
        db: h.db,
        secret,
        env: { NIVA_INGEST_SECRET: secret },
        identity: async () => null,
        state: async () => emptyAccountState(),
      });
      await putRecord(
        h.db,
        h.owner,
        'resume',
        'expired',
        { id: 'expired', text: 'Synthetic only' },
        true,
      );
      await h.db.run("UPDATE niva_documents SET expires_at=0 WHERE id='expired'");
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 503 })),
      );
      const response = await app.request('https://review.test/api/ingestion/refresh', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + secret },
      });
      expect((await response.json()).scope).toBe('job-sources-only');
      expect(await h.db.all("SELECT id FROM niva_documents WHERE id='expired'")).toHaveLength(1);
      await expect(readRecord(h.db, h.owner, 'resume', 'expired')).rejects.toMatchObject({
        status: 404,
        message: 'NOT_FOUND',
      });
      const batch = h.db.batch.bind(h.db);
      h.db.batch = async () => {
        throw new Error('Synthetic storage failure');
      };
      await expect(runMaintenance(h.db, { sources: false })).rejects.toThrow('CLEANUP_FAILED');
      expect((await maintenanceHealth(h.db)).cleanupFailed).toBe(true);
      h.db.batch = batch;
      await runMaintenance(h.db, { sources: false });
      expect(await h.db.all("SELECT id FROM niva_documents WHERE id='expired'")).toHaveLength(0);
    });
    it('bounds indexed lookup and preserves archived saved/conversation authorization', async () => {
      const h = setup(adapter),
        job = structuredClone(sample);
      insert(h, job, 0);
      let jobRows = 0;
      const all = h.db.all.bind(h.db);
      h.db.all = async <T>(sql: string, ...args: (string | number | null)[]) => {
        const r = await all<T>(sql, ...args);
        if (sql.includes('FROM niva_jobs')) {
          expect(sql).toContain('WHERE id=?');
          jobRows += r.length;
        }
        return r;
      };
      expect((await h.request('listings/' + job.id)).status).toBe(404);
      expect((await h.request('listings/' + job.id, 'review_session=A')).status).toBe(404);
      h.states.get('A')!.saved = [job.id];
      let r = await h.request('listings/' + job.id, 'review_session=A');
      expect(r.status).toBe(200);
      expect((await r.json()).source.active).toBe(false);
      expect((await h.request('listings/' + job.id, 'review_session=B')).status).toBe(404);
      h.states.get('A')!.saved = [];
      await putRecord(
        h.db,
        h.owner,
        'chat',
        'synthetic-chat',
        { id: 'synthetic-chat', messages: [{ references: [{ id: job.id }] }] },
        true,
      );
      expect((await h.request('listings/' + job.id, 'review_session=A')).status).toBe(200);
      await h.db.run("UPDATE niva_documents SET expires_at=0 WHERE kind='chat'");
      expect((await h.request('listings/' + job.id, 'review_session=A')).status).toBe(404);
      expect(await catalogJob(h.db, 'missing')).toBeUndefined();
      expect(jobRows).toBe(6);
    });
    it('isolates visitor limits, limits cookie-less missing IDs and ignores spoofed caller identity', async () => {
      const h = setup(adapter);
      insert(h, structuredClone(sample));
      for (let i = 0; i < 120; i++)
        expect(
          (
            await h.request('apply/nonexistent', '', {
              'oai-authenticated-user-id': 'forged-' + i,
              'x-niva-client-ip': 'spoof-' + i,
            })
          ).status,
        ).toBe(404);
      const denied = await h.request('apply/nonexistent');
      expect(denied.status).toBe(429);
      expect(denied.headers.get('retry-after')).toBe('60');
      expect((await denied.json()).retryAfterSeconds).toBe(60);
      expect((await h.request('apply/' + sample.id, 'review_session=B')).status).toBe(303);
      const anonymous = await h.request('apply/' + sample.id);
      expect(anonymous.status).toBe(303);
      const cookie = anonymous.headers.get('set-cookie')!.split(';')[0];
      expect(cookie).toContain('niva-apply-visitor=');
      for (let i = 0; i < 119; i++)
        expect((await h.request('apply/nonexistent', cookie)).status).toBe(404);
      // The first anonymous handoff used one request in this signed visitor bucket.
      const limited = await h.request('apply/' + sample.id, cookie, { accept: 'text/html' });
      expect(limited.status).toBe(429);
      expect(await limited.text()).toContain('בחזרה למשרה');
      expect((await h.request('apply/' + sample.id, 'review_session=A')).status).toBe(303);
      expect((await h.request('apply/' + sample.id)).status).toBe(303);
      expect(await h.db.all("SELECT * FROM niva_career_limits WHERE key='apply:shared'")).toEqual(
        [],
      );
    });
    it('keeps cached and known valid handoffs usable when shared verification is exhausted', async () => {
      const h = setup(adapter);
      const job = structuredClone(sample);
      job.id = 'greenhouse-canopycare-123';
      job.source!.sourceId = 'greenhouse-canopycare';
      job.source!.applicationUrl = 'https://job-boards.greenhouse.io/canopycare/jobs/123';
      job.source!.applicationCheck = {
        status: 'reachable',
        checkedAt: new Date().toISOString(),
        note: 'Synthetic cached path',
      };
      insert(h, job);
      await h.db.run(
        'INSERT INTO niva_career_limits(key,count,window) VALUES(?,?,?)',
        'verification:shared',
        120,
        Math.floor(Date.now() / 60000),
      );
      const upstream = vi.fn();
      vi.stubGlobal('fetch', upstream);
      expect((await h.request('apply/' + job.id, 'review_session=A')).status).toBe(303);
      expect(upstream).not.toHaveBeenCalled();
      const old = { ...job, source: { ...job.source!, applicationCheck: undefined } };
      const checked = await verifyJob(h.db, old);
      expect(checked.source!.applicationCheck!.status).toBe('unverified');
      expect(upstream).not.toHaveBeenCalled();
      expect(await takeQuota(h.db, 'verification:shared', 120, 60000)).toBe(false);
    });
    it('normalizes padded/empty/case/Hebrew search and cursor keys; leaves location matching literal', async () => {
      const h = setup(adapter);
      for (let n = 0; n < 3; n++) {
        const j = structuredClone(sample);
        j.id = 'jsearch-linkedin-' + String(n).padStart(24, '0');
        j.title = n === 2 ? 'מנהל מוצר' : 'Product Manager ' + n;
        j.source!.applicationUrl = `https://www.linkedin.com/jobs/view/${1234 + n}`;
        j.source!.location = 'Tel Aviv, Israel';
        insert(h, j);
      }
      for (const q of ['Product Manager', ' Product Manager ', '\tPRODUCT MANAGER\n'])
        expect((await discoveryPage(h.db, 'secret', { scope: 'all', q })).total).toBe(2);
      for (const q of ['', '   ', '\n\t'])
        expect((await discoveryPage(h.db, 'secret', { scope: 'all', q })).total).toBe(3);
      expect((await discoveryPage(h.db, 'secret', { scope: 'all', q: ' מנהל מוצר ' })).total).toBe(
        1,
      );
      const first = await discoveryPage(h.db, 'secret', {
        scope: 'all',
        q: ' Product Manager ',
        limit: '1',
      });
      const next = await discoveryPage(h.db, 'secret', {
        scope: 'all',
        q: 'product manager',
        limit: '1',
        cursor: first.nextCursor!,
      });
      expect(next.jobs[0].id).not.toBe(first.jobs[0].id);
      expect(
        (await discoveryPage(h.db, 'secret', { scope: 'all', location: 'Tel Aviv' })).total,
      ).toBe(3);
      expect(
        (await discoveryPage(h.db, 'secret', { scope: 'all', location: ' Tel Aviv ' })).total,
      ).toBe(0);
    });
    it('matches primary, secondary, multi-office, unknown and negative district cases', async () => {
      const h = setup(adapter);
      const multi = structuredClone(sample);
      multi.id = 'jsearch-linkedin-' + '1'.repeat(24);
      multi.district = 'unknown';
      multi.offices = [
        {
          id: 't',
          country: 'IL',
          district: 'tel-aviv',
          city: 'Synthetic TLV',
          precision: 'unknown',
          demonstration: true,
        },
        {
          id: 'h',
          country: 'IL',
          district: 'haifa',
          city: 'Synthetic Haifa',
          precision: 'unknown',
          demonstration: true,
        },
      ];
      insert(h, multi);
      const primary = structuredClone(sample);
      primary.id = 'jsearch-linkedin-' + '2'.repeat(24);
      primary.district = 'haifa';
      primary.offices = [];
      primary.source!.applicationUrl = 'https://www.linkedin.com/jobs/view/2345';
      insert(h, primary);
      const unknown = structuredClone(sample);
      unknown.id = 'jsearch-linkedin-' + '3'.repeat(24);
      unknown.district = 'unknown';
      unknown.offices = [];
      unknown.source!.applicationUrl = 'https://www.linkedin.com/jobs/view/3456';
      insert(h, unknown);
      for (const [district, count] of [
        ['haifa', 2],
        ['tel-aviv', 1],
        ['south', 0],
        ['all', 3],
      ] as const) {
        const result = await discoveryPage(h.db, 'secret', { scope: 'all', district });
        expect(result.total).toBe(count);
        expect(result.jobs.every((j) => matchesDistrict(j, district))).toBe(true);
      }
      expect(matchesDistrict(unknown, 'haifa')).toBe(false);
    });
  });
it('centralizes supported IDs without accepting forged hosts or malformed publisher IDs', () => {
  expect(isSupportedListingId(sample.id)).toBe(true);
  expect(isSupportedListingId('jsearch-indeed-' + 'a'.repeat(24))).toBe(true);
  expect(isSupportedListingId('jsearch-indeed-invalid')).toBe(false);
  expect(isSupportedListingId('greenhouse-unknown-123')).toBe(false);
  expect(trustedJobUrl(sample.id, 'https://www.linkedin.com.evil.test/jobs/view/123')).toBe(false);
});
