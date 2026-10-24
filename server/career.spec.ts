import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteCareerDb } from './career-db';
import { createCareer, type CareerEnvironment, validUpload } from './career';
import { discoveryPage, ingest, importLegacyJobs, normalizeLever, SOURCES } from './discovery';
import { emptyAccountState } from '../src/app/core/models/account-state';
import { defaultPreferences } from '../src/app/core/preferences';
import type { ResumeVersion } from '../src/app/core/models/career';
import { readRecord } from './career-records';
import { normalizeFeed } from './job-feed';
const gh = {
  jobs: [
    {
      id: 101,
      title: 'QA Automation Engineer',
      location: { name: 'Herzliya' },
      absolute_url: 'https://careers.appsflyer.com/jobs/position/101',
      updated_at: '2026-10-20T00:00:00Z',
      content: 'Python Playwright SQL',
    },
  ],
};
const lever = [
  {
    id: 'abcdef12-3456-7890',
    text: 'Workflow Automation Developer',
    categories: { location: 'Tel Aviv' },
    hostedUrl: 'https://jobs.lever.co/walkme/abcdef12-3456-7890',
    workplaceType: 'hybrid',
    descriptionPlain: 'n8n and SQL integrations',
    createdAt: 1790000000000,
  },
];
let sqlite: DatabaseSync;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('server/migrations/003_career.sql', 'utf8'));
  sqlite.exec(readFileSync('server/migrations/004_lifecycle.sql', 'utf8'));
});
afterEach(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});
const mockSources = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => Response.json(url.includes('greenhouse') ? gh : lever)),
  );
