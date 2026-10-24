import { verifyStagingReads } from './staging-readiness';
import { afterEach, it, expect, vi } from 'vitest';
import { createServer } from 'node:http';
import { repairHarness, barrier } from './repair-harness';
import { putRecord, listRecords } from './career-records';
import { ingest, discoveryPage } from './discovery';
import { runMaintenance, maintenanceHealth } from './maintenance';
import { checkWatchdog } from './operator-watchdog';
import type { ResumeVersion } from '../src/app/core/models/career';
const active: ReturnType<typeof repairHarness>[] = [];
const setup = (adapter: 'node' | 'd1', env = {}) => {
  const h = repairHarness(adapter, env);
  active.push(h);
  return h;
};
afterEach(() => {
  vi.unstubAllGlobals();
  for (const h of active.splice(0)) h.sqlite.close();
});
const sources = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(
        String(url).includes('greenhouse')
          ? {
              jobs: [
                {
                  id: 101,
                  title: 'Python SQL Engineer',
                  location: { name: 'Herzliya' },
                  absolute_url: 'https://careers.appsflyer.com/jobs/position/101',
                  updated_at: '2026-10-24T10:00:00Z',
                  content: 'Python SQL',
                },
              ],
            }
          : String(url).includes('/scan')
            ? { scan: 'clean', pages: 1, text: 'Synthetic parsed Python SQL candidate' }
            : [],
      ),
    ),
  );
