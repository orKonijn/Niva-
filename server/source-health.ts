import type { CareerDb } from './career-db';
export async function recordSourceAttempt(db: CareerDb, id: string, now: number) {
  await db.run(
    "INSERT INTO niva_documents(owner,kind,id,data,expires_at) VALUES('system','source-attempt',?,?,?) ON CONFLICT(owner,kind,id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at",
    id,
    JSON.stringify({ attemptedAt: new Date(now).toISOString() }),
    now + 90 * 86400000,
  );
}
export function sourceFreshness(
  rows: { checked_at: string | null; attempted_at?: string | null }[],
) {
  const valid = (values: (string | null | undefined)[]) =>
    values
      .filter((x): x is string => !!x && Number.isFinite(Date.parse(x)))
      .sort((a, b) => Date.parse(a) - Date.parse(b));
  const successful = valid(rows.map((r) => r.checked_at));
  const attempted = valid(rows.map((r) => r.attempted_at));
  return {
    oldestSuccessfulAt: successful[0] ?? null,
    newestSuccessfulAt: successful.at(-1) ?? null,
    newestAttemptedAt: attempted.at(-1) ?? null,
    neverSucceededCount: rows.length - successful.length,
  };
}
