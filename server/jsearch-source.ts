import { createHash } from 'node:crypto';
import { descriptionBlocks } from './description-blocks';
import { recordSourceAttempt } from './source-health';
import type { Job } from '../src/app/core/models/job';
import { JSEARCH_SOURCES, trustedPublisherUrl } from '../src/app/core/source-registry';
import { plainText, classify } from './job-feed';
import { enrichJob } from './job-facts';
import type { CareerDb } from './career-db';
import { canonicalJobUrl } from '../src/app/core/job-identity';
export { JSEARCH_SOURCES };
const DAY = 86400000;
const markets = [
  { country: 'il', location: 'Tel Aviv, Israel' },
  { country: 'us', location: 'New York, United States' },
  { country: 'gb', location: 'London, United Kingdom' },
];
export function normalizeJsearch(payload: unknown, publisher: string, at: string): Job[] {
  const p = payload as { status?: string; data?: { jobs?: Record<string, unknown>[] } };
  if (p?.status !== 'OK' || !Array.isArray(p.data?.jobs) || p.data.jobs.length > 100)
    throw Error('INVALID_FEED');
  const source = JSEARCH_SOURCES.find((s) => s.board === publisher)!;
  return p.data.jobs.flatMap((row) => {
    const options = Array.isArray(row['apply_options'])
      ? (row['apply_options'] as Record<string, unknown>[])
      : [];
    const links = [
      ...(String(row['job_publisher']).toLowerCase() === publisher ? [row['job_apply_link']] : []),
      ...options
        .filter((o) => String(o['publisher']).toLowerCase() === publisher)
        .map((o) => o['apply_link']),
    ];
    const url = links.find((v) => typeof v === 'string' && trustedPublisherUrl(publisher, v)) as
      string | undefined;
    if (
      !url ||
      typeof row['job_id'] !== 'string' ||
      typeof row['job_title'] !== 'string' ||
      typeof row['employer_name'] !== 'string'
    )
      return [];
    const parsedUrl = new URL(url);
    const postingId =
      publisher === 'linkedin'
        ? parsedUrl.pathname.match(/(\d+)\/?$/)![1]
        : parsedUrl.searchParams.get('jk')!;
    const id =
      source.id +
      '-' +
      createHash('sha256').update(`${publisher}:${postingId}`).digest('hex').slice(0, 24);
    const published =
      typeof row['job_posted_at_datetime_utc'] === 'string' &&
      Number.isFinite(Date.parse(row['job_posted_at_datetime_utc']))
        ? new Date(row['job_posted_at_datetime_utc']).toISOString()
        : undefined;
    const location =
      plainText(row['job_location']) ||
      [row['job_city'], row['job_state'], row['job_country']]
        .filter((v) => typeof v === 'string')
        .join(', ');
    const arrangement = row['work_arrangement'];
    const job: Job = {
      id,
      title: plainText(row['job_title']).slice(0, 200),
      company: plainText(row['employer_name']).slice(0, 150),
      initials: plainText(row['employer_name']).slice(0, 2).toUpperCase(),
      color: '#e4f1fa',
      category: classify(row['job_title']),
      district: /tel[ -]?aviv|herzliya|holon|kiryat[ -]?ono/i.test(location)
        ? 'tel-aviv'
        : 'unknown',
      workStyle:
        arrangement === 'hybrid'
          ? 'hybrid'
          : arrangement === 'onsite'
            ? 'onsite'
            : row['job_is_remote'] === true || arrangement === 'remote'
              ? 'remote'
              : 'unknown',
      description: plainText(row['job_description']),
      descriptionBlocks: descriptionBlocks(row['job_description']),
      skills: [],
      offices: [],
      posted: published ? `פורסם: ${published.slice(0, 10)}` : 'מועד הפרסום לא נמסר',
      reason: `${source.name} · תוצאת חיפוש מספק חיצוני; הזמינות והזכאות דורשות בדיקה באתר המקור.`,
      source: {
        kind: 'real',
        sourceId: source.id,
        name: source.name,
        url,
        applicationUrl: url,
        location,
        active: true,
        updatedAt: '',
        publishedAt: published,
        fetchedAt: at,
        firstSeenAt: at,
        lastVerifiedAt: at,
        availability: 'published',
        version: createHash('sha256')
          .update(JSON.stringify([row['job_title'], row['job_description'], url]))
          .digest('hex')
          .slice(0, 24),
        classification:
          'חיפוש דרך JSearch; שוק/מדינת החיפוש אינם הוכחת זכאות. מקור מתגלגל ומוגבל למכסת התוכנית.',
        applicationCheck: {
          status: 'unverified',
          checkedAt: at,
          note: 'תוצאה מספק החיפוש; מסלול ההגשה והזמינות באתר המקור לא אומתו.',
        },
      },
    };
    enrichJob(job);
    if (
      typeof row['job_expiration_datetime_utc'] === 'string' &&
      Number.isFinite(Date.parse(row['job_expiration_datetime_utc']))
    )
      job.facts!.deadline = {
        value: new Date(row['job_expiration_datetime_utc']).toISOString(),
        provenance: 'supplied',
        url,
        observedAt: at,
        quote: 'JSearch job_expiration_datetime_utc',
      };
    return [job];
  });
}
/** Shared daily cache; six one-page queries/day, hard monthly cap180. No account/CV is sent. */
export async function ingestJsearch(
  db: CareerDb,
  key: string | undefined,
  now = Date.now(),
): Promise<void> {
  if (!key) return;
  const month = 'active';
  await db.run(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','jsearch-budget',?,'{\"used\":0}',?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at WHERE niva_documents.expires_at<=?",
    month,
    now + 31 * DAY,
    now,
  );
  await Promise.all(
    JSEARCH_SOURCES.map(async (source) => {
      await db.run('INSERT INTO niva_sources(id) VALUES(?) ON CONFLICT(id) DO NOTHING', source.id);
      const lease = await db.all(
        'UPDATE niva_sources SET lease_until=? WHERE id=? AND next_at<=? AND lease_until<=? RETURNING id',
        now + 120000,
        source.id,
        now,
        now,
      );
      if (!lease.length) return;
      await recordSourceAttempt(db, source.id, now);
      try {
        const pages = await Promise.all(
          markets.map(async (market) => {
            const allowed = await db.all(
              "UPDATE niva_documents SET data=json_set(data,'$.used',json_extract(data,'$.used')+1) WHERE owner='system' AND kind='jsearch-budget' AND id=? AND json_extract(data,'$.used')<180 RETURNING id",
              month,
            );
            if (!allowed.length) throw Error('MONTHLY_LIMIT');
            const url = new URL(source.url);
            url.searchParams.set('query', `jobs in ${market.location} via ${source.board}`);
            url.searchParams.set('country', market.country);
            url.searchParams.set('language', 'en');
            url.searchParams.set('num_pages', '1');
            const r = await fetch(url, {
              headers: { 'x-api-key': key, Accept: 'application/json' },
              redirect: 'manual',
              signal: AbortSignal.timeout(25000),
            });
            if (!r.ok) {
              await r.body?.cancel();
              throw Error(r.status === 429 ? 'RATE_LIMITED' : 'SOURCE_UNAVAILABLE');
            }
            return normalizeJsearch(
              await boundedPayload(r),
              source.board,
              new Date(now).toISOString(),
            );
          }),
        );
        const unique = [...new Map(pages.flat().map((j) => [j.id, j])).values()];
        const statements: { sql: string; args: (string | number | null)[] }[] = [];
        for (const job of unique)
          statements.push({
            sql: "INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET canonical=excluded.canonical,company=excluded.company,title=excluded.title,district=excluded.district,category=excluded.category,style=excluded.style,search=excluded.search,active=1,version=excluded.version,data=json_set(excluded.data,'$.source.firstSeenAt',json_extract(niva_jobs.data,'$.source.firstSeenAt'))",
            args: [
              job.id,
              source.id,
              canonicalJobUrl(job.source!.applicationUrl),
              job.company.toLowerCase(),
              job.title.toLowerCase(),
              job.district,
              job.category,
              job.workStyle,
              `${job.title} ${job.company}`.toLowerCase(),
              job.source!.version!,
              JSON.stringify(job),
            ],
          });
        statements.push({
          sql: "UPDATE niva_jobs SET active=0,data=json_set(data,'$.source.active',json('false'),'$.source.availability','unknown','$.source.version',version||'-stale'),version=version||'-stale' WHERE source_id=? AND active=1 AND json_extract(data,'$.source.fetchedAt')<?",
          args: [source.id, new Date(now - 7 * DAY).toISOString()],
        });
        statements.push({
          sql: 'INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES(\'system\',\'source-window\',?,\'{"partial":true,"policy":"daily-six-pages"}\',?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at',
          args: [source.id, now + 2 * DAY],
        });
        statements.push({
          sql: 'UPDATE niva_sources SET checked_at=?,next_at=?,failures=0,error=NULL,lease_until=0 WHERE id=?',
          args: [new Date(now).toISOString(), now + DAY, source.id],
        });
        await db.batch(statements);
      } catch (e) {
        await db.run(
          'UPDATE niva_sources SET failures=failures+1,error=?,next_at=?,lease_until=0 WHERE id=?',
          e instanceof Error && ['MONTHLY_LIMIT', 'RATE_LIMITED'].includes(e.message)
            ? e.message
            : 'SOURCE_UNAVAILABLE',
          now + DAY,
          source.id,
        );
      }
    }),
  );
}

async function boundedPayload(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error('INVALID_FEED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2000000) throw Error('INVALID_FEED');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    await reader.cancel().catch(() => {});
  }
}
