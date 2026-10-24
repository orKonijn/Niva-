import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createAuth, type AuthOptions } from './auth';
import { StateError, stateRepository } from './state';
import { loadFeed, localRealCatalog } from './job-feed';
import { JOBS } from '../src/app/core/data/sample-jobs';

export function createBackend(database: DatabaseSync, options: AuthOptions) {
  database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  const auth = createAuth(database, options);
  const states = stateRepository(database, options.secret, () => [...JOBS, ...localRealCatalog()]);
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.use(
    '/api/*',
    bodyLimit({ maxSize: 32768, onError: (c) => c.json({ error: 'BODY_TOO_LARGE' }, 413) }),
  );
  app.get('/api/config', (c) =>
    c.json({
      email: options.emailEnabled,
      emailDelivery: options.emailEnabled ? (options.emailDelivery ?? 'configured') : 'unavailable',
      google: !!options.google,
      apple: !!options.apple,
      accounts: true,
    }),
  );
  app.all('/api/auth/*', async (c) => {
    if (new URL(c.req.url).pathname === '/api/auth/link-social') {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (
        !session?.user.emailVerified ||
        Date.now() - new Date(session.session.createdAt).getTime() > 600000
      )
        return c.json({ error: 'FRESH_SESSION_REQUIRED' }, 401);
    }
    return auth.handler(c.req.raw);
  });
  app.get('/api/jobs', async (c) => {
    try {
      return c.json(await loadFeed());
    } catch {
      return c.json({ error: 'FEED_UNAVAILABLE' }, 503);
    }
  });
  app.get('/api/session', async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return c.json({
      user: session
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            emailVerified: session.user.emailVerified,
          }
        : null,
    });
  });
  app.all('/api/account/*', async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session || !session.user.emailVerified) return c.json({ error: 'UNAUTHORIZED' }, 401);
    const userId = session.user.id;
    if (
      c.req.method !== 'GET' &&
      (c.req.header('origin') !== options.origin ||
        c.req.header('x-niva-csrf') !== '1' ||
        !c.req.header('content-type')?.startsWith('application/json'))
    )
      return c.json({ error: 'CSRF_REJECTED' }, 403);
    const window = Math.floor(Date.now() / 60000);
    const limit = database
      .prepare(
        'INSERT INTO niva_operation_limits(user_id,window,count) VALUES(?,?,1) ON CONFLICT(user_id,window) DO UPDATE SET count=count+1 RETURNING count',
      )
      .get(userId, window);
    if (Number(limit?.['count']) > 120) {
      c.header('Retry-After', '60');
      return c.json({ error: 'RATE_LIMITED' }, 429);
    }
    database.prepare('DELETE FROM niva_operation_limits WHERE window < ?').run(window - 1440);
    const path = new URL(c.req.url).pathname;
    if (c.req.method === 'GET' && path === '/api/account/state') return c.json(states.read(userId));
    if (c.req.method === 'GET' && path === '/api/account/methods')
      return c.json({
        methods: database
          .prepare('SELECT DISTINCT providerId FROM account WHERE userId = ?')
          .all(userId)
          .map((row) => String(row['providerId'])),
      });
    if (c.req.method === 'POST' && path === '/api/account/import-preview')
      return c.json(states.preview(userId, await c.req.json()));
    if (c.req.method === 'POST' && path === '/api/account/state')
      return c.json(states.mutate(userId, await c.req.json()));
    return c.json({ error: 'NOT_FOUND' }, 404);
  });
  app.onError((error, c) => {
    if (error instanceof StateError)
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 409);
    if (error instanceof SyntaxError) return c.json({ error: 'INVALID_JSON' }, 400);
    // Never return database details, OAuth secrets, tokens, passwords or personal data.
    return c.json({ error: 'SERVER_ERROR' }, 500);
  });
  app.notFound((c) => c.json({ error: 'NOT_FOUND' }, 404));
  return { app, auth, states };
}

/** Explicit migration command / test setup; never invoked by an HTTP request. */
export async function migrateDatabase(database: DatabaseSync, options: AuthOptions) {
  void options;
  database.exec('PRAGMA foreign_keys=ON;');
  database.exec(
    'CREATE TABLE IF NOT EXISTS niva_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  for (const id of ['000_auth', '001_account_data', '002_auth_constraints']) {
    if (!database.prepare('SELECT id FROM niva_migrations WHERE id=?').get(id)) {
      database.exec('BEGIN IMMEDIATE');
      try {
        database.exec(readFileSync(new URL(`./migrations/${id}.sql`, import.meta.url), 'utf8'));
        database
          .prepare('INSERT INTO niva_migrations VALUES (?,?)')
          .run(id, new Date().toISOString());
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  }
}