const resume = (id: string): ResumeVersion => ({
  id,
  name: 'Synthetic ' + id,
  text: 'Synthetic Python SQL experience',
  kind: 'original',
  confirmed: true,
  active: false,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
for (const adapter of ['node', 'd1'] as const) {
  it(
    adapter + ' atomically caps concurrent create/edit/tailor/scanner completion at twenty',
    async () => {
      const h = setup(adapter, {
        NIVA_RESUME_PROCESSOR_URL: 'https://synthetic.invalid/scan',
        NIVA_RESUME_PROCESSOR_KEY: 'synthetic',
        NIVA_RESUME_PROCESSOR_NAME: 'Synthetic',
      });
      sources();
      await ingest(h.db);
      for (let i = 0; i < 19; i++)
        await putRecord(h.db, h.owner, 'resume', 'seed-' + i, resume('seed-' + i), true);
      let release!: () => void, entered!: () => void;
      const gate = new Promise<void>((r) => (release = r)),
        allEntered = new Promise<void>((r) => (entered = r));
      let count = 0;
      h.hook(async (sql) => {
        if (sql.startsWith('INSERT INTO niva_documents')) {
          if (++count === 4) entered();
          await gate;
        }
      });
      const calls = [
        h.req('career/resumes', { text: 'Synthetic new candidate Python SQL' }),
        h.req('career/resumes/seed-0/review', {
          text: 'Edited synthetic Python SQL candidate',
          confirmed: true,
        }),
        h.req('career/tailor', { resumeId: 'seed-0', jobId: 'greenhouse-appsflyer-101' }),
        h.req('career/resumes', {
          name: 'synthetic.pdf',
          mime: 'application/pdf',
          base64: Buffer.from('%PDF-synthetic').toString('base64'),
          processingConsent: true,
        }),
      ];
      await allEntered;
      release();
      const responses = await Promise.all(calls);
      expect(responses.filter((r) => r.status === 201 || r.status === 200)).toHaveLength(1);
      expect(responses.filter((r) => r.status === 409)).toHaveLength(3);
      for (const r of responses.filter((r) => r.status === 409))
        expect((await r.json()).error).toBe('VERSION_LIMIT');
      expect(await listRecords(h.db, h.owner, 'resume')).toHaveLength(20);
    },
  );
  it(
    adapter + ' expiry, deletion and scanner failure release capacity without counters',
    async () => {
      const h = setup(adapter, {
        NIVA_RESUME_PROCESSOR_URL: 'https://synthetic.invalid/scan',
        NIVA_RESUME_PROCESSOR_KEY: 'synthetic',
        NIVA_RESUME_PROCESSOR_NAME: 'Synthetic',
      });
      for (let i = 0; i < 20; i++)
        await putRecord(h.db, h.owner, 'resume', 'seed-' + i, resume('seed-' + i), true);
      h.sqlite.prepare("UPDATE niva_documents SET expires_at=0 WHERE id='seed-0'").run();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 503 })),
      );
      expect(
        (
          await h.req('career/resumes', {
            name: 'synthetic.pdf',
            mime: 'application/pdf',
            base64: Buffer.from('%PDF-synthetic').toString('base64'),
            processingConsent: true,
          })
        ).status,
      ).toBe(503);
      expect(
        (await h.req('career/resumes', { text: 'Synthetic replacement after expiry' })).status,
      ).toBe(201);
      expect(await listRecords(h.db, h.owner, 'resume')).toHaveLength(20);
      await h.req('career/resumes/seed-1/delete', {});
      expect(
        (await h.req('career/resumes', { text: 'Synthetic replacement after deletion' })).status,
      ).toBe(201);
      expect(await listRecords(h.db, h.owner, 'resume')).toHaveLength(20);
    },
  );
  it(
    adapter +
      ' coherent snapshots distinguish scoped deletion from account erasure and follow activation',
    async () => {
      const h = setup(adapter);
      for (const id of ['a', 'b']) await putRecord(h.db, h.owner, 'resume', id, resume(id), true);
      await h.req('career/resumes/a/activate', { confirmed: true });
      const first = await (await h.req('career/snapshot')).json();
      await h.req('career/resumes/b/activate', { confirmed: true });
      const second = await (await h.req('career/snapshot')).json();
      expect(second.revision).not.toBe(first.revision);
      expect(
        second.resumes.filter((r: ResumeVersion) => r.active).map((r: ResumeVersion) => r.id),
      ).toEqual(['b']);
      await h.req('career/resumes/a/delete', {});
      const scoped = await (await h.req('career/snapshot')).json();
      expect(scoped.erasure).toBe(first.erasure);
      expect(scoped.epoch).not.toBe(first.epoch);
      await h.remove();
      const erased = await (await h.req('career/snapshot')).json();
      expect(erased.erasure).not.toBe(first.erasure);
      expect(erased.resumes).toEqual([]);
    },
  );
}
it('withholds forbidden citation/URL text from every SSE delta and never persists it', async () => {
  for (const answer of [
    'Invented [job:invented]',
    'Link https://invalid.example',
    'Link www.invalid.example',
  ]) {
    const h = setup('node', { OPENAI_API_KEY: 'synthetic', NIVA_AI_MODEL: 'synthetic' });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'data: ' +
              JSON.stringify({ type: 'response.output_text.delta', delta: answer }) +
              '\n\ndata: {"type":"response.completed"}\n\n',
          ),
      ),
    );
    const body = await (
      await h.req('career/chat', { message: 'Synthetic query', aiConsent: true })
    ).text();
    expect(body).not.toContain(answer);
    expect(body).not.toContain('event: delta');
    expect(body).toContain('AI_REJECTED');
    expect((await listRecords<{ messages: unknown[] }>(h.db, h.owner, 'chat'))[0].messages).toEqual(
      [],
    );
  }
});
it('reports unfinished maintenance as overdue even after an earlier success', async () => {
  const h = setup('node');
  await runMaintenance(h.db, { sources: false, trigger: 'scheduled', now: Date.now() - 7200000 });
  const secret = 'synthetic-secret-more-than-thirty-two-chars';
  const p = setup('node', { NIVA_INGEST_SECRET: secret });
  expect((await p.req('maintenance/health')).status).toBe(401);
  const response = await p.app.request('https://repair.test/api/maintenance/health', {
    headers: { Authorization: 'Bearer ' + secret },
  });
  expect(response.status).toBe(200);
  expect((await response.json()).cleanupOverdue).toBe(true);
});
it('independent watchdog delivers a real loopback alert to a named synthetic operator and handles cooldown/failure', async () => {
  let requests = 0;
  let received: unknown;
  let fail = false;
  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      expect(req.headers.authorization).toBe('Bearer ' + 'x'.repeat(32));
      expect(req.headers['oai-sites-authorization']).toBe('Bearer synthetic-site-service');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ schedulerOverdue: true, cleanupOverdue: true, rows: [] }));
    } else {
      expect(req.headers['oai-sites-authorization']).toBeUndefined();
      requests++;
      let body = '';
      for await (const part of req) body += part;
      received = JSON.parse(body);
      res.statusCode = fail ? 503 : 200;
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    const address = server.address() as { port: number };
    const url = 'http://127.0.0.1:' + address.port;
    const config = {
      healthUrl: url + '/health',
      alertUrl: url + '/alert',
      secret: 'x'.repeat(32),
      operator: 'synthetic-operator',
      siteAuthorization: 'synthetic-site-service',
    };
    const first = await checkWatchdog(config, {}, Date.now());
    expect(first.status).toBe('delivered');
    expect(received).toMatchObject({
      operator: 'synthetic-operator',
      reasons: ['SCHEDULER_OVERDUE', 'CLEANUP_OVERDUE'],
    });
    expect((await checkWatchdog(config, first.state, Date.now() + 1000)).status).toBe('cooldown');
    expect(requests).toBe(1);
    fail = true;
    expect((await checkWatchdog(config, {}, Date.now() + 2000)).status).toBe('delivery-failed');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

for (const adapter of ['node', 'd1'] as const)
  it(
    adapter +
      ' two due source cycles close removals and independent cleanup survives outages within its bound',
    async () => {
      const h = setup(adapter);
      const now = Date.now();
      let cycle = 0;
      const gh = (id: number) => ({
        id,
        title: 'Python SQL Engineer',
        location: { name: 'Herzliya' },
        absolute_url: 'https://careers.appsflyer.com/jobs/position/' + id,
        updated_at: '2026-10-24T10:00:00Z',
        content: 'Python SQL',
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          cycle === 2
            ? new Response('', { status: 503 })
            : Response.json(
                String(url).includes('greenhouse')
                  ? { jobs: cycle === 0 ? [gh(101), gh(102)] : [gh(102)] }
                  : [],
              ),
        ),
      );
      await runMaintenance(h.db, { trigger: 'scheduled', now });
      const first = await discoveryPage(h.db, 'synthetic', {});
      expect(first.total).toBe(2);
      await putRecord(h.db, h.owner, 'resume', 'expiry', resume('expiry'), true);
      h.sqlite.prepare("UPDATE niva_documents SET expires_at=? WHERE id='expiry'").run(now + 60000);
      cycle = 1;
      await runMaintenance(h.db, { trigger: 'scheduled', now: now + 1000000 });
      const second = await discoveryPage(h.db, 'synthetic', {});
      expect(second.total).toBe(1);
      expect(second.health.every((r, i) => r.checked_at !== first.health[i].checked_at)).toBe(true);
      expect(
        h.sqlite
          .prepare("SELECT active FROM niva_jobs WHERE id='greenhouse-appsflyer-101'")
          .get()?.['active'],
      ).toBe(0);
      expect(h.sqlite.prepare("SELECT * FROM niva_documents WHERE id='expiry'").all()).toEqual([]);
      cycle = 2;
      await runMaintenance(h.db, { trigger: 'scheduled', now: now + 2000000 });
      const stale = await discoveryPage(h.db, 'synthetic', {});
      expect(stale.total).toBe(1);
      expect(stale.stale).toBe(true);
      expect(stale.health.every((r) => r.error === 'SOURCE_UNAVAILABLE')).toBe(true);
    },
  );

it('staging read harness refuses production and labels redirect-only boundaries unverified (mock boundary)', async () => {
  const config = {
    origin: 'https://staging.example.test',
    aliceCookie: 'synthetic-a',
    bobCookie: 'synthetic-b',
    aliceResumeId: 'synthetic-id',
    syntheticMarker: 'SYNTHETIC-STAGING-fixture',
    disposable: true,
  };
  const never = vi.fn();
  await expect(
    verifyStagingReads(
      { ...config, origin: 'https://niva-demo-ziv-20261023.ork77.chatgpt.site' },
      never,
    ),
  ).rejects.toThrow('SEPARATE_STAGING_ORIGIN_REQUIRED');
  expect(never).not.toHaveBeenCalled();
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    const headers = init?.headers as Record<string, string>;
    if (path.endsWith('/api/session'))
      return Response.json({ user: { id: headers['Cookie'] === 'synthetic-a' ? 'alice' : 'bob' } });
    if (path.endsWith('/export'))
      return headers['Cookie'] === 'synthetic-a'
        ? new Response('SYNTHETIC-STAGING-fixture Python SQL')
        : Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    return new Response('', { status: 302, headers: { location: '/login' } });
  });
  const results = await verifyStagingReads(config, fetcher);
  expect(results.find((c) => c.gate === 'known-owner-record-isolation')?.status).toBe('passed');
  expect(results.find((c) => c.gate === 'site-forged-header')?.status).toBe('unverified');
  expect(results.find((c) => c.gate === 'direct-origin')?.status).toBe('unverified');
});

