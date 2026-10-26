import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { sqliteCareerDb } from '../server/career-db.ts';
import { catalogJobs, catalogJob } from '../server/discovery.ts';
mkdirSync('.test-data/review36', { recursive: true });
const base = JSON.parse(readFileSync('tests/fixtures/jsearch-public-20261025.json', 'utf8'))
  .jobs[0];
const results = [];
for (const size of [100, 1000, 5000]) {
  const sql = new DatabaseSync(':memory:');
  for (const m of ['003_career', '004_lifecycle', '005_career_erasure'])
    sql.exec(readFileSync(`server/migrations/${m}.sql`, 'utf8'));
  const insert = sql.prepare(
    'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
  );
  sql.exec('BEGIN');
  for (let i = 0; i < size; i++) {
    const j = {
      ...base,
      id: `greenhouse-canopycare-${i}`,
      description: 'Synthetic benchmark description '.repeat(400),
    };
    insert.run(
      j.id,
      'greenhouse-canopycare',
      `https://job-boards.greenhouse.io/canopycare/jobs/${i}`,
      'synthetic',
      'synthetic',
      'unknown',
      'other',
      'unknown',
      'synthetic',
      'v1',
      JSON.stringify(j),
    );
  }
  sql.exec('COMMIT');
  const db = sqliteCareerDb(sql);
  let bytes = 0,
    rows = 0;
  const all = db.all.bind(db);
  db.all = async (...args) => {
    const r = await all(...args);
    bytes += Buffer.byteLength(JSON.stringify(r), 'utf8');
    rows += r.length;
    return r;
  };
  for (const id of [`greenhouse-canopycare-${size - 1}`, 'missing']) {
    bytes = 0;
    rows = 0;
    const heap = process.memoryUsage().heapUsed,
      t = performance.now();
    const j =
      process.env['BENCHMARK_MODE'] === 'after'
        ? await catalogJob(db, id)
        : (await catalogJobs(db)).find((j) => j.id === id);
    results.push({
      size,
      lookup: id === 'missing' ? 'missing' : 'existing',
      found: !!j,
      rowsRead: rows,
      bytesRead: bytes,
      heapDeltaBytes: process.memoryUsage().heapUsed - heap,
      latencyMs: performance.now() - t,
    });
  }
  sql.close();
}
writeFileSync(
  `.test-data/review36/benchmark-${process.env['BENCHMARK_MODE'] === 'after' ? 'after' : 'before'}-utf8.json`,
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
