import { normalizeSearch } from '../src/app/core/preferences';
import { passesDiscovery, type DiscoveryFilters } from '../src/app/core/discovery-filters';
import type { CandidateCriteria } from '../src/app/core/models/discovery';
import { normalizeJobicy } from './jobicy-source';
import { JSEARCH_SOURCES } from './jsearch-source';
import { enrichJob } from './job-facts';
import { reindexFacts } from './reindex-facts';
import { canonicalJobUrl } from '../src/app/core/job-identity';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { CareerDb } from './career-db';
import { plainText, classify } from './job-feed';
import { SOURCES, type JobSource } from './job-sources';
import { normalizeGreenhouse } from './greenhouse-source';
import { recordSourceAttempt, sourceFreshness } from './source-health';
import { descriptionBlocks } from './description-blocks';
import { discoveryRank, relatedQaQuery, qaTitle } from '../src/app/core/discovery-ranking';
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
export function normalizeLever(
  payload: unknown,
  fetchedAt: string,
  source: JobSource = SOURCES.find((s) => s.id === 'lever-walkme')!,
  scope: 'israel' | 'global' = 'israel',
): Job[] {
  if (!Array.isArray(payload) || payload.length >= 100) throw new Error('INCOMPLETE_SOURCE');
  return payload.flatMap((row: Record<string, unknown>) => {
    if (!row || typeof row !== 'object') return [];
    const categories = row['categories'] as Record<string, unknown> | undefined;
    const location = str(categories?.['location']);
    // Only explicit Israeli locations; remote does not imply worldwide eligibility.
    if (
      scope === 'israel' &&
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
      !url.pathname.startsWith('/' + source.board + '/') ||
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
            : /tel aviv|herzliya|kiryat[ -]?ono|holon/i.test(location)
              ? 'tel-aviv'
              : 'unknown';
    const style = row['workplaceType'];
    const published =
      typeof row['createdAt'] === 'number' && Number.isFinite(row['createdAt'])
        ? new Date(row['createdAt']).toISOString()
        : undefined;
    return [
      {
        id: `${source.id}-${id}`,
        title,
        company: source.company,
        initials: source.company.slice(0, 2).toUpperCase(),
        color: '#e4f1fa',
        district,
        category: classify(title),
        workStyle:
          style === 'remote' || style === 'hybrid'
            ? style
            : style === 'on-site' || style === 'onsite'
              ? 'onsite'
              : 'unknown',
        description: plainText(
          [
            row['descriptionPlain'],
            ...(Array.isArray(row['lists'])
              ? row['lists'].map(
                  (l: Record<string, unknown>) => `${str(l['text'])}
${plainText(l['content'])}`,
                )
              : []),
          ].join('\n'),
        ),
        descriptionBlocks: [
          ...descriptionBlocks(row['description'] ?? row['descriptionPlain']),
          ...(Array.isArray(row['lists'])
            ? row['lists'].flatMap((l: Record<string, unknown>) => [
                { kind: 'heading' as const, level: 2, text: plainText(l['text']) },
                ...descriptionBlocks(l['content']),
              ])
            : []),
        ],
        posted: published ? `פורסם: ${published.slice(0, 10)}` : 'מועד הפרסום לא נמסר',
        skills: [],
        offices: [],
        reason: `מקור: ${source.name}. סיווג תחום לפי כותרת; סגנון עבודה לפי המקור.`,
        source: {
          kind: 'real',
          sourceId: source.id,
          name: source.name,
          url: source.careersUrl,
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
export async function ingest(
  db: CareerDb,
  now = Date.now(),
  { refresh = false } = {},
): Promise<void> {
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
  const update = async (source: (typeof SOURCES)[number]) => {
    await db.run('INSERT INTO niva_sources(id) VALUES(?) ON CONFLICT(id) DO NOTHING', source.id);
    const lease = await db.all(
      'UPDATE niva_sources SET lease_until=? WHERE id=? AND next_at<=? AND lease_until<=? RETURNING id',
      Math.max(now, Date.now()) + (source.provider === 'jobicy' ? 120000 : 60000),
      source.id,
      now,
      now,
    );
    if (!lease.length) {
      // Other requests/isolates share durable leases. Wait for their result on visits.
      if (refresh) {
        const deadline = Date.now() + 65000;
        for (;;) {
          const [active] = await db.all<{ lease_until: number }>(
            'SELECT lease_until FROM niva_sources WHERE id=?',
            source.id,
          );
          if (!active || active.lease_until <= Date.now()) break;
          if (Date.now() >= deadline) throw new Error('SOURCE_REFRESH_TIMEOUT');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      return;
    }
    await recordSourceAttempt(db, source.id, now);
    try {
      const response = await fetch(source.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
        redirect: 'manual',
      });
      if (!response.ok) {
        const retry = Math.min(
          86400000,
          Math.max(
            source.cadence,
            Number(response.headers.get('retry-after')) * 1000 ||
              Math.max(0, Date.parse(response.headers.get('retry-after') ?? '') - now) ||
              0,
          ),
        );
        if (response.status === 429)
          await db.run('UPDATE niva_sources SET next_at=? WHERE id=?', now + retry, source.id);
        throw new Error(response.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE');
      }
      let payload = await boundedJson(response);
      let partial = false;
      if (source.provider === 'jobicy') {
        let page = payload as { jobs?: unknown[]; hasMore?: boolean; nextCursor?: unknown };
        if (!Array.isArray(page.jobs)) throw Error('INVALID_FEED');
        const all = [...page.jobs];
        const seen = new Set<string>();
        for (let n = 1; page.hasMore; n++) {
          if (n >= 5) {
            partial = true;
            break;
          }
          if (
            typeof page.nextCursor !== 'string' ||
            !page.nextCursor ||
            page.nextCursor.length > 500 ||
            seen.has(page.nextCursor)
          )
            throw Error('INCOMPLETE_SOURCE');
          seen.add(page.nextCursor);
          const next = new URL(source.url);
          next.searchParams.set('cursor', page.nextCursor);
          const response = await fetch(next.href, {
            headers: { Accept: 'application/json' },
            redirect: 'manual',
            signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw Error('SOURCE_UNAVAILABLE');
          page = (await boundedJson(response)) as typeof page;
          if (!Array.isArray(page.jobs)) throw Error('INCOMPLETE_SOURCE');
          all.push(...page.jobs);
        }
        payload = { ...page, jobs: all, hasMore: false, nextCursor: null };
      }
      const at = new Date(Math.max(now, Date.now())).toISOString();
      const jobs =
        source.provider === 'greenhouse'
          ? normalizeGreenhouse(payload, source, at, 'global')
          : source.provider === 'jobicy'
            ? normalizeJobicy(payload, at)
            : normalizeLever(payload, at, source, 'global');
      const rows: { sql: string; args: (string | number | null)[] }[] = [
        ...(source.provider === 'jobicy'
          ? []
          : [{ sql: 'UPDATE niva_jobs SET active=0 WHERE source_id=?', args: [source.id] }]),
      ];
      const previous = new Map(
        (
          await db.all<{ id: string; data: string }>(
            source.provider === 'jobicy'
              ? "SELECT id,json_object('id',id,'title',title,'source',json_extract(data,'$.source')) AS data FROM niva_jobs WHERE source_id=? AND (active=1 OR id IN (SELECT value FROM json_each(?)) OR id IN (SELECT id FROM niva_jobs WHERE source_id=? AND json_extract(data,'$.source.availability')='unknown' ORDER BY coalesce(json_extract(data,'$.source.statusCheckedAt'),json_extract(data,'$.source.lastVerifiedAt'),'') LIMIT 100))"
              : 'SELECT id,data FROM niva_jobs WHERE source_id=?',
            source.id,
            ...(source.provider === 'jobicy'
              ? [JSON.stringify(jobs.map((j) => j.id)), source.id]
              : []),
          )
        ).map((row) => [row.id, JSON.parse(row.data) as Job]),
      );
      const unique = new Map(jobs.map((j) => [j.id, enrichJob(j)]));
      // A rolling seven-day feed cannot establish closure by absence. Status is explicit.
      if (source.provider === 'jobicy') {
        rows.push({
          sql: "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','source-window',?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
          args: [
            source.id,
            JSON.stringify({ partial, limit: 1000, checkedAt: at }),
            now + 172800000,
          ],
        });
        const missing = [...previous.values()]
          .filter((j) => !unique.has(j.id))
          .sort((a, b) =>
            (a.source!.statusCheckedAt ?? a.source!.lastVerifiedAt ?? '').localeCompare(
              b.source!.statusCheckedAt ?? b.source!.lastVerifiedAt ?? '',
            ),
          );
        for (const old of missing.slice(100))
          if (now - Date.parse(old.source!.lastVerifiedAt ?? old.source!.fetchedAt) > 86400000)
            rows.push({
              sql: "UPDATE niva_jobs SET active=0,data=json_set(data,'$.source.availability','unknown','$.source.active',json('false')),version=? WHERE id=?",
              args: [versionOf([old.id, 'unverified']), old.id],
            });
        for (let offset = 0; offset < Math.min(100, missing.length); offset += 100) {
          const batch = missing.slice(offset, offset + 100);
          const response = await fetch(
            'https://jobicy.com/api/jobs/status?ids=' +
              batch.map((j) => j.id.slice(source.id.length + 1)).join(','),
            {
              headers: { Accept: 'application/json' },
              redirect: 'manual',
              signal: AbortSignal.timeout(5000),
            },
          );
          if (!response.ok) throw Error('SOURCE_UNAVAILABLE');
          const statuses = (await boundedJson(response)) as {
            success?: boolean;
            jobs?: { id: number; status: string }[];
          };
          if (statuses.success !== true || !Array.isArray(statuses.jobs))
            throw Error('INVALID_STATUS');
          for (const old of batch) {
            const status = statuses.jobs.find(
              (s) => String(s.id) === old.id.slice(source.id.length + 1),
            )?.status;
            const availability =
              status === 'active' ? 'published' : status === 'closed' ? 'closed' : 'unknown';
            const verified =
              status === 'active' || status === 'closed'
                ? at
                : (old.source!.lastVerifiedAt ?? null);
            const version =
              availability === old.source!.availability
                ? (old.source!.version ?? versionOf([old.id, availability]))
                : versionOf([old.id, old.source!.version, availability]);
            rows.push({
              sql: "UPDATE niva_jobs SET active=?,data=json_set(data,'$.source.availability',?,'$.source.lastVerifiedAt',?,'$.source.statusCheckedAt',?,'$.source.active',json(?),'$.source.version',?),version=? WHERE id=?",
              args: [
                status === 'active' ? 1 : 0,
                availability,
                verified,
                at,
                status === 'active' ? 'true' : 'false',
                version,
                version,
                old.id,
              ],
            });
          }
        }
      }
      for (const job of unique.values()) {
        const old = previous.get(job.id);
        // Metadata-only snapshots retain a detail description while the provider's update
        // version is unchanged; its original evidence timestamps remain intact.
        if (
          source.provider === 'greenhouse' &&
          !new URL(source.url).searchParams.has('content') &&
          old?.source?.descriptionFetchedAt &&
          old.source.updatedAt === job.source!.updatedAt
        ) {
          job.description = old.description;
          job.facts = old.facts;
          job.source!.descriptionFetchedAt = old.source.descriptionFetchedAt;
        }
        job.source!.sourceId = source.id;
        job.source!.firstSeenAt = previous.has(job.id)
          ? (previous.get(job.id)!.source?.firstSeenAt ?? null)
          : at;
        job.source!.lastVerifiedAt = at;
        job.source!.availability = 'published';
        job.source!.applicationCheck =
          previous.get(job.id)?.source?.applicationUrl === job.source!.applicationUrl &&
          previous.get(job.id)?.source?.updatedAt === job.source!.updatedAt
            ? previous.get(job.id)?.source?.applicationCheck
            : undefined;
        if (source.id === 'greenhouse-appsflyer')
          job.reason =
            'מקור: AppsFlyer / Greenhouse. הסיווג לפי כותרת התפקיד; הסבר התאמה מוצג בנפרד.';
        job.source!.version = versionOf([
          job.title,
          job.description,
          job.district,
          job.workStyle,
          job.source!.updatedAt,
          JSON.stringify(job.facts, (key, value) => (key === 'observedAt' ? undefined : value)),
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
  };
  // Bound upstream concurrency while allowing independent slow boards to progress.
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < SOURCES.length) await update(SOURCES[index++]);
    }),
  );
}
export async function catalogJobs(db: CareerDb): Promise<Job[]> {
  return (await db.all<{ data: string; active: number }>('SELECT data,active FROM niva_jobs')).map(
    (row) => {
      const j = JSON.parse(row.data) as Job;
      j.source!.active = !!row.active;
      if (!row.active && j.source!.availability !== 'unknown') j.source!.availability = 'closed';
      return j;
    },
  );
}
/** Indexed single-record retrieval. Authorization remains at the owning route. */
export async function catalogJob(db: CareerDb, id: string): Promise<Job | undefined> {
  const [row] = await db.all<{ data: string; active: number }>(
    'SELECT data,active FROM niva_jobs WHERE id=? LIMIT 1',
    id,
  );
  if (!row) return undefined;
  const job = JSON.parse(row.data) as Job;
  job.source!.active = !!row.active;
  if (!row.active && job.source!.availability !== 'unknown') job.source!.availability = 'closed';
  return job;
}
export interface FeedQuery extends DiscoveryFilters {
  sort?: string;
  q?: string;
  category?: string;
  district?: string;
  styles?: string;
  cursor?: string;
  limit?: string;
  saved?: string;
  unknownStyle?: string;
  scope?: string;
  area?: string;
  related?: string;
  location?: string;
}
export async function discoveryPage(
  db: CareerDb,
  secret: string,
  query: FeedQuery,
  preferences: Preferences = defaultPreferences(),
  saved: string[] = [],
  criteria?: CandidateCriteria,
) {
  await reindexFacts(db);
  const health = await db.all<{
    id: string;
    checked_at: string | null;
    attempted_at: string | null;
    error: string | null;
    next_at: number;
    partial: number;
  }>(
    "SELECT id,checked_at,(SELECT json_extract(data,'$.attemptedAt') FROM niva_documents WHERE owner='system' AND kind='source-attempt' AND niva_documents.id=niva_sources.id) AS attempted_at,error,next_at,coalesce((SELECT json_extract(data,'$.partial') FROM niva_documents WHERE owner='system' AND kind='source-window' AND niva_documents.id=niva_sources.id),0) AS partial FROM niva_sources ORDER BY id",
  );
  const snapshot = versionOf(await db.all('SELECT id,version,active FROM niva_jobs ORDER BY id'));
  const filterKey = versionOf([
    [
      'eligibility',
      'country',
      'remoteScope',
      'salaryMin',
      'currency',
      'period',
      'seniority',
      'employment',
      'since',
      'provider',
      'missing',
    ].map((key) => query[key as keyof FeedQuery]),
    criteria,
    normalizeSearch(query.q),
    query.category,
    query.district,
    query.styles,
    query.saved,
    query.unknownStyle,
    query.scope,
    query.area,
    query.related,
    query.location,
    query.sort,
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
  if (query.saved !== 'true' && query.scope !== 'all' && preferences.role !== 'all') {
    if (query.related === 'true' && ['qa-manual', 'qa-automation'].includes(preferences.role))
      clauses.push("category IN ('qa-manual','qa-automation')");
    else add('category=?', preferences.role);
  }
  if (
    query.saved !== 'true' &&
    query.scope !== 'all' &&
    query.area !== 'all' &&
    preferences.district !== 'all'
  )
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
  for (const styles of [
    query.saved === 'true' || query.scope === 'all' ? [] : preferences.workStyles,
    screen.workStyles,
  ])
    if (styles.length) {
      clauses.push(
        `(style IN (${styles.map(() => '?').join(',')})${query.unknownStyle !== 'false' ? " OR style='unknown'" : ''})`,
      );
      args.push(...styles);
    }
  if (query.unknownStyle === 'false') clauses.push("style<>'unknown'");
  for (const x of preferences.exclusions
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean))
    add('instr(company,?)=0', x);
  if (query.location)
    add(
      "instr(lower(coalesce(json_extract(data,'$.source.location'),'')),?)>0",
      query.location.toLowerCase().slice(0, 200),
    );
  if (normalizeSearch(query.q)) {
    if (query.related === 'true' && relatedQaQuery(query.q!)) {
      clauses.push(
        "(category IN ('qa-manual','qa-automation') OR instr(title,'sdet')>0 OR instr(title,'in test')>0)",
      );
    } else add('instr(search,?)>0', normalizeSearch(query.q));
  }
  if (query.saved === 'true') {
    clauses[0] = '1=1';
    clauses.push(`id IN (${saved.length ? saved.map(() => '?').join(',') : 'NULL'})`);
    args.push(...saved);
  }
  // Choose a representative within the already-authorized/filtered identity set.
  const where = clauses.join(' AND ');
  const ranked = `WITH eligible AS (SELECT id,canonical,active FROM niva_jobs WHERE ${where}), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY canonical ORDER BY active DESC,id) AS representative FROM eligible)`;
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
  const page: { id: string; rank: number }[] = [];
  const relevance = query.sort === 'relevance';
  const compare = (a: { id: string; rank: number }, b: { id: string; rank: number }) =>
    b.rank - a.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  let afterRank = 0;
  if (after && relevance) {
    const previous = await catalogJob(db, after);
    if (!previous) throw Error('CURSOR_EXPIRED');
    afterRank = discoveryRank(previous, query.q ?? '', preferences, criteria).rank;
  }
  let count = 0,
    matchingAfter = 0,
    scan = '';
  for (;;) {
    // Evidence prose is needed by selected cards, not eligibility filtering.
    // Keep canonical ranking identical and bound intermediate row residency.
    const candidates = await db.all<{ id: string; data: string; active: number }>(
      `${ranked} SELECT j.id,json_remove(j.data,'$.description','$.descriptionBlocks','$.facts.requiredSkills','$.facts.preferredSkills','$.facts.responsibilities','$.facts.workArrangements','$.facts.salaryText') AS data,j.active FROM ranked r JOIN niva_jobs j ON j.id=r.id WHERE r.representative=1 AND r.id>? ORDER BY r.id LIMIT 128`,
      ...args,
      scan,
    );
    for (const row of candidates) {
      const parsed = JSON.parse(row.data) as Job;
      const job = parsed.facts ? parsed : enrichJob(parsed);
      job.source!.active = !!row.active;
      if (!row.active && job.source!.availability !== 'unknown')
        job.source!.availability = 'closed';
      // Category preselection can be broader than the explicit title alias policy.
      // Apply the same predicate as the browser before counting and pagination.
      if (query.related === 'true' && relatedQaQuery(query.q ?? '') && !qaTitle(job.title))
        continue;
      if (query.saved === 'true' || passesDiscovery(job, query, preferences, criteria)) {
        count++;
        const rank = relevance ? discoveryRank(job, query.q ?? '', preferences, criteria).rank : 0;
        if (
          !after ||
          (relevance
            ? compare({ id: job.id, rank }, { id: after, rank: afterRank }) > 0
            : job.id > after)
        ) {
          matchingAfter++;
          if (relevance) {
            page.push({ id: job.id, rank });
            page.sort(compare);
            if (page.length > limit) page.pop();
          } else if (page.length < limit) page.push({ id: job.id, rank });
        }
      }
    }
    if (candidates.length < 128) break;
    scan = candidates.at(-1)!.id;
  }
  const more = matchingAfter > limit;
  // Only selected cards need full descriptions. Keep global-catalog assessment bounded.
  const jobs: Job[] = page.length
    ? (
        await db.all<{ data: string; active: number }>(
          `SELECT data,active FROM niva_jobs WHERE id IN (${page.map(() => '?').join(',')}) ORDER BY id`,
          ...page.map((j) => j.id),
        )
      ).map((row) => {
        const job = enrichJob(JSON.parse(row.data) as Job);
        job.source!.active = !!row.active;
        if (!row.active && job.source!.availability !== 'unknown')
          job.source!.availability = 'closed';
        return job;
      })
    : [];
  jobs.sort((a, b) => page.findIndex((r) => r.id === a.id) - page.findIndex((r) => r.id === b.id));
  const canonicals = [...new Set(jobs.map((j) => canonicalJobUrl(j.source!.applicationUrl)))];
  const references = canonicals.length
    ? await db.all<{ canonical: string; name: string; url: string }>(
        `SELECT canonical,json_extract(data,'$.source.name') AS name,json_extract(data,'$.source.applicationUrl') AS url FROM niva_jobs WHERE canonical IN (${canonicals.map(() => '?').join(',')})`,
        ...canonicals,
      )
    : [];
  for (const job of jobs)
    job.source!.attribution = references
      .filter((r) => r.canonical === canonicalJobUrl(job.source!.applicationUrl))
      .map(({ name, url }) => ({ name, url }));
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
      if (!row.active && job.source!.availability !== 'unknown')
        job.source!.availability = 'closed';
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
    ranking: {
      mode: relevance ? 'catalog' : 'source',
      version: relevance ? 'discovery-evidence-v1' : null,
    },
    health: health.map((h) => ({
      ...h,
      partial: !!h.partial,
      name: [...SOURCES, ...JSEARCH_SOURCES].find((s) => s.id === h.id)?.name ?? h.id,
    })),
    freshness: sourceFreshness(health),
    fetchedAt: sourceFreshness(health).newestSuccessfulAt ?? '',
    stale: health.some(
      (h) =>
        !!h.error ||
        !h.checked_at ||
        Date.now() - Date.parse(h.checked_at) >
          Math.max(
            1800000,
            ([...SOURCES, ...JSEARCH_SOURCES].find((s) => s.id === h.id)?.cadence ?? 900000) * 2,
          ),
    ),
  };
}
