import { canonicalJobUrl } from '../src/app/core/job-identity';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { CareerDb } from './career-db';
import { plainText, classify } from './job-feed';
import { SOURCES } from './job-sources';
import { normalizeGreenhouse } from './greenhouse-source';
export { SOURCES } from './job-sources';
import type { Job } from '../src/app/core/models/job';
import {
  defaultPreferences,
  migratePreferences,
  type Preferences,
} from '../src/app/core/preferences';

export const versionOf = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
export function normalizeLever(payload: unknown, fetchedAt: string): Job[] {
  if (!Array.isArray(payload) || payload.length >= 100) throw new Error('INCOMPLETE_SOURCE');
  return payload.flatMap((row: Record<string, unknown>) => {
    if (!row || typeof row !== 'object') return [];
    const categories = row['categories'] as Record<string, unknown> | undefined;
    const location = str(categories?.['location']);
    // Only explicit Israeli locations; remote does not imply worldwide eligibility.
    if (
      !/tel aviv|israel|herzliya|haifa|jerusalem|raanana|ra'anana|petah tikva|beer sheva/i.test(
        location,
      )
    )
      return [];
    const id = str(row['id']);
    const title = str(row['text']).slice(0, 200);
    if (!/^[a-z0-9-]{10,80}$/i.test(id) || !title) return [];
    let url: URL;
    try {
      url = new URL(str(row['hostedUrl']));
    } catch {
      return [];
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'jobs.lever.co' ||
      !url.pathname.startsWith('/walkme/') ||
      url.username ||
      url.password
    )
      return [];
    const district = /haifa/i.test(location)
      ? 'haifa'
      : /jerusalem/i.test(location)
        ? 'jerusalem'
        : /beer sheva/i.test(location)
          ? 'south'
          : /raanana|ra'anana|petah tikva/i.test(location)
            ? 'central'
            : /tel aviv|herzliya/i.test(location)
              ? 'tel-aviv'
              : 'unknown';
    const style = row['workplaceType'];
    const published =
      typeof row['createdAt'] === 'number' && Number.isFinite(row['createdAt'])
        ? new Date(row['createdAt']).toISOString()
        : undefined;
    return [
      {
        id: `lever-walkme-${id}`,
        title,
        company: 'WalkMe',
        initials: 'WM',
        color: '#e4f1fa',
        district,
        category: classify(title),
        workStyle:
          style === 'remote' || style === 'hybrid'
            ? style
            : style === 'on-site'
              ? 'onsite'
              : 'unknown',
        description: plainText(
          [
            row['descriptionPlain'],
            ...(Array.isArray(row['lists'])
              ? row['lists'].map(
                  (l: Record<string, unknown>) => `${str(l['text'])} ${plainText(l['content'])}`,
                )
              : []),
          ].join('\n'),
        ),
        posted: published ? `פורסם: ${published.slice(0, 10)}` : 'מועד הפרסום לא נמסר',
        skills: [],
        offices: [],
        reason: 'מקור: WalkMe / Lever. סיווג תחום לפי כותרת; סגנון עבודה לפי המקור.',
        source: {
          kind: 'real',
          sourceId: 'lever-walkme',
          name: 'WalkMe / Lever',
          url: 'https://jobs.lever.co/walkme',
          applicationUrl: url.href,
          updatedAt: published ?? '',
          publishedAt: published,
          fetchedAt,
          location,
          active: true,
          classification: 'תחום לפי כותרת. אין כתובת משרד מאומתת.',
        },
      } satisfies Job,
    ];
  });
}
export async function boundedJson(response: Response, maximum = 4_000_000): Promise<unknown> {
  if (!response.body) throw new Error('EMPTY_RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(buffer));
}
export async function importLegacyJobs(db: CareerDb): Promise<void> {
  if (
    !(await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='niva_pilot_jobs'"))
      .length
  )
    return;
  await db.run(`INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data)
    SELECT id,'greenhouse-appsflyer',json_extract(data,'$.source.applicationUrl'),lower(json_extract(data,'$.company')),lower(json_extract(data,'$.title')),
    coalesce(json_extract(data,'$.district'),'unknown'),coalesce(json_extract(data,'$.category'),'other'),coalesce(json_extract(data,'$.workStyle'),'unknown'),
    lower(json_extract(data,'$.title') || ' ' || json_extract(data,'$.company')),active,coalesce(json_extract(data,'$.source.version'),'legacy-' || id),data
    FROM niva_pilot_jobs WHERE json_valid(data) AND json_extract(data,'$.source.applicationUrl') IS NOT NULL
    AND json_extract(data,'$.title') IS NOT NULL AND json_extract(data,'$.company') IS NOT NULL LIMIT 1000 ON CONFLICT(id) DO NOTHING`);
}
export async function ingest(db: CareerDb, now = Date.now()): Promise<void> {
  // Bounded historical data import is an ingestion operation, never a schema migration.
  await importLegacyJobs(db);
  // One-time repair of bootstrap failures from the unsupported Worker redirect:error policy.
  // Those requests failed at construction, before contacting providers. Preserve real 429 backoff.
  const repaired = await db.all(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','maintenance','manual-redirect-v1','{}',9007199254740991) ON CONFLICT(owner,kind,id) DO NOTHING RETURNING id",
  );
  if (repaired.length)
    await db.run(
      "UPDATE niva_sources SET next_at=0,lease_until=0 WHERE checked_at IS NULL AND error='SOURCE_UNAVAILABLE'",
    );
  for (const source of SOURCES) {
    await db.run('INSERT INTO niva_sources(id) VALUES(?) ON CONFLICT(id) DO NOTHING', source.id);
    const lease = await db.all(
      'UPDATE niva_sources SET lease_until=? WHERE id=? AND next_at<=? AND lease_until<=? RETURNING id',
      now + 60000,
      source.id,
      now,
      now,
    );
    if (!lease.length) continue;
    try {
      const response = await fetch(source.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
        redirect: 'manual',
      });
      if (!response.ok) {
        const retry = Math.min(
          86400000,
          Math.max(source.cadence, Number(response.headers.get('retry-after')) * 1000 || 0),
        );
        if (response.status === 429)
          await db.run('UPDATE niva_sources SET next_at=? WHERE id=?', now + retry, source.id);
        throw new Error(response.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE');
      }
      const at = new Date(now).toISOString();
      const payload = await boundedJson(response);
      const jobs =
        source.provider === 'greenhouse'
          ? normalizeGreenhouse(payload, source, at)
          : normalizeLever(payload, at);
      const rows: { sql: string; args: (string | number | null)[] }[] = [
        { sql: 'UPDATE niva_jobs SET active=0 WHERE source_id=?', args: [source.id] },
      ];
      const unique = new Map(jobs.map((j) => [j.id, j]));
      for (const job of unique.values()) {
        job.source!.sourceId = source.id;
        if (source.id === 'greenhouse-appsflyer')
          job.reason =
            'מקור: AppsFlyer / Greenhouse. הסיווג לפי כותרת התפקיד; הסבר התאמה מוצג בנפרד.';
        job.source!.version = versionOf([
          job.title,
          job.description,
          job.district,
          job.workStyle,
          job.source!.updatedAt,
        ]);
        const canonical = canonicalJobUrl(job.source!.applicationUrl);
        rows.push({
          sql: 'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET canonical=excluded.canonical,company=excluded.company,title=excluded.title,district=excluded.district,category=excluded.category,style=excluded.style,search=excluded.search,active=1,version=excluded.version,data=excluded.data',
          args: [
            job.id,
            source.id,
            canonical,
            job.company.toLowerCase(),
            job.title.toLowerCase(),
            job.district,
            job.category,
            job.workStyle,
            `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase(),
            job.source!.version,
            JSON.stringify(job),
          ],
        });
      }
      rows.push({
        sql: 'UPDATE niva_sources SET checked_at=?,next_at=?,failures=0,error=NULL,lease_until=0 WHERE id=?',
        args: [at, now + source.cadence, source.id],
      });
      await db.batch(rows);
    } catch (error) {
      const row = (
        await db.all<{ failures: number }>(
          'SELECT failures FROM niva_sources WHERE id=?',
          source.id,
        )
      )[0];
      const delay = Math.min(21600000, source.cadence * 2 ** Math.min(row?.failures ?? 0, 6));
      await db.run(
        'UPDATE niva_sources SET failures=failures+1,error=?,next_at=MAX(next_at,?),lease_until=0 WHERE id=?',
        error instanceof Error && error.message === 'RATE_LIMITED'
          ? 'RATE_LIMITED'
          : 'SOURCE_UNAVAILABLE',
        now + delay,
        source.id,
      );
    }
  }
}
export async function catalogJobs(db: CareerDb): Promise<Job[]> {
  return (await db.all<{ data: string; active: number }>('SELECT data,active FROM niva_jobs')).map(
    (row) => {
      const j = JSON.parse(row.data) as Job;
      j.source!.active = !!row.active;
      return j;
    },
  );
}
export interface FeedQuery {
  q?: string;
  category?: string;
  district?: string;
  styles?: string;
  cursor?: string;
  limit?: string;
  saved?: string;
}
export async function discoveryPage(
  db: CareerDb,
  secret: string,
  query: FeedQuery,
  preferences: Preferences = defaultPreferences(),
  saved: string[] = [],
) {
  const health = await db.all<{
    id: string;
    checked_at: string | null;
    error: string | null;
    next_at: number;
  }>('SELECT id,checked_at,error,next_at FROM niva_sources ORDER BY id');
  const snapshot = versionOf(await db.all('SELECT id,version,active FROM niva_jobs ORDER BY id'));
  const filterKey = versionOf([
    query.q,
    query.category,
    query.district,
    query.styles,
    query.saved,
    preferences,
    query.saved ? saved : [],
  ]);
  let after = '';
  if (query.cursor) {
    try {
      const [payload, mac] = query.cursor.split('.');
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (
        !mac ||
        mac.length !== expected.length ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
      )
        throw new Error();
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
        snapshot: string;
        filterKey: string;
        after: string;
      };
      if (parsed.snapshot !== snapshot || parsed.filterKey !== filterKey) throw new Error();
      after = parsed.after;
    } catch {
      throw new Error('CURSOR_EXPIRED');
    }
  }
  const clauses = ['active=1'];
  const args: (string | number)[] = [];
  const add = (sql: string, value: string) => {
    clauses.push(sql);
    args.push(value);
    if (sql.includes('json_each')) args.push(value);
  };
  if (query.saved !== 'true' && preferences.role !== 'all') add('category=?', preferences.role);
  if (query.saved !== 'true' && preferences.district !== 'all')
    add(
      "(district=? OR EXISTS (SELECT 1 FROM json_each(niva_jobs.data,'$.offices') WHERE json_extract(value,'$.district')=?))",
      preferences.district,
    );
  const screen = migratePreferences({
    role: query.category,
    district: query.district,
    workStyles: query.styles?.split(','),
  });
  if (screen.role !== 'all') add('category=?', screen.role);
  if (screen.district !== 'all')
    add(
      "(district=? OR EXISTS (SELECT 1 FROM json_each(niva_jobs.data,'$.offices') WHERE json_extract(value,'$.district')=?))",
      screen.district,
    );
  for (const styles of [query.saved === 'true' ? [] : preferences.workStyles, screen.workStyles])
    if (styles.length) {
      clauses.push(`style IN (${styles.map(() => '?').join(',')})`);
      args.push(...styles);
    }
  for (const x of preferences.exclusions
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean))
    add('instr(company,?)=0', x);
  if (query.q) add('instr(search,?)>0', query.q.toLowerCase().slice(0, 200));
  if (query.saved === 'true') {
    clauses[0] = '1=1';
    clauses.push(`id IN (${saved.length ? saved.map(() => '?').join(',') : 'NULL'})`);
    args.push(...saved);
  }
  // Choose a representative within the already-authorized/filtered identity set.
  const where = clauses.join(' AND ');
  const ranked = `WITH eligible AS (SELECT * FROM niva_jobs WHERE ${where}), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY canonical ORDER BY active DESC,id) AS representative FROM eligible)`;
  const count =
    (
      await db.all<{ total: number }>(
        `${ranked} SELECT count(*) AS total FROM ranked WHERE representative=1`,
        ...args,
      )
    )[0]?.total ?? 0;
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
  const rows = await db.all<{ id: string; data: string; active: number }>(
    `${ranked} SELECT id,data,active FROM ranked WHERE representative=1 AND id>? ORDER BY id LIMIT ?`,
    ...args,
    after,
    limit + 1,
  );
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const jobs = page.map((row) => {
    const j = JSON.parse(row.data) as Job;
    j.source!.active = !!row.active;
    return j;
  });
  for (const job of jobs) {
    const attributed = await db.all<{ data: string }>(
      'SELECT data FROM niva_jobs WHERE canonical=?',
      canonicalJobUrl(job.source!.applicationUrl),
    );
    job.source!.attribution = attributed.map((r) => {
      const j = JSON.parse(r.data) as Job;
      return { name: j.source!.name, url: j.source!.applicationUrl };
    });
  }
  const archived: Job[] = [];
  for (let offset = 0; offset < saved.length; offset += 50) {
    const ids = saved.slice(offset, offset + 50);
    const rows = await db.all<{ data: string; active: number }>(
      `SELECT data,active FROM niva_jobs WHERE id IN (${ids.map(() => '?').join(',')})`,
      ...ids,
    );
    for (const row of rows) {
      const job = JSON.parse(row.data) as Job;
      job.source!.active = !!row.active;
      if (!jobs.some((j) => j.id === job.id)) archived.push(job);
    }
  }
  const exclusions = (preferences?.exclusions ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const coverageWhere = ['active=1', ...exclusions.map(() => 'instr(company,?)=0')].join(' AND ');
  const coverage = await db.all<{ category: string; district: string; style: string; n: number }>(
    `SELECT category,district,style,count(DISTINCT canonical) AS n FROM niva_jobs WHERE ${coverageWhere} GROUP BY category,district,style`,
    ...exclusions,
  );
  const payload = Buffer.from(
    JSON.stringify({ snapshot, filterKey, after: page.at(-1)?.id }),
  ).toString('base64url');
  return {
    jobs,
    archived,
    total: count,
    coverage,
    nextCursor: more
      ? `${payload}.${createHmac('sha256', secret).update(payload).digest('hex')}`
      : null,
    snapshot,
    health: health.map((h) => ({ ...h, name: SOURCES.find((s) => s.id === h.id)?.name ?? h.id })),
    fetchedAt: health.map((x) => x.checked_at ?? '').sort()[0] ?? '',
    stale: health.some(
      (h) => !!h.error || !h.checked_at || Date.now() - Date.parse(h.checked_at) > 1800000,
    ),
  };
}
