import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const pilotStates = sqliteTable('niva_pilot_states', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull(),
  data: text('data').notNull(),
  importedAt: text('imported_at'),
  updatedAt: text('updated_at').notNull(),
});
export const pilotLimits = sqliteTable('niva_pilot_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  window: integer('window').notNull(),
});
export const pilotFeed = sqliteTable('niva_pilot_feed', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});
export const pilotJobs = sqliteTable('niva_pilot_jobs', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  active: integer('active').notNull(),
});
