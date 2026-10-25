import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { workerRuntimeOptions } from './worker-build-options.mjs';

test('the actual Worker build selects native request context and isolates concurrent sessions', async () => {
  const result = await build({
    entryPoints: ['server/hosted-auth.ts'],
    bundle: true,
    format: 'esm',
    ...workerRuntimeOptions,
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  assert(inputs.some((path) => path.endsWith('@better-auth/core/dist/async_hooks/index.mjs')));
  assert(
    !inputs.some((path) => path.endsWith('@better-auth/core/dist/async_hooks/pure.index.mjs')),
  );
  const { hostedAuth } = await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
  const sqlite = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync('drizzle')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
    const DB = {
      prepare(sql) {
        let values = [];
        const statement = {
          bind(...args) {
            values = args;
            return statement;
          },
          async all() {
            // Force overlapping adapter reads; sequential Node-only tests missed the browser fallback.
            await new Promise((resolve) => setTimeout(resolve, 1));
            const query = sqlite.prepare(sql),
              args = values.map((v) => (v instanceof Date ? v.getTime() : v));
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
      async batch(statements) {
        return Promise.all(statements.map((s) => s.all()));
      },
      async exec(sql) {
        sqlite.exec(sql);
      },
    };
    const secret = 'synthetic-worker-regression-secret-at-least-32-characters';
    const auth = hostedAuth({
      DB,
      NIVA_PUBLIC_ORIGIN: 'https://niva.example',
      NIVA_AUTH_SECRET: secret,
      GOOGLE_CLIENT_ID: 'synthetic.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'synthetic-not-real',
    });
    const cookieName = (await auth.$context).authCookies.sessionToken.name,
      now = Date.now();
    for (const id of ['alice', 'bob']) {
      sqlite
        .prepare(
          'INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,?,?,?)',
        )
        .run(id, id, id + '@example.invalid', 1, now, now);
      sqlite
        .prepare(
          'INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES(?,?,?,?,?,?)',
        )
        .run(id, now + 3600000, id + '-token', now, now, id);
    }
    await Promise.all(
      Array.from({ length: 40 }, async (_, i) => {
        const id = i % 2 ? 'alice' : 'bob',
          token = id + '-token';
        const cookie = encodeURIComponent(
          token + '.' + createHmac('sha256', secret).update(token).digest('base64'),
        );
        const session = await auth.api.getSession({
          headers: new Headers({ cookie: cookieName + '=' + cookie }),
        });
        assert.equal(session?.user.id, id);
      }),
    );
  } finally {
    sqlite.close();
  }
});
