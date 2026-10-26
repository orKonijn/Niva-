import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { migrateDatabase } from '../server/app';
import { auditJobs } from '../tests/audit40-data';
import { SOURCES } from '../src/app/core/source-registry';
import { canonicalJobUrl } from '../src/app/core/job-identity';
const root = resolve('.test-data/staging42'),
  origin = 'http://127.0.0.1:4310';
if (process.argv[2] !== '--prepare') throw Error('Use --prepare for disposable local data only.');
mkdirSync(root, { recursive: true, mode: 0o700 });
for (const extension of ['pdf', 'docx'])
  copyFileSync(
    resolve('tests/fixtures/staging42/synthetic-resume.' + extension),
    resolve(root, 'synthetic-resume.' + extension),
  );
const database = new DatabaseSync(resolve(root, 'niva.sqlite'));
await migrateDatabase(database, {} as any);
const at = new Date().toISOString();
for (const source of SOURCES)
  database
    .prepare(
      'INSERT INTO niva_sources(id,checked_at,next_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',
    )
    .run(source.id, at, Date.now() + 86400000);
database.prepare("DELETE FROM niva_sources WHERE id LIKE 'jsearch-%'").run();
for (const job of auditJobs()) {
  // Pinned real public source content; verification age kept truthful. No provider calls in preparation.
  const source = job.source!;
  source.applicationCheck = {
    status: 'reachable',
    checkedAt: at,
    note: 'Local fixture handoff only; not a fresh employer verification',
  };
  database
    .prepare(
      'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO NOTHING',
    )
    .run(
      job.id,
      source.sourceId!,
      canonicalJobUrl(source.applicationUrl),
      job.company.toLowerCase(),
      job.title.toLowerCase(),
      job.district,
      job.category,
      job.workStyle,
      `${job.title} ${job.company}`.toLowerCase(),
      source.version ?? 'staging-fixture-v1',
      JSON.stringify(job),
    );
}
database.close();
const configPath = resolve(root, 'private-test-access.json');
if (!existsSync(configPath))
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        origin,
        accounts: ['alice', 'bob'].map((alias) => ({
          alias,
          email: `${alias}.staging42@example.test`,
          password: randomBytes(24).toString('base64url'),
        })),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
writeFileSync(
  resolve(root, 'environment.json'),
  JSON.stringify(
    {
      origin,
      dataDirectory: root,
      emailDelivery: 'local-only-outbox',
      alertsEnabled: false,
      providerCallsEnabled: false,
      hosted: false,
      operatorAssigned: false,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    prepared: true,
    origin,
    dataDirectory: root,
    accounts:
      'Prepared private account invitations; create via actual sign-up after starting local server. Credentials never printed.',
    alerts: 'disabled',
    hosting: 'loopback Node/SQLite only; not hosted D1',
  }),
);
