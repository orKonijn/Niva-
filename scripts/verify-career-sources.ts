import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { sqliteCareerDb } from '../server/career-db';
import { ingest, discoveryPage, SOURCES } from '../server/discovery';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync('server/migrations/003_career.sql', 'utf8'));
const db = sqliteCareerDb(sqlite);
await ingest(db);
const page = await discoveryPage(db, 'verification-local-secret', { limit: '50' });
const evidence = {
  verifiedAt: new Date().toISOString(),
  total: page.total,
  health: page.health,
  sources: SOURCES.map((source) => ({
    id: source.id,
    endpoint: source.url,
    cadenceMinutes: source.cadence / 60000,
    jobs: page.jobs.filter((job) => job.source?.sourceId === source.id).length,
    categories: [
      ...new Set(
        page.jobs.filter((job) => job.source?.sourceId === source.id).map((job) => job.category),
      ),
    ],
  })),
};
mkdirSync('docs/verification', { recursive: true });
writeFileSync('docs/verification/career-sources.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
sqlite.close();
if (page.health.some((source) => source.error)) process.exitCode = 1;