it('staging Site service credential is never sent to an alternate origin (mock boundary)', async () => {
  const calls: { origin: string; headers: Record<string, string> }[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url));
    const headers = init?.headers as Record<string, string>;
    calls.push({ origin: parsed.origin, headers });
    if (parsed.pathname === '/api/session')
      return Response.json({ user: { id: headers['Cookie'] === 'a' ? 'alice' : 'bob' } });
    if (parsed.pathname.endsWith('/export'))
      return headers['Cookie'] === 'a'
        ? new Response('SYNTHETIC-STAGING-fixture')
        : new Response('', { status: 404 });
    return new Response('', { status: 401 });
  });
  await verifyStagingReads(
    {
      origin: 'https://staging.example.test',
      directOrigin: 'https://direct.example.test',
      aliceCookie: 'a',
      bobCookie: 'b',
      aliceResumeId: 'synthetic',
      syntheticMarker: 'SYNTHETIC-STAGING-fixture',
      disposable: true,
      siteAuthorization: 'synthetic-service',
    },
    fetcher,
  );
  expect(
    calls.find((c) => c.origin === 'https://direct.example.test')?.headers[
      'OAI-Sites-Authorization'
    ],
  ).toBeUndefined();
  expect(
    calls.find(
      (c) => c.headers['oai-authenticated-user-id'] && c.origin === 'https://staging.example.test',
    )?.headers['OAI-Sites-Authorization'],
  ).toBe('Bearer synthetic-service');
});

