import { createHash } from 'node:crypto';
import type { CareerDb } from './career-db';
import type { Job } from '../src/app/core/models/job';
import { enrichJob } from './job-facts';
import { FACT_VERSION } from './source-evidence';
/** Upgrade existing public cache in bounded pages, without provider calls or
 * private-record access. CAS preserves a concurrent ingestion's newer record. */
export async function reindexFacts(db: CareerDb) {
  let after = '';
  for (;;) {
    const rows = await db.all<{ id: string; data: string; version: string; active: number }>(
      "SELECT id,data,version,active FROM niva_jobs WHERE id>? AND coalesce(json_extract(data,'$.facts.extractionVersion'),'')<>? ORDER BY id LIMIT 24",
      after,
      FACT_VERSION,
    );
    if (!rows.length) return;
    const operations = rows.map((row) => {
      const job = enrichJob(JSON.parse(row.data) as Job);
      job.source!.active = !!row.active;
      const version = createHash('sha256')
        .update(JSON.stringify([row.version, FACT_VERSION, job.workStyle, job.facts]))
        .digest('hex')
        .slice(0, 24);
      job.source!.version = version;
      return {
        sql: 'UPDATE niva_jobs SET style=?,version=?,data=? WHERE id=? AND version=?',
        args: [job.workStyle, version, JSON.stringify(job), row.id, row.version],
      };
    });
    await db.batch(operations);
    after = rows.at(-1)!.id;
  }
}
