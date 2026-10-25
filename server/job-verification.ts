import type { CareerDb } from './career-db';
import type { Job } from '../src/app/core/models/job';
import { SOURCES, trustedJobUrl } from './job-sources';
import { boundedJson, versionOf, normalizeLever } from './discovery';
import { normalizeGreenhouse } from './greenhouse-source';
import { canonicalJobUrl } from '../src/app/core/job-identity';
import { enrichJob } from './job-facts';
const TTL = 900000;
/** Provider presence and path reachability are distinct. A generic HTML 200 never establishes publication. */
export async function verifyJob(db: CareerDb, job: Job, now = Date.now()): Promise<Job> {
  const expectedVersion = job.source?.version;
  const source = SOURCES.find((s) => job.id.startsWith(s.id + '-'));
  if (!job.source || !source || !trustedJobUrl(job.id, job.source!.applicationUrl)) return job;
  if (
    job.source!.applicationCheck &&
    now - Date.parse(job.source!.applicationCheck.checkedAt) < TTL
  )
    return enrichJob(job);
  const lease = await db.all(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','job-check',?,'{}',?) ON CONFLICT(owner,kind,id) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<=? RETURNING id",
    job.id,
    now + TTL,
    now,
  );
  if (!lease.length) return enrichJob(job);
  const id = job.id.slice(source.id.length + 1);
  let presence = false;
  try {
    const url =
      source.provider === 'greenhouse'
        ? `https://boards-api.greenhouse.io/v1/boards/${source.board}/jobs/${id}`
        : source.provider === 'lever'
          ? `https://api.lever.co/v0/postings/${source.board}/${id}?mode=json`
          : `https://jobicy.com/api/jobs/status?ids=${id}`;
    // Jobicy status is checked during hourly batches; detail cannot exceed the hourly source policy.
    if (source.provider === 'jobicy')
      presence = job.source!.availability === 'published' && !!job.source!.lastVerifiedAt;
    else {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const data = (await boundedJson(response, 1000000)) as Record<string, unknown>;
        presence = String(data['id']) === id && typeof (data['title'] ?? data['text']) === 'string';
        if (presence) {
          const at = new Date(now).toISOString();
          const next =
            source.provider === 'greenhouse'
              ? normalizeGreenhouse({ jobs: [data] }, source, at, 'global')[0]
              : normalizeLever([data], at, source, 'global')[0];
          if (next?.id === job.id) {
            const previous = job.source;
            job = enrichJob({
              ...next,
              source: {
                ...next.source!,
                firstSeenAt: previous.firstSeenAt ?? null,
                attribution: previous.attribution,
                version: previous.version,
                descriptionFetchedAt: at,
              },
            });
          }
        }
      }
    }
    if (presence) {
      job.source!.lastVerifiedAt = new Date(now).toISOString();
      job.source!.availability = 'published';
    } else job.source!.availability = 'unknown';
  } catch {
    job.source!.availability = 'unknown';
  }
  let status: 'reachable' | 'unverified' | 'unavailable' = 'unverified';
  let note = 'המקור לא אישר זמינות; כשל זמני אינו הוכחת סגירה';
  try {
    const response = await fetch(job.source!.applicationUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok && /text\/html/i.test(response.headers.get('content-type') ?? '')) {
      // Only transport reachability, never form completeness or eligibility.
      status = 'reachable';
      note = 'עמוד המקור נגיש; טופס ההגשה והזכאות לא אושרו';
    } else if (response.status >= 300 && response.status < 400)
      note = 'המקור הפנה לעמוד אחר; מסלול ההגשה דורש בדיקה';
    await response.body?.cancel();
  } catch {
    /* Unknown on timeout or blocked requests. */
  }
  job.source!.applicationCheck = { status, checkedAt: new Date(now).toISOString(), note };
  job.source!.version = versionOf([
    job.title,
    job.description,
    job.facts,
    job.source!.availability,
  ]);
  const updated = await db.all(
    'UPDATE niva_jobs SET canonical=?,company=?,title=?,district=?,category=?,style=?,search=?,data=?,version=? WHERE id=? AND version=? RETURNING id',
    canonicalJobUrl(job.source!.applicationUrl),
    job.company.toLowerCase(),
    job.title.toLowerCase(),
    job.district,
    job.category,
    job.workStyle,
    `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase(),
    JSON.stringify(job),
    job.source!.version,
    job.id,
    expectedVersion ?? '',
  );
  if (!updated.length) {
    const [current] = await db.all<{ data: string; active: number }>(
      'SELECT data,active FROM niva_jobs WHERE id=?',
      job.id,
    );
    if (current) {
      const fresh = JSON.parse(current.data) as Job;
      fresh.source!.active = !!current.active;
      if (!current.active && fresh.source!.availability !== 'unknown')
        fresh.source!.availability = 'closed';
      return enrichJob(fresh);
    }
  }
  return enrichJob(job);
}
export async function reconcilePaths(db: CareerDb, now = Date.now()): Promise<number> {
  const lease = await db.all(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','path-sweep','hourly','{}',?) ON CONFLICT(owner,kind,id) DO UPDATE SET expires_at=excluded.expires_at WHERE expires_at<=? RETURNING id",
    now + 3600000,
    now,
  );
  if (!lease.length) return 0;
  await db.run(
    "DELETE FROM niva_documents WHERE owner='system' AND kind='apply-click' AND expires_at<=?",
    now,
  );
  const jobs = (await catalogForSweep(db))
    .filter(
      (j) =>
        !j.source?.applicationCheck ||
        now - Date.parse(j.source.applicationCheck.checkedAt) >= 86400000,
    )
    .slice(0, 10);
  let index = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (index < jobs.length) await verifyJob(db, jobs[index++], now);
    }),
  );
  return jobs.length;
}
async function catalogForSweep(db: CareerDb): Promise<Job[]> {
  return (
    await db.all<{ data: string }>(
      "SELECT data FROM niva_jobs WHERE active=1 ORDER BY coalesce(json_extract(data,'$.source.applicationCheck.checkedAt'),'') LIMIT 1000",
    )
  ).map((r) => JSON.parse(r.data) as Job);
}
