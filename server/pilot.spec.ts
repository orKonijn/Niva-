import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { createPilot, pilotFeed, platformUser } from './pilot';
import { classify, normalizeFeed } from './job-feed';
const secret = 'pilot-test-secret-at-least-32-characters';
const raw = {
  jobs: [
    {
      id: 123,
      title: 'Senior Data Engineer',
      location: { name: 'Herzliya' },
      absolute_url: 'https://careers.appsflyer.com/jobs/position/123',
      updated_at: '2026-10-20T00:00:00Z',
      content: '&lt;p&gt;Build &amp; test&lt;/p&gt;',
    },
  ],
};
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle').filter((f) => f.endsWith('.sql')))
    sqlite.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...v: unknown[]) {
          values = v;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...(values as never[])) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...(values as never[])) };
        },
        async run() {
          return { success: true, meta: sqlite.prepare(sql).run(...(values as never[])) };
        },
      };
      return statement;
    },
    async batch(statements: { run: () => Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
  const { app } = createPilot({ DB: db, NIVA_IMPORT_SECRET: secret });
  const request = (path: string, owner = 'alice', body?: unknown) =>
    app.request(`https://pilot.test/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(owner
          ? {
              'oai-authenticated-user-id': owner,
              'oai-authenticated-user-email': `${owner}@example.test`,
            }
          : {}),
        ...(body === undefined
          ? {}
          : {
              Origin: 'https://pilot.test',
              'Content-Type': 'application/json',
              'X-Niva-CSRF': '1',
            }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { db, sqlite, request, app };
}
afterEach(() => vi.unstubAllGlobals());
describe('hosted pilot adapter (verified identity boundary is mocked locally)', () => {
  it('isolates career documents through the D1 adapter and includes them in account-data deletion', async () => {
    const { request, sqlite } = setup();
    const response = await request('career/resumes', 'alice', {
      name: 'CV',
      text: 'Candidate with Python and SQL experience',
    });
    expect(response.status).toBe(201);
    const resume = (await response.json()) as { id: string; text: string };
    expect(await (await request('career/resumes', 'bob')).json()).toEqual([]);
    expect((await request(`career/resumes/${resume.id}/export`, 'bob')).status).toBe(404);
    await request(`career/resumes/${resume.id}/review`, 'alice', {
      text: resume.text,
      confirmed: true,
    });
    await request(`career/resumes/${resume.id}/activate`, 'alice', { confirmed: true });
    expect((await (await request('career/resumes', 'alice')).json())[0].active).toBe(true);
    expect(
      (await request('account/state', 'alice', { revision: 0, operation: { type: 'delete-data' } }))
        .status,
    ).toBe(200);
    expect(sqlite.prepare('SELECT * FROM niva_documents WHERE owner=?').all('sites:alice')).toEqual(
      [],
    );
    expect((await request(`career/resumes/${resume.id}/export`, 'alice')).status).toBe(404);
  });
  it('normalizes only real Israeli employer posts, preserves uncertainty, rejects malicious URLs', () => {
    const jobs = normalizeFeed(raw);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.description).toBe('Build & test');
    expect(jobs[0]?.workStyle).toBe('unknown');
    expect(jobs[0]?.offices[0]?.demonstration).toBe(false);
    expect(jobs[0]?.offices[0]?.precision).toBe('city');
    expect(
      normalizeFeed({ jobs: [{ ...raw.jobs[0], absolute_url: 'javascript:alert(1)' }] }),
    ).toEqual([]);
    expect(normalizeFeed({ jobs: [{ ...raw.jobs[0], location: { name: 'Tokyo' } }] })).toEqual([]);
    expect(classify('QA Automation Engineer')).toBe('qa-automation');
    expect(classify('Workflow Automation Specialist')).toBe('workflow-automation');
  });
  it('isolates owners, rejects unauthenticated calls and caller-selected IDs, and detects races', async () => {
    const { request, app } = setup();
    expect((await request('account/state', '')).status).toBe(401);
    expect(
      (
        await request('account/state', 'alice', {
          revision: 0,
          operation: { type: 'profile', value: { name: 'Alice', headline: 'QA' } },
        })
      ).status,
    ).toBe(200);
    expect((await (await request('account/state', 'bob')).json()).profile.name).toBe('');
    expect(
      (
        await request('account/state', 'alice', {
          revision: 1,
          userId: 'bob',
          operation: { type: 'pause', value: true },
        })
      ).status,
    ).toBe(400);
    const race = await Promise.all(
      [true, false].map((value) =>
        request('account/state', 'alice', { revision: 1, operation: { type: 'pause', value } }),
      ),
    );
    expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await (await request('account/state', 'alice')).json()).profile.name).toBe('Alice');
  });
  it('persists real saved jobs and retains removed listings without fabricating approvals', async () => {
    const { db, request } = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(raw)),
    );
    const feed = await pilotFeed(db);
    const id = feed.jobs[0]!.id;
    expect(
      (
        await request('account/state', 'alice', {
          revision: 0,
          operation: { type: 'saved', jobId: id, value: true },
        })
      ).status,
    ).toBe(200);
    expect((await (await request('account/state', 'alice')).json()).saved).toEqual([id]);
    expect((await (await request('account/state', 'bob')).json()).saved).toEqual([]);
    expect(
      (
        await request('account/state', 'alice', {
          revision: 1,
          operation: { type: 'approve', jobId: id },
        })
      ).status,
    ).toBe(400);
    await db.prepare('UPDATE niva_pilot_jobs SET active=0').run();
    expect((await (await request('jobs', 'alice')).json()).archived[0].source.active).toBe(false);
    expect((await (await request('jobs', 'bob')).json()).archived).toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await db.prepare('UPDATE niva_pilot_feed SET fetched_at=?').bind('2000-01-01').run();
    expect((await pilotFeed(db)).stale).toBe(true);
  });
  it('binds imports to owner/revision and preserves the one-time marker after clearing', async () => {
    const { request } = setup();
    const payload = {
      saved: ['frontend-engineer', 'frontend-engineer'],
      applications: [{ jobId: 'frontend-engineer', approvedAt: '2026-10-01' }],
    };
    const preview = await (await request('account/import-preview', 'alice', payload)).json();
    expect(preview.counts.saved).toBe(1);
    expect(
      (
        await request('account/state', 'bob', {
          revision: 0,
          operation: { type: 'import', data: preview.data, receipt: preview.receipt },
        })
      ).status,
    ).toBe(400);
    const imported = await (
      await request('account/state', 'alice', {
        revision: 0,
        operation: { type: 'import', data: preview.data, receipt: preview.receipt },
      })
    ).json();
    expect(imported.applications[0].kind).toBe('local-demo');
    await request('account/state', 'alice', { revision: 1, operation: { type: 'delete-data' } });
    expect((await request('account/import-preview', 'alice', payload)).status).toBe(409);
  });
  it('rejects missing CSRF, malformed requests and expired identity without leaking state', async () => {
    const { request, app } = setup();
    const csrf = await app.request('https://pilot.test/api/account/state', {
      method: 'POST',
      headers: {
        'oai-authenticated-user-id': 'alice',
        'Content-Type': 'application/json',
        Origin: 'https://pilot.test',
      },
      body: JSON.stringify({ revision: 0, operation: { type: 'pause', value: true } }),
    });
    expect(csrf.status).toBe(403);
    const result = await request('account/state', 'alice', {
      revision: -1,
      operation: { type: 'pause', value: true },
    });
    expect(result.status).toBe(400);
    expect(
      platformUser(
        new Request('https://pilot.test', {
          headers: {
            'oai-authenticated-user-id': 'a',
            'oai-authenticated-user-full-name': '%D7%A0%D7%95%D7%A2%D7%94',
            'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8',
          },
        }),
      )?.name,
    ).toBe('נועה');
    expect((await request('account/state', '')).status).toBe(401);
  });
});
