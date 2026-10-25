import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import {
  assetCache,
  canonicalRedirect,
  deploymentPolicy,
  pageMetadata,
  robots,
  sitemap,
} from './deployment-policy';
import { hostedApp } from './hosted-app';
import type { PilotEnv } from './pilot';
import { createCareer } from './career';
import { sqliteCareerDb } from './career-db';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { vi } from 'vitest';
const publicEnv = {
  NIVA_PUBLIC_ORIGIN: 'https://niva.example',
  NIVA_REDIRECT_HOSTS: 'www.niva.example,legacy.example',
  NIVA_ALLOW_INDEXING: '1',
};
const sqlites: DatabaseSync[] = [];
function env(): PilotEnv {
  const sqlite = new DatabaseSync(':memory:');
  sqlites.push(sqlite);
  for (const f of readdirSync('drizzle').filter((f) => f.endsWith('.sql')))
    sqlite.exec(readFileSync('drizzle/' + f, 'utf8'));
  const DB = {
    prepare(sql: string) {
      return {
        async first() {
          return sqlite.prepare(sql).get();
        },
        async all() {
          return { results: sqlite.prepare(sql).all() };
        },
      };
    },
  } as unknown as D1Database;
  return {
    DB,
    NIVA_IMPORT_SECRET: 'synthetic-only-import-secret-at-least-32-characters',
    ...publicEnv,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  for (const s of sqlites.splice(0)) s.close();
});
it('source-only refresh requires its secret, reports provider health and preserves expired private records', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlites.push(sqlite);
  for (const file of readdirSync('server/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync('server/migrations/' + file, 'utf8'));
  const db = sqliteCareerDb(sqlite),
    admin = 'synthetic-administrator-secret-at-least-32-characters';
  sqlite
    .prepare('INSERT INTO niva_documents(id,owner,kind,epoch,expires_at,data) VALUES(?,?,?,?,?,?)')
    .run('synthetic-expired', 'synthetic-owner', 'resume', '0', 2, '{}');
  vi.stubGlobal('fetch', async (url: string | URL | Request) =>
    Response.json(
      String(url).includes('greenhouse')
        ? { jobs: [] }
        : String(url).includes('jobicy.com')
          ? { jobs: [], hasMore: false, nextCursor: null }
          : [],
    ),
  );
  const app = createCareer({
    db,
    secret: admin,
    env: { NIVA_INGEST_SECRET: admin },
    identity: async () => null,
    state: async () => emptyAccountState(),
  });
  expect(
    (await app.request('https://niva.example/api/ingestion/refresh', { method: 'POST' })).status,
  ).toBe(401);
  const response = await app.request('https://niva.example/api/ingestion/refresh', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + admin },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ scope: 'job-sources-only', healthy: true });
  expect(
    sqlite
      .prepare(
        "SELECT count(*) AS n FROM niva_documents WHERE owner='synthetic-owner' AND id='synthetic-expired' AND kind='resume'",
      )
      .get()?.['n'],
  ).toBe(1);
  expect(
    sqlite.prepare("SELECT count(*) AS n FROM niva_maintenance WHERE id='retention'").get()?.['n'],
  ).toBe(0);
});
describe('approved public hostname and indexing policy', () => {
  it('requires an exact HTTPS origin and explicit aliases', () => {
    for (const origin of [
      'http://niva.example',
      'https://niva.example/path',
      'https://user:pass@niva.example',
      'https://niva.example?x=1',
    ])
      expect(() => deploymentPolicy({ NIVA_PUBLIC_ORIGIN: origin })).toThrow();
    expect(() => deploymentPolicy({ ...publicEnv, NIVA_REDIRECT_HOSTS: '*.example' })).toThrow();
  });
  it('redirects only approved public GET/HEAD aliases, preserving path/query', () => {
    expect(
      canonicalRedirect(new Request('https://www.niva.example/privacy?from=old'), publicEnv),
    ).toBe('https://niva.example/privacy?from=old');
    expect(canonicalRedirect(new Request('http://niva.example/terms'), publicEnv)).toBe(
      'https://niva.example/terms',
    );
    for (const url of [
      'https://evil.example/',
      'https://niva.example/',
      'https://www.niva.example/api/account/state',
      'https://www.niva.example/callback',
      'https://www.niva.example/signin-with-chatgpt',
    ])
      expect(canonicalRedirect(new Request(url), publicEnv)).toBeNull();
    expect(
      canonicalRedirect(new Request('https://www.niva.example/app', { method: 'POST' }), publicEnv),
    ).toBeNull();
  });
  it('indexes only approved public information pages and strips query from canonical tags', () => {
    const page = pageMetadata(
      '<html><head></head></html>',
      new URL('https://niva.example/?privateQuery=never-index'),
      publicEnv,
    );
    expect(page.index).toBe(true);
    expect(page.html).toContain('href="https://niva.example/"');
    expect(page.html).not.toContain('privateQuery');
    for (const path of [
      '/app/jobs',
      '/account',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/unknown',
    ])
      expect(pageMetadata('<head>', new URL('https://niva.example' + path), publicEnv).index).toBe(
        false,
      );
    expect(pageMetadata('<head>', new URL('https://niva.example/'), {}).html).toContain(
      'noindex,nofollow',
    );
  });
  it('publishes no sitemap or hostname until explicitly enabled', () => {
    expect(robots({})).toBe('User-agent: *\nDisallow: /\n');
    expect(sitemap({})).toBeNull();
    expect(sitemap({ ...publicEnv, NIVA_ALLOW_INDEXING: '0' })).toBeNull();
    expect(robots(publicEnv)).toContain('Disallow: /reset-password');
    expect(robots(publicEnv)).toContain('Sitemap: https://niva.example/sitemap.xml');
    expect(sitemap(publicEnv)?.match(/<url>/g)).toHaveLength(4);
    expect(sitemap(publicEnv)).not.toContain('/app');
  });
  it('keeps bootstrap/metadata revalidatable and fingerprints immutable', () => {
    expect(assetCache('/main-Abc123.js')).toContain('immutable');
    expect(assetCache('/styles-Xyz987.css')).toContain('immutable');
    expect(assetCache('/theme-init.js')).toBe('no-cache');
    expect(assetCache('/build-info.json')).toBe('no-store');
    expect(assetCache('/assets/niva-hero.webp')).not.toContain('immutable');
  });
});
describe('actual hosted handler with disposable SQLite schema', () => {
  const encode = (s: string) => Buffer.from(s).toString('base64');
  const handler = hostedApp({
    '/index.html': {
      body: encode('<html lang="he" dir="rtl"><head></head><body>עברית</body></html>'),
      type: 'text/html',
    },
    '/main-TestHash.js': { body: encode('console.log("fixture")'), type: 'text/javascript' },
  });
  it('health checks schema without reading or deleting account data', async () => {
    const e = env(),
      r = await handler.fetch(new Request('https://niva.example/healthz'), e);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      service: 'niva',
      status: 'ok',
      checks: { database: 'ok', schema: 'ok' },
    });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(
      (await handler.fetch(new Request('https://niva.example/healthz', { method: 'POST' }), e))
        .status,
    ).toBe(405);
    expect(
      await (
        await handler.fetch(new Request('https://niva.example/healthz', { method: 'HEAD' }), e)
      ).text(),
    ).toBe('');
  });
  it('health fails closed for missing schema/configuration and omits internals', async () => {
    const e = env();
    e.NIVA_IMPORT_SECRET = '';
    const r = await handler.fetch(new Request('https://niva.example/healthz'), e);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toMatch(/secret|sqlite|password/);
  });
  it('anonymous HTML and static assets survive unavailable database configuration', async () => {
    const e = env();
    e.NIVA_IMPORT_SECRET = '';
    const r = await handler.fetch(new Request('https://niva.example/app/jobs'), e);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('עברית');
    expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
    const asset = await handler.fetch(new Request('https://niva.example/main-TestHash.js'), e);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Cache-Control')).toContain('immutable');
    expect((await handler.fetch(new Request('https://niva.example/api/config'), e)).status).toBe(
      503,
    );
  });
  it('serves XML/robots, strict headers, HEAD and direct nested routes', async () => {
    const e = env();
    const html = await handler.fetch(new Request('https://niva.example/privacy'), e);
    expect(html.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    expect(html.headers.get('Permissions-Policy')).toContain('geolocation=()');
    expect(await html.text()).toContain('rel="canonical"');
    expect(
      (await handler.fetch(new Request('https://niva.example/sitemap.xml'), e)).headers.get(
        'Content-Type',
      ),
    ).toContain('application/xml');
    expect(
      await (await handler.fetch(new Request('https://niva.example/robots.txt'), e)).text(),
    ).toContain('Disallow: /account');
    expect(
      await (
        await handler.fetch(new Request('https://niva.example/app/jobs', { method: 'HEAD' }), e)
      ).text(),
    ).toBe('');
    expect((await handler.fetch(new Request('https://niva.example/missing.js'), e)).status).toBe(
      404,
    );
  });
  it('never caches API identity responses and applies framing/security headers', async () => {
    const r = await handler.fetch(new Request('https://niva.example/api/session'), env());
    expect(await r.json()).toEqual({ user: null });
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(r.headers.get('X-Frame-Options')).toBe('DENY');
    expect(r.headers.get('X-Robots-Tag')).toContain('noindex');
  });
});
