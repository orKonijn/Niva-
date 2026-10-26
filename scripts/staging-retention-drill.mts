import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { sqliteCareerDb } from '../server/career-db';
import { cleanup, maintenanceHealth, runMaintenance } from '../server/maintenance';
import { listRecords } from '../server/career-records';
import { lifecycle } from '../server/lifecycle';
import { checkWatchdog } from '../server/operator-watchdog';
import assert from 'node:assert/strict';
if (process.argv[2] !== '--local-only') throw Error('Disposable local drill only.');
const root = resolve('.test-data/staging42'),
  path = resolve(root, 'niva.sqlite');
if (path !== resolve('.test-data/staging42/niva.sqlite')) throw Error('UNSAFE_STAGING_PATH');
const sql = new DatabaseSync(path);
const db = sqliteCareerDb(sql),
  probe = 'SYNTHETIC-RETENTION-PROBE';
const epoch = await lifecycle(db, probe);
const cycles: any[] = [];
// Real independent process timers; accelerated local cadence is explicitly not a hosted scheduler test.
for (let i = 0; i < 2; i++) {
  const id = 'expired-probe-' + i,
    expires = Date.now() + 100;
  await db.run(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at,epoch) VALUES(?,'resume',?,?,?,?)",
    probe,
    id,
    JSON.stringify({
      id,
      name: 'Synthetic expiry probe',
      confirmed: true,
      text: 'SYNTHETIC RETENTION DATA ONLY',
    }),
    expires,
    epoch,
  );
  await db.run('UPDATE niva_career_owners SET active_resume_id=? WHERE owner=?', id, probe);
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await listRecords(db, probe, 'resume')).length, 0);
  const countBefore = sql
    .prepare('SELECT count(*) n FROM niva_documents WHERE owner=?')
    .get(probe) as any;
  assert.equal(countBefore.n, 1);
  const started = new Date().toISOString();
  await runMaintenance(db, { sources: false, trigger: 'scheduled' });
  assert.equal(
    (sql.prepare('SELECT count(*) n FROM niva_documents WHERE owner=?').get(probe) as any).n,
    0,
  );
  assert.equal(
    (sql.prepare('SELECT active_resume_id FROM niva_career_owners WHERE owner=?').get(probe) as any)
      .active_resume_id,
    null,
  );
  cycles.push({
    cycle: i + 1,
    started,
    completed: new Date().toISOString(),
    expiredReadDenied: true,
    physicallyRemoved: 1,
    activePointerCleared: true,
  });
}
const backup = resolve(root, 'restore-' + Date.now() + '.sqlite');
assert(!existsSync(backup));
sql.exec("VACUUM INTO '" + backup.replaceAll("'", "''") + "'");
const restored = new DatabaseSync(backup);
const owners = restored
  .prepare("SELECT owner,id FROM niva_documents WHERE kind='resume' AND owner<>?")
  .all(probe) as any[];
assert(new Set(owners.map((r) => r.owner)).size >= 2);
const crossOwner = restored
  .prepare('SELECT count(*) n FROM niva_documents WHERE owner=? AND id=?')
  .get(owners[0].owner, owners.find((r) => r.owner !== owners[0].owner)!.id) as any;
assert.equal(crossOwner.n, 0);
const brokenPointers = restored
  .prepare(
    "SELECT count(*) n FROM niva_career_owners o WHERE active_resume_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM niva_documents d WHERE d.owner=o.owner AND d.id=o.active_resume_id AND d.kind='resume')",
  )
  .get() as any;
assert.equal(brokenPointers.n, 0);
assert.equal(
  (restored.prepare('SELECT count(*) n FROM niva_documents WHERE owner=?').get(probe) as any).n,
  0,
);
restored.close();
let failureRecorded = false;
try {
  await cleanup({
    ...db,
    batch: async () => {
      throw Error('Synthetic local storage failure');
    },
  });
} catch {
  failureRecorded = true;
}
assert(failureRecorded);
const health = await maintenanceHealth(db);
assert(health.cleanupFailed);
const expectedAlert = await checkWatchdog(
  {
    healthUrl: 'http://127.0.0.1:4310/api/maintenance/health',
    secret: 'synthetic-not-runtime-secret-long-enough',
    operator: 'UNASSIGNED-LOCAL-DRILL',
    alertUrl: 'http://127.0.0.1:4311/disabled-alert-capture',
  },
  {},
  Date.now(),
  async (input: any) => {
    if (String(input).includes('/health')) return Response.json(health);
    return Response.json({ delivered: false, reason: 'ALERT_DELIVERY_DISABLED' }, { status: 503 });
  },
);
assert(expectedAlert.reasons.includes('MAINTENANCE_FAILURE'));
assert.equal(expectedAlert.status, 'delivery-failed');
await cleanup(db, Date.now(), 'local-drill-recovery');
sql.close();
const receipt = {
  at: new Date().toISOString(),
  environment:
    'Disposable local Node SQLite; two real timer deliveries at accelerated 1.1-second cadence',
  cycles,
  restore: {
    separateTarget: true,
    sourceRetained: true,
    accountOwners: new Set(owners.map((r) => r.owner)).size,
    crossOwnerLeakCount: crossOwner.n,
    brokenActivePointers: brokenPointers.n,
    expiredProbeRecordsRestored: 0,
  },
  failure: {
    recorded: true,
    detectedByWatchdog: true,
    externalDeliveryEnabled: false,
    actualAlertSent: false,
    transport: 'Injected disabled receiver; no external network request',
  },
  hostedSchedulerVerified: false,
  cloudflareD1Verified: false,
  operator: 'unassigned',
  approvedReceiver: null,
  productionEvidence: false,
};
writeFileSync('.test-data/repair42/retention-receipt.json', JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
