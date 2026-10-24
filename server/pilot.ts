import { createCareer, type CareerEnvironment } from './career';
import { d1CareerDb } from './career-db';
import { catalogJobs } from './discovery';
import type { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { emptyAccountState, type AccountState } from '../src/app/core/models/account-state';
import { JOBS } from '../src/app/core/data/sample-jobs';
import { applyStateOperation, importReceipt, normalizeImport, StateError } from './state';
import { FEED_URL, normalizeFeed, type Feed } from './job-feed';
import type { Job } from '../src/app/core/models/job';

export interface PilotEnv extends CareerEnvironment {
  DB: D1Database;
  NIVA_IMPORT_SECRET: string;
}
export function platformUser(request: Request) {
  // Sites dispatch strips caller identity headers and injects the authenticated Site identity.
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id || id.length > 200) return null;
  const email = request.headers.get('oai-authenticated-user-email') ?? '';
  let name = request.headers.get('oai-authenticated-user-full-name') ?? '';
  if (
    request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8'
  ) {
    try {
      name = decodeURIComponent(name);
    } catch {
      name = '';
    }
  }
  return { id: `sites:${id}`, email, name: name.slice(0, 100), emailVerified: true };
}
async function readState(db: D1Database, owner: string): Promise<AccountState> {
  const row = await db
    .prepare('SELECT data,revision,imported_at FROM niva_pilot_states WHERE user_id=?')
    .bind(owner)
    .first<{ data: string; revision: number; imported_at: string | null }>();
  return row
    ? { ...JSON.parse(row.data), revision: row.revision, importedAt: row.imported_at }
    : emptyAccountState();
}
async function catalog(db: D1Database): Promise<Job[]> {
  const result = await db
    .prepare('SELECT data,active FROM niva_pilot_jobs')
    .all<{ data: string; active: number }>();
  return [
    ...(await catalogJobs(d1CareerDb(db))),
    ...result.results.map((row) => {
      const job = JSON.parse(row.data) as Job;
      job.source!.active = row.active === 1;
      return job;
    }),
  ];
}
let feedPending: Promise<Feed> | undefined;
export async function pilotFeed(db: D1Database): Promise<Feed> {
  const stored = await db
    .prepare('SELECT data,fetched_at FROM niva_pilot_feed WHERE id=?')
    .bind('appsflyer')
    .first<{ data: string; fetched_at: string }>();
  if (stored && Date.now() - Date.parse(stored.fetched_at) < 600000)
    return JSON.parse(stored.data) as Feed;
  if (feedPending) return feedPending;
  feedPending = (async () => {
    try {
      const response = await fetch(FEED_URL, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('FEED_UNAVAILABLE');
      const fetchedAt = new Date().toISOString();
      const feed: Feed = {
        jobs: normalizeFeed(await response.json(), fetchedAt),
        fetchedAt,
        stale: false,
      };
      await db.batch([
        db.prepare('UPDATE niva_pilot_jobs SET active=0'),
        ...feed.jobs.map((job) =>
          db
            .prepare(
              'INSERT INTO niva_pilot_jobs(id,data,active) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,active=1',
            )
            .bind(job.id, JSON.stringify(job)),
        ),
        db
          .prepare(
            'INSERT INTO niva_pilot_feed(id,data,fetched_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,fetched_at=excluded.fetched_at',
          )
          .bind('appsflyer', JSON.stringify(feed), fetchedAt),
      ]);
      return feed;
    } catch {
      if (stored)
        return { ...JSON.parse(stored.data), stale: true, error: 'FEED_UNAVAILABLE' } as Feed;
      throw new StateError(503, 'FEED_UNAVAILABLE');
    } finally {
      feedPending = undefined;
    }
  })();
  return feedPending;
}
export function createPilot(
  env: PilotEnv,
  execution?: { waitUntil(work: Promise<unknown>): void },
) {
  if (!env.DB || !env.NIVA_IMPORT_SECRET || env.NIVA_IMPORT_SECRET.length < 32)
    throw new Error('PILOT_NOT_CONFIGURED');
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.use('/api/*', async (c, next) =>
    c.req.path.startsWith('/api/career/')
      ? bodyLimit({ maxSize: 1100000, onError: (c) => c.json({ error: 'BODY_TOO_LARGE' }, 413) })(
          c,
          next,
        )
      : bodyLimit({ maxSize: 32768, onError: (c) => c.json({ error: 'BODY_TOO_LARGE' }, 413) })(
          c,
          next,
        ),
  );
  app.route(
    '/',
    createCareer({
      db: d1CareerDb(env.DB),
      secret: env.NIVA_IMPORT_SECRET,
      env,
      keepAlive: (work) => execution?.waitUntil(work),
      identity: async (request) => platformUser(request)?.id ?? null,
      state: (owner) => readState(env.DB, owner),
    }),
  );
  app.get('/api/config', (c) =>
    c.json({
      accounts: true,
      discovery: true,
      platform: 'sites',
      realJobs: true,
      email: false,
      google: false,
      apple: false,
    }),
  );
  app.get('/api/session', (c) => c.json({ user: platformUser(c.req.raw) }));
  app.get('/api/jobs', async (c) => {
    const feed = await pilotFeed(env.DB);
    const user = platformUser(c.req.raw);
    const saved = user ? (await readState(env.DB, user.id)).saved : [];
    const archived = saved.length
      ? (await catalog(env.DB)).filter((j) => !j.source!.active && saved.includes(j.id))
      : [];
    return c.json({ ...feed, archived });
  });
  app.all('/api/auth/*', (c) => c.json({ error: 'PROVIDER_NOT_CONFIGURED' }, 503));
  app.all('/api/account/*', async (c) => {
    const user = platformUser(c.req.raw);
    if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401);
    if (
      c.req.method !== 'GET' &&
      (c.req.header('origin') !== new URL(c.req.url).origin ||
        c.req.header('x-niva-csrf') !== '1' ||
        !c.req.header('content-type')?.startsWith('application/json'))
    )
      return c.json({ error: 'CSRF_REJECTED' }, 403);
    const window = Math.floor(Date.now() / 60000);
    const limit = await env.DB.prepare(
      'INSERT INTO niva_pilot_limits(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count',
    )
      .bind(user.id, window)
      .first<{ count: number }>();
    if (Number(limit?.count) > 120) {
      c.header('Retry-After', '60');
      return c.json({ error: 'RATE_LIMITED' }, 429);
    }
    const path = new URL(c.req.url).pathname;
    const state = await readState(env.DB, user.id);
    if (c.req.method === 'GET' && path === '/api/account/state') return c.json(state);
    if (c.req.method === 'GET' && path === '/api/account/methods')
      return c.json({ methods: ['chatgpt'] });
    if (c.req.method === 'POST' && path === '/api/account/import-preview') {
      if (state.importedAt) throw new StateError(409, 'ALREADY_IMPORTED');
      const data = normalizeImport(await c.req.json());
      return c.json({
        data,
        revision: state.revision,
        receipt: importReceipt(env.NIVA_IMPORT_SECRET, user.id, data, state.revision),
        counts: { saved: data.saved.length, demoApprovals: data.applications.length },
      });
    }
    if (c.req.method === 'POST' && path === '/api/account/state') {
      const input = await c.req.json();
      const next = applyStateOperation(user.id, state, input, env.NIVA_IMPORT_SECRET, [
        ...JOBS,
        ...(await catalog(env.DB)),
      ]);
      // A single compare-and-swap statement atomically handles first insert and concurrent updates.
      const result = await env.DB.prepare(
        'INSERT INTO niva_pilot_states(user_id,revision,data,imported_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,imported_at=excluded.imported_at,updated_at=excluded.updated_at WHERE niva_pilot_states.revision=? RETURNING revision',
      )
        .bind(
          user.id,
          next.revision,
          JSON.stringify(next),
          next.importedAt,
          new Date().toISOString(),
          state.revision,
        )
        .first();
      if (!result) throw new StateError(409, 'CONFLICT');
      if (input.operation?.type === 'delete-data')
        await env.DB.prepare('DELETE FROM niva_documents WHERE owner=?').bind(user.id).run();
      return c.json(next);
    }
    return c.json({ error: 'NOT_FOUND' }, 404);
  });
  app.onError((error, c) =>
    error instanceof StateError
      ? c.json({ error: error.message }, error.status as 400 | 401 | 403 | 409 | 503)
      : c.json({ error: 'SERVICE_UNAVAILABLE' }, 503),
  );
  app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));
  return { app, readState: (owner: string) => readState(env.DB, owner) };
}
