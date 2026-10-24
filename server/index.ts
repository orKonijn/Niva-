import { runMaintenance } from './maintenance';
import { sqliteCareerDb } from './career-db';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createBackend } from './app';
import { runtime } from './runtime';
import { readFile } from 'node:fs/promises';

const { config, database, options } = runtime();
if (
  !database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='niva_account_state'")
    .get()
)
  throw new Error('Run npm run db:migrate before starting the API.');
if (process.env['NIVA_SCHEDULE_INGESTION'] !== '0' && !options.browserTestMode) {
  const update = () =>
    runMaintenance(sqliteCareerDb(database), { trigger: 'scheduled' }).catch(() =>
      console.error('Job ingestion failed'),
    );
  void update();
  setInterval(() => void update(), 60000).unref();
}
const { app: api, auth, states } = createBackend(database, options);
const app = new Hono();
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  if (config.production) {
    c.header('Strict-Transport-Security', 'max-age=31536000');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://appleid.apple.com",
    );
  }
  await next();
});
app.all('/api/*', (c) => {
  const headers = new Headers(c.req.raw.headers);
  // Direct socket identity only. Never trust a caller's forwarded-IP or identity headers.
  headers.set('x-niva-client-ip', getConnInfo(c).remote.address ?? 'unknown');
  return api.fetch(new Request(c.req.raw, { headers }));
});
app.get('*', async (c, next) => {
  if (/\.[a-z0-9]+$/i.test(new URL(c.req.url).pathname)) return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const theme = session?.user.emailVerified ? states.read(session.user.id).theme : null;
  let html = await readFile('./dist/index.html', 'utf8');
  if (theme)
    html = html.replace('<head>', `<head><meta name="niva-account-theme" content="${theme}">`);
  c.header('Cache-Control', 'private, no-store');
  return c.html(html);
});
app.use('*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));
const port = Number(process.env['PORT'] ?? 4300);
const hostname = process.env['HOST'] ?? '127.0.0.1';
serve({ fetch: app.fetch, port, hostname }, () =>
  console.log(`Niva local app: http://${hostname}:${port}`),
);
