import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { CareerDb } from './career-db';
export const ensureOwnerSql = `INSERT INTO niva_career_owners(owner,epoch,active_resume_id)
 SELECT ?,'0',(SELECT id FROM niva_documents WHERE owner=? AND kind='resume' AND expires_at>?
 AND json_extract(data,'$.active')=1 AND json_extract(data,'$.confirmed')=1 ORDER BY json_extract(data,'$.createdAt') DESC,id LIMIT 1)
 ON CONFLICT(owner) DO NOTHING`;
export async function lifecycle(db: CareerDb, owner: string): Promise<string> {
  await db.run(ensureOwnerSql, owner, owner, Date.now());
  return (
    await db.all<{ epoch: string }>('SELECT epoch FROM niva_career_owners WHERE owner=?', owner)
  )[0].epoch;
}
/** A unique epoch makes every statement in a deletion batch conditional on this exact CAS. */
export function deletionRows(owner: string, epoch: string, id?: string) {
  const next = randomUUID();
  const rows = [
    {
      sql: 'UPDATE niva_career_owners SET epoch=?,active_resume_id=CASE WHEN active_resume_id=? OR ? IS NULL THEN NULL ELSE active_resume_id END WHERE owner=? AND epoch=?',
      args: [next, id ?? null, id ?? null, owner, epoch] as (string | number | null)[],
    },
  ];
  if (id) {
    rows.push({
      sql: "DELETE FROM niva_documents WHERE owner=? AND (kind IN ('chat','score') OR (kind='resume' AND id=?)) AND EXISTS(SELECT 1 FROM niva_career_owners WHERE owner=? AND epoch=?)",
      args: [owner, id, owner, next],
    });
    rows.push({
      sql: 'UPDATE niva_documents SET epoch=? WHERE owner=? AND EXISTS(SELECT 1 FROM niva_career_owners WHERE owner=? AND epoch=?)',
      args: [next, owner, owner, next],
    });
  } else
    rows.push({
      sql: 'DELETE FROM niva_documents WHERE owner=? AND EXISTS(SELECT 1 FROM niva_career_owners WHERE owner=? AND epoch=?)',
      args: [owner, owner, next],
    });
  // Leases deliberately survive data deletion until their operation releases/expires.
  return { next, rows };
}
export function deleteCareerSync(db: DatabaseSync, owner: string) {
  db.prepare(ensureOwnerSql).run(owner, owner, Date.now());
  const epoch = String(
    db.prepare('SELECT epoch FROM niva_career_owners WHERE owner=?').get(owner)!['epoch'],
  );
  for (const row of deletionRows(owner, epoch).rows) db.prepare(row.sql).run(...row.args);
}
