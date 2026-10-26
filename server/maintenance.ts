import type { CareerDb } from './career-db';
import { ingest } from './discovery';
export const CLEANUP_BOUND_MS = 3600000;
/** Retention has its own watchdog and runs even when source updates fail. */
export async function cleanup(db: CareerDb, now = Date.now(), trigger = 'manual') {
  await db.run(
    "INSERT INTO niva_maintenance(id,started_at,trigger) VALUES('retention',?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,trigger=excluded.trigger",
    now,
    trigger,
  );
  try {
    const count = (
      await db.all<{ n: number }>(
        'SELECT count(*) AS n FROM niva_documents WHERE expires_at<=?',
        now,
      )
    )[0].n;
    await db.batch([
      { sql: 'DELETE FROM niva_documents WHERE expires_at<=?', args: [now] },
      {
        sql: "UPDATE niva_career_owners SET active_resume_id=NULL WHERE active_resume_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM niva_documents d WHERE d.owner=niva_career_owners.owner AND d.id=active_resume_id AND d.kind='resume' AND d.epoch=niva_career_owners.epoch AND d.expires_at>? AND json_extract(d.data,'$.confirmed')=1)",
        args: [now],
      },
      { sql: 'DELETE FROM niva_career_leases WHERE expires_at<=?', args: [now] },
      {
        sql: "DELETE FROM niva_career_limits WHERE key LIKE 'apply:visitor:%' AND window<?",
        args: [Math.floor(now / 60000) - 2],
      },
      {
        sql: "UPDATE niva_maintenance SET succeeded_at=?,error=NULL,removed=?,trigger=? WHERE id='retention'",
        args: [now, count, trigger],
      },
    ]);
  } catch {
    await db.run("UPDATE niva_maintenance SET error='CLEANUP_FAILED' WHERE id='retention'");
    throw new Error('CLEANUP_FAILED');
  }
}
export async function runMaintenance(
  db: CareerDb,
  { sources = true, trigger = 'manual', now = Date.now() } = {},
) {
  if (trigger === 'scheduled')
    await db.run(
      "INSERT INTO niva_maintenance(id,started_at,trigger) VALUES('scheduler',?,'scheduled') ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at",
      now,
    );
  await cleanup(db, now, trigger);
  if (trigger === 'scheduled')
    await db.run("UPDATE niva_maintenance SET succeeded_at=?,error=NULL WHERE id='scheduler'", now);
  if (!sources) return;
  await db.run(
    "INSERT INTO niva_maintenance(id,started_at,trigger) VALUES('ingestion',?,?) ON CONFLICT(id) DO UPDATE SET started_at=excluded.started_at,trigger=excluded.trigger",
    now,
    trigger,
  );
  try {
    await ingest(db, now);
    const failures = await db.all('SELECT id FROM niva_sources WHERE error IS NOT NULL');
    await db.run(
      "UPDATE niva_maintenance SET succeeded_at=?,error=?,trigger=? WHERE id='ingestion'",
      now,
      failures.length ? 'SOURCE_FAILURE' : null,
      trigger,
    );
  } catch {
    await db.run("UPDATE niva_maintenance SET error='INGESTION_FAILED' WHERE id='ingestion'");
    throw new Error('INGESTION_FAILED');
  }
}
export async function maintenanceHealth(
  db: CareerDb,
  now = Date.now(),
  operator?: { NIVA_OPERATOR_ID?: string; NIVA_ALERT_URL?: string },
) {
  const rows = await db.all<{
    id: string;
    started_at: number | null;
    succeeded_at: number | null;
    error: string | null;
    trigger: string;
    removed: number;
  }>('SELECT * FROM niva_maintenance');
  const ingestion = rows.find((r) => r.id === 'ingestion');
  const retention = rows.find((r) => r.id === 'retention');
  const scheduled = rows.filter((r) => r.id === 'scheduler' && r.succeeded_at);
  return {
    rows,
    alerts: {
      configured: !!(operator?.NIVA_OPERATOR_ID && operator?.NIVA_ALERT_URL),
      operator: operator?.NIVA_OPERATOR_ID ?? null,
      deliveryVerified: false,
      independentWatchdogRequired: true,
    },
    scheduledObserved: scheduled.length > 0,
    ingestionOverdue: !ingestion?.succeeded_at || now - ingestion.succeeded_at > 20 * 60000,
    ingestionBoundMinutes: 20,
    schedulerOverdue:
      !scheduled[0]?.succeeded_at || now - scheduled[0].succeeded_at > CLEANUP_BOUND_MS,
    cleanupFailed: !!retention?.error,
    cleanupLagMinutes: retention?.succeeded_at
      ? Math.max(0, Math.floor((now - retention.succeeded_at) / 60000))
      : null,
    cleanupOverdue:
      !!retention?.error ||
      !retention?.succeeded_at ||
      now - retention.succeeded_at > CLEANUP_BOUND_MS,
    cleanupBoundMinutes: CLEANUP_BOUND_MS / 60000,
  };
}