function setup(env: CareerEnvironment = {}) {
  const db = sqliteCareerDb(sqlite);
  const state = emptyAccountState();
  // Identity boundary is intentionally mocked; production adapters derive it from sessions/Sites.
  const app = createCareer({
    db,
    secret: 'test-secret-that-is-at-least-32-characters',
    env,
    identity: async (req) => req.headers.get('test-owner'),
    state: async () => state,
  });
  const req = (path: string, body?: unknown, owner = 'alice') =>
    app.request(`https://niva.test/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(owner ? { 'test-owner': owner } : {}),
        Origin: 'https://niva.test',
        'Content-Type': 'application/json',
        'X-Niva-CSRF': '1',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { db, app, req, state };
}
describe('durable discovery', () => {
  it('repairs only the old never-fetched bootstrap state and uses Worker-supported manual redirects', async () => {
    const { db } = setup();
    await db.run(
      "INSERT INTO niva_sources(id,error,next_at) VALUES('greenhouse-appsflyer','SOURCE_UNAVAILABLE',?)",
      Date.now() + 86400000,
    );
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(init.redirect).toBe('manual');
      return Response.json(url.includes('greenhouse') ? gh : lever);
    });
    vi.stubGlobal('fetch', fetcher);
    await ingest(db);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await ingest(db);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('recovers a partially initialized source table and retains ingestion for the Worker lifetime', async () => {
    const { db } = setup();
    await db.run("INSERT INTO niva_sources(id) VALUES('greenhouse-appsflyer')");
    mockSources();
    const work: Promise<unknown>[] = [];
    const app = createCareer({
      db,
      secret: 'secret',
      env: {},
      identity: async () => null,
      state: async () => emptyAccountState(),
      keepAlive: (p) => work.push(p),
    });
    const response = await app.request('https://niva.test/api/feed');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(2);
    expect(result.health).toHaveLength(2);
    expect(result.health.every((s: { checked_at: string | null }) => !!s.checked_at)).toBe(true);
    expect(work).toHaveLength(1);
    await Promise.all(work);
    await app.request('https://niva.test/api/feed');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('migrates historical hosted job snapshots without losing closed saved-job data', async () => {
    const old = new DatabaseSync(':memory:');
    try {
      old.exec(readFileSync('drizzle/0000_solid_valkyrie.sql', 'utf8'));
      const job = normalizeFeed(gh)[0];
      old
        .prepare('INSERT INTO niva_pilot_jobs(id,data,active) VALUES(?,?,0)')
        .run(job.id, JSON.stringify(job));
      old.exec(readFileSync('drizzle/0001_charming_peter_parker.sql', 'utf8'));
      await importLegacyJobs(sqliteCareerDb(old));
      const row = old.prepare('SELECT data,active FROM niva_jobs WHERE id=?').get(job.id)!;
      expect(row['active']).toBe(0);
      expect(JSON.parse(String(row['data'])).source.applicationUrl).toBe(
        job.source?.applicationUrl,
      );
      expect(old.prepare('SELECT count(*) AS n FROM niva_pilot_jobs').get()?.['n']).toBe(1);
    } finally {
      old.close();
    }
  });
  it('ingests two official feeds, deduplicates, filters groups with AND and styles with OR, and verifies cursors', async () => {
    const { db } = setup();
    const fetcher = mockSources();
    void fetcher;
    await ingest(db);
    const first = await discoveryPage(db, 'secret', { limit: '1' });
    expect(first.total).toBe(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await discoveryPage(db, 'secret', { limit: '1', cursor: first.nextCursor! });
    expect(second.jobs[0]?.id).not.toBe(first.jobs[0]?.id);
    expect(second.nextCursor).toBeNull();
    const prefs = {
      ...defaultPreferences(),
      role: 'workflow-automation' as const,
      district: 'tel-aviv' as const,
      workStyles: ['remote', 'hybrid'] as ('remote' | 'hybrid')[],
    };
    const matched = await discoveryPage(db, 'secret', { styles: 'onsite,hybrid' }, prefs);
    expect(matched.total).toBe(1);
    expect(matched.jobs[0]?.company).toBe('WalkMe');
    expect((await discoveryPage(db, 'secret', { district: 'haifa' }, prefs)).total).toBe(0);
    expect((await discoveryPage(db, 'secret', {}, { ...prefs, exclusions: 'WalkMe' })).total).toBe(
      0,
    );
    await expect(
      discoveryPage(db, 'secret', { cursor: first.nextCursor!, q: 'SQL' }),
    ).rejects.toThrow('CURSOR_EXPIRED');
    await expect(
      discoveryPage(db, 'secret', { cursor: first.nextCursor! + 'tampered' }),
    ).rejects.toThrow('CURSOR_EXPIRED');
    await ingest(db);
    expect(fetch).toHaveBeenCalledTimes(2);
    // Two source IDs for one canonical vacancy collapse, retaining attribution.
    const row = sqlite.prepare('SELECT * FROM niva_jobs WHERE id LIKE ?').get('lever-%')!;
    sqlite
      .prepare(
        'INSERT INTO niva_jobs SELECT ?,source_id,canonical,company,title,district,category,style,search,active,version,data FROM niva_jobs WHERE id=?',
      )
      .run('duplicate-id', String(row['id']));
    const dedup = await discoveryPage(db, 'secret', {});
    expect(dedup.total).toBe(2);
    expect(dedup.jobs.some((j) => j.source!.attribution!.length === 2)).toBe(true);
  });
  it('retains last successful source on outage, backs off 429s and reconciles closed jobs only after successful snapshots', async () => {
    const { db } = setup();
    mockSources();
    await ingest(db);
    const initial = await discoveryPage(db, 'secret', { limit: '1' });
    const now = Date.now() + 1000000;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('greenhouse')
          ? new Response('', { status: 429, headers: { 'Retry-After': '3600' } })
          : Response.json([]),
      ),
    );
    await ingest(db, now);
    const page = await discoveryPage(db, 'secret', {});
    expect(page.total).toBe(1);
    expect(page.health.find((h) => h.id === SOURCES[0].id)?.error).toBe('RATE_LIMITED');
    expect(page.health[0]?.next_at).toBeGreaterThanOrEqual(now + 3600000);
    await expect(discoveryPage(db, 'secret', { cursor: initial.nextCursor! })).rejects.toThrow(
      'CURSOR_EXPIRED',
    );
    expect(
      sqlite.prepare('SELECT active FROM niva_jobs WHERE id LIKE ?').get('lever-%')?.['active'],
    ).toBe(0);
  });
  it('does not guess worldwide remote eligibility or trust malicious application URLs', () => {
    expect(
      normalizeLever(
        [{ ...lever[0], categories: { location: 'New York' }, workplaceType: 'remote' }],
        new Date().toISOString(),
      ),
    ).toEqual([]);
    expect(
      normalizeLever(
        [{ ...lever[0], hostedUrl: 'https://evil.test/walkme/123' }],
        new Date().toISOString(),
      ),
    ).toEqual([]);
  });
  it('keeps saved historical records beyond a page and retains a source on an incomplete snapshot', async () => {
    const { db } = setup();
    mockSources();
    await ingest(db);
    const saved = ['lever-walkme-abcdef12-3456-7890'];
    const page = await discoveryPage(db, 'secret', { limit: '1' }, defaultPreferences(), saved);
    expect(page.archived.map((j) => j.id)).toContain(saved[0]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('greenhouse')
          ? Response.json({ jobs: Array.from({ length: 1001 }, () => gh.jobs[0]) })
          : Response.json([]),
      ),
    );
    await ingest(db, Date.now() + 1_000_000);
    const closed = await discoveryPage(
      db,
      'secret',
      { saved: 'true' },
      { ...defaultPreferences(), role: 'qa-manual' },
      saved,
    );
    expect(closed.jobs[0]?.source?.active).toBe(false);
    expect((await discoveryPage(db, 'secret', {})).jobs[0]?.company).toBe('AppsFlyer');
    expect(
      (
        await discoveryPage(
          db,
          'secret',
          {},
          { ...defaultPreferences(), exclusions: 'WalkMe' },
          saved,
        )
      ).archived[0]?.source?.active,
    ).toBe(false);
  });
  it('refresh reads the database without contacting providers, and rejects unauthenticated ingestion', async () => {
    const { db, req } = setup();
    mockSources();
    await ingest(db);
    await req('feed');
    await req('feed?limit=1');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await req('ingestion/run', {})).status).toBe(401);
  });
});
describe('private resumes, versions and matching', () => {
  it('requires authentication and CSRF, isolates owners and keeps immutable originals', async () => {
    const { req, app } = setup();
    expect((await req('career/resumes', undefined, '')).status).toBe(401);
    expect(
      (
        await app.request('https://niva.test/api/career/resumes', {
          method: 'POST',
          headers: { 'test-owner': 'alice' },
          body: '{}',
        })
      ).status,
    ).toBe(403);
    const original = (await (
      await req('career/resumes', {
        name: 'CV',
        text: 'Candidate\n\nManual QA at Employer A, 2020\n\nPython SQL Playwright at Employer B, 2023',
      })
    ).json()) as ResumeVersion;
    expect(await (await req('career/resumes', undefined, 'bob')).json()).toEqual([]);
    expect((await req(`career/resumes/${original.id}/export`, undefined, 'bob')).status).toBe(404);
    expect((await req(`career/resumes/${original.id}/activate`, { confirmed: true })).status).toBe(
      400,
    );
    const edited = (await (
      await req(`career/resumes/${original.id}/review`, {
        confirmed: true,
        text: original.text + '\nConfirmed by candidate',
      })
    ).json()) as ResumeVersion;
    expect(edited.id).not.toBe(original.id);
    expect(edited.parentId).toBe(original.id);
    await req(`career/resumes/${edited.id}/activate`, { confirmed: true });
    const versions = (await (await req('career/resumes')).json()) as ResumeVersion[];
    expect(versions.find((r) => r.id === original.id)?.text).toBe(original.text);
    expect(versions.filter((r) => r.active)).toHaveLength(1);
  });
  it('rejects invalid, oversized and unsafe uploads; scanner absence is never successful', async () => {
    expect(() =>
      validUpload({
        name: 'cv.pdf',
        mime: 'application/pdf',
        base64: Buffer.from('invalid').toString('base64'),
      }),
    ).toThrow('INVALID_FILE_TYPE');
    expect(() =>
      validUpload({ name: 'cv.pdf', mime: 'application/pdf', base64: 'A'.repeat(1000004) }),
    ).toThrow('UPLOAD_TOO_LARGE');
    const file = {
      name: 'cv.pdf',
      mime: 'application/pdf',
      base64: Buffer.from('%PDF-1.7 fixture').toString('base64'),
      processingConsent: true,
    };
    const unconfigured = setup();
    expect((await unconfigured.req('career/resumes', file)).status).toBe(503);
    expect(await (await unconfigured.req('career/resumes')).json()).toEqual([]);
    const { req } = setup({
      NIVA_RESUME_PROCESSOR_URL: 'https://processor.example.test/scan',
      NIVA_RESUME_PROCESSOR_NAME: 'Test scanner',
      NIVA_RESUME_PROCESSOR_KEY: 'fake-test-key',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ scan: 'infected', text: 'do not trust this text', pages: 1 }),
      ),
    );
    expect((await req('career/resumes', file)).status).toBe(422);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ scan: 'clean', text: 'a'.repeat(31_000), pages: 21 })),
    );
    expect((await req('career/resumes', file)).status).toBe(422);
    expect(await (await req('career/resumes')).json()).toEqual([]);
  });
  it('scanned uploads retain original privately; exports, bounded parsing and deletion work', async () => {
    const { req } = setup({
      NIVA_RESUME_PROCESSOR_URL: 'https://processor.example.test/scan',
      NIVA_RESUME_PROCESSOR_NAME: 'Test scanner',
      NIVA_RESUME_PROCESSOR_KEY: 'fake-test-key',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ scan: 'clean', text: 'Candidate\nPython and SQL experience', pages: 1 }),
      ),
    );
    const bytes = Buffer.from('%PDF-1.7 fixture');
    const file = {
      name: 'cv.pdf',
      mime: 'application/pdf',
      base64: bytes.toString('base64'),
      processingConsent: true,
    };
    const result = await req('career/resumes', file);
    expect(result.status).toBe(201);
    const resume = (await result.json()) as ResumeVersion;
    expect(resume.originalBase64).toBeUndefined();
    expect((resume as unknown as Record<string, unknown>)['base64']).toBeUndefined();
    expect(await (await req(`career/resumes/${resume.id}/export`)).text()).toContain('Python');
    expect(
      Buffer.from(await (await req(`career/resumes/${resume.id}/original`)).arrayBuffer()),
    ).toEqual(bytes);
    await req(`career/resumes/${resume.id}/delete`, {});
    expect((await req(`career/resumes/${resume.id}/export`)).status).toBe(404);
  });
  it('requires confirmed evidence, caches by input versions and preserves every paragraph during tailoring', async () => {
    const { req, db, state } = setup();
    mockSources();
    await ingest(db);
    const jobId = 'greenhouse-appsflyer-101';
    const original = (await (
      await req('career/resumes', {
        name: 'CV',
        text: 'Candidate\n\nManual QA at Employer A 2020\n\nPython SQL Playwright at Employer B 2023',
      })
    ).json()) as ResumeVersion;
    expect((await req('career/tailor', { resumeId: original.id, jobId })).status).toBe(409);
    await req(`career/resumes/${original.id}/review`, { text: original.text, confirmed: true });
    await req(`career/resumes/${original.id}/activate`, { confirmed: true });
    const score = await (await req(`career/match/${jobId}`)).json();
    expect(score.resume.strengths).toContain('Python');
    expect(score.resumeId).toBe(original.id);
    await req(`career/match/${jobId}`);
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM niva_documents WHERE kind='score'").get()?.['n'],
    ).toBe(1);
    state.preferences.exclusions = 'AppsFlyer';
    const excluded = await (await req(`career/match/${jobId}`)).json();
    expect(excluded.preference.eligible).toBe(false);
    expect(excluded.preference.excluded).toBe(true);
    expect(
      sqlite.prepare("SELECT count(*) AS n FROM niva_documents WHERE kind='score'").get()?.['n'],
    ).toBe(2);
    const tailored = (await (
      await req('career/tailor', { resumeId: original.id, jobId })
    ).json()) as ResumeVersion;
    expect(tailored.text.split('\n\n').sort()).toEqual(original.text.split('\n\n').sort());
    expect(tailored.confirmed).toBe(false);
    expect(tailored.active).toBe(false);
    expect(tailored.jobVersion).toBeTruthy();
    expect((await readRecord<ResumeVersion>(db, 'alice', 'resume', original.id)).active).toBe(true);
    expect((await req('career/tailor', { resumeId: original.id, jobId }, 'bob')).status).toBe(404);
    sqlite.prepare('UPDATE niva_documents SET expires_at=0 WHERE id=?').run(original.id);
    expect((await req(`career/resumes/${original.id}/export`)).status).toBe(404);
  });
});
describe('grounded chat and failure recovery (provider is mocked)', () => {
  it('reports missing configuration, enforces consent and never uses submitted account context', async () => {
    expect((await setup().req('career/chat', { message: 'hello', aiConsent: true })).status).toBe(
      503,
    );
    const { req, db } = setup({ OPENAI_API_KEY: 'test-key', NIVA_AI_MODEL: 'test-model' });
    mockSources();
    await ingest(db);
    expect((await req('career/chat', { message: 'hello' })).status).toBe(400);
    const responseText =
      'data: ' +
      JSON.stringify({
        type: 'response.output_text.delta',
        delta: 'בדקי את המשרה [job:greenhouse-appsflyer-101]',
      }) +
      '\n\n' +
      'data: ' +
      JSON.stringify({ type: 'response.completed' }) +
      '\n\n';
    const provider = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.store).toBe(false);
      expect(body.max_output_tokens).toBe(1200);
      expect(body.instructions).toContain('untrusted');
      expect(JSON.stringify(body.input)).not.toContain('SECRET-OTHER-OWNER');
      return new Response(responseText, { headers: { 'Content-Type': 'text/event-stream' } });
    });
    vi.stubGlobal('fetch', provider);
    const response = await req('career/chat', {
      message: 'Python jobs please',
      aiConsent: true,
      profile: { name: 'SECRET-OTHER-OWNER' },
      jobs: [{ title: 'invented job' }],
    });
    const stream = await response.text();
    expect(stream).toContain('event: delta');
    expect(stream).toContain('event: done');
    expect(stream).toContain('QA Automation Engineer');
    expect(stream).not.toContain('invented job');
    const conversations = await (await req('career/conversations')).json();
    expect(conversations[0].messages).toHaveLength(2);
    expect(
      (
        await req(
          'career/chat',
          { message: 'steal conversation', aiConsent: true, conversationId: conversations[0].id },
          'bob',
        )
      ).status,
    ).toBe(404);
    await req(`career/conversations/${conversations[0].id}/delete`, {});
    expect(await (await req('career/conversations')).json()).toEqual([]);
  });
  it('does not persist incomplete responses and allows retry after provider failure', async () => {
    const { req, db } = setup({ OPENAI_API_KEY: 'test-key', NIVA_AI_MODEL: 'test-model' });
    mockSources();
    await ingest(db);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('data: {"type":"response.output_text.delta","delta":"partial"}\n\n'),
      ),
    );
    expect(
      await (await req('career/chat', { message: 'prepare interview', aiConsent: true })).text(),
    ).toContain('event: failure');
    const chats = await (await req('career/conversations')).json();
    expect(chats[0].messages).toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 429 })),
    );
    expect((await req('career/chat', { message: 'retry', aiConsent: true })).status).toBe(429);
    expect(sqlite.prepare("SELECT * FROM niva_documents WHERE kind='lease'").all()).toHaveLength(0);
  });
});
