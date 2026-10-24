import { lifecycle } from './lifecycle';
import type { CareerDb } from './career-db';
export const RETENTION_DAYS = 30;
export const MAX_RESUME_VERSIONS = 20;
export class CareerError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function listRecords<T>(db: CareerDb, owner: string, kind: string): Promise<T[]> {
  await lifecycle(db, owner);
  const rows = await db.all<{ data: string; id: string; active_resume_id: string | null }>(
    `SELECT d.data,d.id,o.active_resume_id FROM niva_documents d JOIN niva_career_owners o ON o.owner=d.owner AND o.epoch=d.epoch WHERE d.owner=? AND d.kind=? AND d.expires_at>? ORDER BY d.id`,
    owner,
    kind,
    Date.now(),
  );
  return rows.map((row) => {
    const data = JSON.parse(row.data);
    return (
      kind === 'resume'
        ? { ...data, active: row.id === row.active_resume_id && data.confirmed === true }
        : data
    ) as T;
  });
}
export async function readRecord<T>(
  db: CareerDb,
  owner: string,
  kind: string,
  id: string,
): Promise<T> {
  const record = (await listRecords<T & { id: string }>(db, owner, kind)).find(
    (row) => row.id === id,
  );
  if (!record) throw new CareerError(404, 'NOT_FOUND');
  return record;
}
export async function assertLifecycle(db: CareerDb, owner: string, epoch: string) {
  if (
    !(await db.all('SELECT owner FROM niva_career_owners WHERE owner=? AND epoch=?', owner, epoch))
      .length
  )
    throw new CareerError(409, 'LIFECYCLE_CHANGED');
}
export async function putRecord(
  db: CareerDb,
  owner: string,
  kind: string,
  id: string,
  data: unknown,
  create = false,
  expectedEpoch?: string,
) {
  const epoch = expectedEpoch ?? (await lifecycle(db, owner));
  const payload = JSON.stringify(kind === 'resume' ? { ...(data as object), active: false } : data);
  const rows = create
    ? await db.all(
        `INSERT INTO niva_documents(owner,kind,id,data,expires_at,epoch) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM niva_career_owners WHERE owner=? AND epoch=?) AND (? <> 'resume' OR (SELECT count(*) FROM niva_documents WHERE owner=? AND kind='resume' AND epoch=? AND expires_at>?) < ?) ON CONFLICT(owner,kind,id) DO NOTHING RETURNING id`,
        owner,
        kind,
        id,
        payload,
        Date.now() + RETENTION_DAYS * 86400000,
        epoch,
        owner,
        epoch,
        kind,
        owner,
        epoch,
        Date.now(),
        MAX_RESUME_VERSIONS,
      )
    : await db.all(
        `UPDATE niva_documents SET data=? WHERE owner=? AND kind=? AND id=? AND expires_at>? AND epoch=? AND EXISTS(SELECT 1 FROM niva_career_owners WHERE owner=? AND epoch=?) RETURNING id`,
        payload,
        owner,
        kind,
        id,
        Date.now(),
        epoch,
        owner,
        epoch,
      );
  if (!rows.length) {
    await assertLifecycle(db, owner, epoch);
    if (create && kind === 'resume') {
      const count = (
        await db.all<{ n: number }>(
          "SELECT count(*) n FROM niva_documents WHERE owner=? AND kind='resume' AND epoch=? AND expires_at>?",
          owner,
          epoch,
          Date.now(),
        )
      )[0].n;
      if (count >= MAX_RESUME_VERSIONS) throw new CareerError(409, 'VERSION_LIMIT');
    }
    if (kind !== 'score') throw new CareerError(409, 'RECORD_CHANGED');
  }
}
export async function quota(db: CareerDb, key: string, maximum: number, windowMs = 86400000) {
  const window = Math.floor(Date.now() / windowMs);
  const result = await db.all<{ count: number }>(
    'INSERT INTO niva_career_limits(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count',
    key,
    window,
  );
  if ((result[0]?.count ?? maximum + 1) > maximum) throw new CareerError(429, 'RATE_LIMITED');
}
