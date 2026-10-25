import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
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
export const sources = sqliteTable('niva_sources', {
  id: text('id').primaryKey(),
  checkedAt: text('checked_at'),
  nextAt: integer('next_at').notNull().default(0),
  failures: integer('failures').notNull().default(0),
  error: text('error'),
  leaseUntil: integer('lease_until').notNull().default(0),
});
export const jobs = sqliteTable(
  'niva_jobs',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    canonical: text('canonical').notNull(),
    company: text('company').notNull(),
    title: text('title').notNull(),
    district: text('district').notNull(),
    category: text('category').notNull(),
    style: text('style').notNull(),
    search: text('search').notNull(),
    active: integer('active').notNull(),
    version: text('version').notNull(),
    data: text('data').notNull(),
  },
  (table) => [
    index('niva_jobs_filters').on(
      table.active,
      table.category,
      table.district,
      table.style,
      table.id,
    ),
    index('niva_jobs_source').on(table.sourceId, table.active),
    index('niva_jobs_canonical').on(table.canonical),
  ],
);
export const documents = sqliteTable(
  'niva_documents',
  {
    owner: text('owner').notNull(),
    kind: text('kind').notNull(),
    id: text('id').notNull(),
    data: text('data').notNull(),
    expiresAt: integer('expires_at').notNull(),
    epoch: text('epoch').notNull().default('0'),
  },
  (table) => [
    primaryKey({ columns: [table.owner, table.kind, table.id] }),
    index('niva_documents_expiry').on(table.expiresAt),
  ],
);
export const careerLimits = sqliteTable('niva_career_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  window: integer('window').notNull(),
});

export const careerOwners = sqliteTable('niva_career_owners', {
  owner: text('owner').primaryKey(),
  epoch: text('epoch').notNull().default('0'),
  activeResumeId: text('active_resume_id'),
  erasure: text('erasure').notNull().default('0'),
});
export const careerLeases = sqliteTable('niva_career_leases', {
  owner: text('owner').primaryKey(),
  token: text('token').notNull(),
  epoch: text('epoch').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const maintenance = sqliteTable('niva_maintenance', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at'),
  succeededAt: integer('succeeded_at'),
  error: text('error'),
  removed: integer('removed').notNull().default(0),
  trigger: text('trigger').notNull(),
});

// Optional social-provider authentication; separate IDs from Sites identities.
export const oauthUser = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified').notNull(),
  image: text('image'),
  createdAt: integer('createdAt').notNull(),
  updatedAt: integer('updatedAt').notNull(),
});
export const oauthSession = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt').notNull(),
    updatedAt: integer('updatedAt').notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => oauthUser.id, { onDelete: 'cascade' }),
  },
  (t) => [index('niva_session_owner').on(t.userId)],
);
export const oauthAccount = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => oauthUser.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt'),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt').notNull(),
    updatedAt: integer('updatedAt').notNull(),
  },
  (t) => [
    uniqueIndex('niva_provider_account_unique').on(t.providerId, t.accountId),
    index('niva_account_owner').on(t.userId),
  ],
);
export const oauthVerification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt').notNull(),
    createdAt: integer('createdAt').notNull(),
    updatedAt: integer('updatedAt').notNull(),
  },
  (t) => [index('niva_verification_identifier').on(t.identifier)],
);
export const oauthRateLimit = sqliteTable('rateLimit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('lastRequest').notNull(),
});
