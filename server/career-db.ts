import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
export interface CareerDb {
  all<T>(sql: string, ...args: (string | number | null)[]): Promise<T[]>;
  run(sql: string, ...args: (string | number | null)[]): Promise<void>;
  batch(rows: { sql: string; args: (string | number | null)[] }[]): Promise<void>;
}
export function sqliteCareerDb(db: DatabaseSync): CareerDb {
  return {
    async all<T>(sql: string, ...args: SQLInputValue[]) {
      return db.prepare(sql).all(...args) as T[];
    },
    async run(sql, ...args) {
      db.prepare(sql).run(...args);
    },
    async batch(rows) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const row of rows) db.prepare(row.sql).run(...row.args);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
export function d1CareerDb(db: D1Database): CareerDb {
  return {
    async all<T>(sql: string, ...args: (string | number | null)[]) {
      return (
        await db
          .prepare(sql)
          .bind(...args)
          .all<T>()
      ).results;
    },
    async run(sql, ...args) {
      await db
        .prepare(sql)
        .bind(...args)
        .run();
    },
    async batch(rows) {
      if (rows.length) await db.batch(rows.map((r) => db.prepare(r.sql).bind(...r.args)));
    },
  };
}
