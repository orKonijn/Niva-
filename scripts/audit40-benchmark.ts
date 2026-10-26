import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { sqliteCareerDb } from '../server/career-db';
import { discoveryPage } from '../server/discovery';
import { auditJobs } from '../tests/audit40-data';
const samples = auditJobs();
const output = [];
for (const size of [100, 1000, 5000]) {
  const sql = new DatabaseSync(':memory:');
  for (const f of ['003_career', '004_lifecycle', '005_career_erasure'])
    sql.exec(readFileSync(`server/migrations/${f}.sql`, 'utf8'));
  const insert = sql.prepare(
    'INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)',
  );
  sql.exec('BEGIN');
  for (let i = 0; i < size; i++) {
    const j = structuredClone(samples[i % samples.length]);
    j.id = 'greenhouse-canopycare-' + (9000000000 + i);
    j.title = 'Synthetic benchmark ' + j.title;
    j.source!.sourceId = 'greenhouse-canopycare';
    j.source!.applicationUrl =
      'https://job-boards.greenhouse.io/canopycare/jobs/' + (9000000000 + i);
    j.source!.version = 'synthetic';
    insert.run(
      j.id,
      'greenhouse-canopycare',
      j.source!.applicationUrl,
      'synthetic',
      j.title,
      j.district,
      j.category,
      j.workStyle,
      'synthetic',
      j.source!.version,
      JSON.stringify(j),
    );
  }
  sql.exec('COMMIT');
  globalThis.gc?.();
  const db = sqliteCareerDb(sql),
    base = process.memoryUsage().heapUsed;
  let peak = base,
    rows = 0,
    bytes = 0;
  const all = db.all.bind(db);
  db.all = async (...args) => {
    const r = await all(...args);
    rows += r.length;
    bytes += Buffer.byteLength(JSON.stringify(r));
    peak = Math.max(peak, process.memoryUsage().heapUsed);
    return r;
  };
  const start = performance.now();
  const page = await discoveryPage(db, 'synthetic', { scope: 'all', limit: '50' });
  peak = Math.max(peak, process.memoryUsage().heapUsed);
  output.push({
    size,
    total: page.total,
    latencyMs: performance.now() - start,
    rowsRead: rows,
    serializedBytes: bytes,
    baselineHeap: base,
    sampledMaxHeap: peak,
    heapDelta: peak - base,
  });
  sql.close();
}
writeFileSync('.test-data/audit40/benchmark.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output));
