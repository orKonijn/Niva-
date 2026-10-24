import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { createPilot } from './pilot';
import { createCareer, type CareerEnvironment } from './career';
import { sqliteCareerDb, d1CareerDb, type CareerDb } from './career-db';
import { stateRepository } from './state';
export function barrier() {
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((r) => (started = r));
  const wait = new Promise<void>((r) => (release = r));
  return {
    entered,
    release,
    async pause() {
      started();
      await wait;
    },
  };
}
/** SQLite-backed D1 contract double. Not a Cloudflare runtime/identity verification. */
export function repairHarness(adapter: 'node' | 'd1', env: CareerEnvironment = {}) {
  const sqlite = new DatabaseSync(':memory:');
  if (adapter === 'd1')
    for (const file of readdirSync('drizzle')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
  else
    for (const file of [
      '000_auth.sql',
      '001_account_data.sql',
      '003_career.sql',
      '004_lifecycle.sql',
    ])
      sqlite.exec(readFileSync('server/migrations/' + file, 'utf8'));
  let before: (sql: string) => Promise<void> = async () => {};
  let batchBefore: () => Promise<void> = async () => {};
  const d1 = {
    prepare(sql: string) {
      let values: (string | number | null)[] = [];
      const s = {
        bind(...args: (string | number | null)[]) {
          values = args;
          return s;
        },
        async all() {
          await before(sql);
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async first() {
          await before(sql);
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async run() {
          await before(sql);
          const q = sqlite.prepare(sql);
          return {
            success: true,
            results: q.columns().length ? q.all(...values) : [],
            meta: q.columns().length ? {} : q.run(...values),
          };
        },
      };
      return s;
    },
    async batch(rows: { run: () => Promise<unknown> }[]) {
      await batchBefore();
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const r of rows) results.push(await r.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
  const base = sqliteCareerDb(sqlite);
  const db: CareerDb =
    adapter === 'd1'
      ? d1CareerDb(d1)
      : {
          ...base,
          async all<T>(sql: string, ...args: (string | number | null)[]) {
            await before(sql);
            return base.all<T>(sql, ...args);
          },
        };
  if (adapter === 'node')
    sqlite
      .prepare(
        'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',
      )
      .run('alice', 'Synthetic', 'alice@example.test', 1, Date.now(), Date.now());
  const repository = adapter === 'node' ? stateRepository(sqlite, 'synthetic-secret') : null;
  const pilot =
    adapter === 'd1'
      ? createPilot({
          DB: d1,
          NIVA_IMPORT_SECRET: 'synthetic-secret-at-least-thirty-two-characters',
          ...env,
        })
      : null;
  const app =
    pilot?.app ??
    createCareer({
      db,
      secret: 'synthetic-secret',
      env,
      identity: async () => 'alice',
      state: async () => repository!.read('alice'),
    });
  const owner = adapter === 'd1' ? 'sites:alice' : 'alice';
  const req = async (path: string, body?: unknown) =>
    app.request('https://repair.test/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'oai-authenticated-user-id': 'alice',
        Origin: 'https://repair.test',
        'Content-Type': 'application/json',
        'X-Niva-CSRF': '1',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const remove = async (revision = 0) => {
    if (repository) {
      repository.mutate(owner, { revision, operation: { type: 'delete-data' } });
      return 200;
    }
    return (await req('account/state', { revision, operation: { type: 'delete-data' } })).status;
  };
  return {
    sqlite,
    db,
    owner,
    req,
    remove,
    repository,
    hook(fn: typeof before) {
      before = fn;
    },
    batchHook(fn: typeof batchBefore) {
      batchBefore = fn;
    },
  };
}
