import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { hostedAuth } from './hosted-auth';
import { createPilot, type PilotEnv } from './pilot';
const databases: DatabaseSync[] = [];
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
  const DB = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          values = args;
          return statement;
        },
        async all() {
          const query = sqlite.prepare(sql);
          const args = values.map((v) => (v instanceof Date ? v.getTime() : v)) as never[];
          if (query.columns().length)
            return { results: query.all(...args), meta: { changes: 0, last_row_id: 0 } };
          const info = query.run(...args);
          return {
            results: [],
            meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
          };
        },
        async first() {
          return (await statement.all()).results[0] ?? null;
        },
        async run() {
          return statement.all();
        },
      };
      return statement;
    },
    async batch(statements: { all(): Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try {
        const rows = [];
        for (const statement of statements) rows.push(await statement.all());
        sqlite.exec('COMMIT');
        return rows;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    },
  } as unknown as D1Database;
  const env: PilotEnv = {
    DB,
    NIVA_IMPORT_SECRET: 'synthetic-import-secret-at-least-32-characters',
    NIVA_PUBLIC_ORIGIN: 'https://niva.example',
    NIVA_AUTH_SECRET: 'synthetic-auth-secret-at-least-32-characters',
    GOOGLE_CLIENT_ID: 'synthetic-client.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'synthetic-only-not-real',
  };
  return { sqlite, env, app: createPilot(env).app };
}
afterEach(() => {
  for (const d of databases.splice(0)) d.close();
});
describe('hosted OAuth using the actual Better Auth D1 adapter', () => {
  it('creates a PKCE/state-protected Google authorization request with the exact production callback', async () => {
    const { app, sqlite } = fixture();
    const r = await app.request('https://niva.example/api/auth/sign-in/social', {
      method: 'POST',
      headers: { origin: 'https://niva.example', 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: 'https://niva.example/app',
        errorCallbackURL: 'https://niva.example/login?oauth=error',
      }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    const url = new URL(body.url);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://niva.example/api/auth/callback/google',
    );
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(
      [...url.searchParams.get('scope')!.split(' ')].every((s) =>
        ['openid', 'email', 'profile'].includes(s),
      ),
    ).toBe(true);
    expect(sqlite.prepare('SELECT count(*) AS n FROM verification').get()?.['n']).toBe(1);
    expect(r.headers.get('set-cookie')).toContain('Secure');
    expect(r.headers.get('set-cookie')).toContain('HttpOnly');
  });
  it('rejects cross-origin sign-in and arbitrary account-linking routes', async () => {
    const { app } = fixture();
    expect(
      (
        await app.request('https://niva.example/api/auth/sign-in/social', {
          method: 'POST',
          headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
          body: JSON.stringify({ provider: 'google', callbackURL: 'https://niva.example/app' }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request('https://niva.example/api/auth/link-social', {
          method: 'POST',
          headers: { origin: 'https://niva.example' },
        })
      ).status,
    ).toBe(404);
    expect((await app.request('https://niva.example/api/account/state')).status).toBe(401);
  });
  it('isolates a signed OAuth session from ChatGPT records with the same email and rejects a tampered cookie', async () => {
    const { sqlite, env, app } = fixture();
    const now = Date.now();
    sqlite
      .prepare(
        'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',
      )
      .run('synthetic-google-user', 'Synthetic', 'synthetic@example.invalid', 1, now, now);
    sqlite
      .prepare('UPDATE user SET image=? WHERE id=?')
      .run('https://lh3.googleusercontent.com/synthetic-profile', 'synthetic-google-user');
    sqlite
      .prepare(
        'INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES(?,?,?,?,?,?)',
      )
      .run(
        'synthetic-session',
        now + 3600000,
        'synthetic-session-token',
        now,
        now,
        'synthetic-google-user',
      );
    const state = {
      revision: 7,
      profile: { name: 'Sites-only record' },
      saved: ['sites-only-job'],
    };
    sqlite
      .prepare('INSERT INTO niva_pilot_states VALUES(?,?,?,?,?)')
      .run('sites:synthetic-google-user', 7, JSON.stringify(state), null, new Date().toISOString());
    const cookieName = (await hostedAuth(env)!.$context).authCookies.sessionToken.name;
    const value = encodeURIComponent(
      'synthetic-session-token.' +
        createHmac('sha256', env.NIVA_AUTH_SECRET!)
          .update('synthetic-session-token')
          .digest('base64'),
    );
    const headers = { cookie: cookieName + '=' + value };
    const response = await app.request('https://niva.example/api/session', { headers });
    expect((await response.json()).user).toMatchObject({
      id: 'oauth:synthetic-google-user',
      authMethod: 'social',
      emailVerified: true,
      name: 'Synthetic',
      image: 'https://lh3.googleusercontent.com/synthetic-profile',
    });
    const own = await app.request('https://niva.example/api/account/state', { headers });
    expect(own.status).toBe(200);
    expect((await own.json()).saved).toEqual([]);
    const bad = await app.request('https://niva.example/api/session', {
      headers: { cookie: cookieName + '=' + value + 'tampered' },
    });
    expect((await bad.json()).user).toBeNull();
  });
});