it('external/manual run health is distinct from native schedule evidence and stale runs alert', async () => {
  const h = setup('node');
  sources();
  const now = Date.now();
  await runMaintenance(h.db, { trigger: 'manual', now });
  const healthy = await maintenanceHealth(h.db, now);
  expect(healthy.scheduledObserved).toBe(false);
  expect(healthy.schedulerOverdue).toBe(true);
  expect(healthy.ingestionOverdue).toBe(false);
  const config = {
    healthUrl: 'https://staging.example.test/api/maintenance/health',
    secret: 'x'.repeat(32),
    operator: 'synthetic-operator',
    alertUrl: 'https://alerts.example.test',
  };
  const receiver = vi.fn(async () => Response.json(healthy));
  expect((await checkWatchdog(config, {}, now, receiver)).status).toBe('healthy');
  expect(receiver).toHaveBeenCalledTimes(1);
  const overdue = await maintenanceHealth(h.db, now + 21 * 60000);
  const requests = vi.fn(async (url: string | URL | Request) =>
    String(url) === config.healthUrl ? Response.json(overdue) : new Response(''),
  );
  const result = await checkWatchdog(config, {}, now + 21 * 60000, requests);
  expect(result.status).toBe('delivered');
  expect(result.reasons).toContain('INGESTION_OVERDUE');
});
