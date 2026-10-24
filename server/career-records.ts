import type { CareerDb } from './career-db';
export const RETENTION_DAYS = 30;
export class CareerError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function listRecords<T>(db: CareerDb, owner: string, kind: string): Promise<T[]> {
  return (
    await db.all<{ data: string }>(
      'SELECT data FROM niva_documents WHERE owner=? AND kind=? AND expires_at>? ORDER BY id',
      owner,
      kind,
      Date.now(),
    )
  ).map((r) => JSON.parse(r.data) as T);
}
export async function readRecord<T>(
  db: CareerDb,
  owner: string,
  kind: string,
  id: string,
): Promise<T> {
  const row = (
    await db.all<{ data: string }>(
      'SELECT data FROM niva_documents WHERE owner=? AND kind=? AND id=? AND expires_at>?',
      owner,
      kind,
      id,
      Date.now(),
    )
  )[0];
  if (!row) throw new CareerError(404, 'NOT_FOUND');
  return JSON.parse(row.data) as T;
}
export async function putRecord(
  db: CareerDb,
  owner: string,
  kind: string,
  id: string,
  data: unknown,
  create = false,
) {
  const sql = create
    ? 'INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES(?,?,?,?,?)' +
      (kind === 'score' ? ' ON CONFLICT(owner,kind,id) DO NOTHING' : '')
    : 'UPDATE niva_documents SET data=? WHERE owner=? AND kind=? AND id=? AND expires_at>?';
  if (create)
    await db.run(
      sql,
      owner,
      kind,
      id,
      JSON.stringify(data),
      Date.now() + RETENTION_DAYS * 86400000,
    );
  else {
    const rows = await db.all(
      sql + ' RETURNING id',
      JSON.stringify(data),
      owner,
      kind,
      id,
      Date.now(),
    );
    if (!rows.length) throw new CareerError(404, 'NOT_FOUND');
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
