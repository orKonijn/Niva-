CREATE TABLE niva_sources (id TEXT PRIMARY KEY, checked_at TEXT, next_at INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, error TEXT, lease_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE niva_jobs (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, canonical TEXT NOT NULL, company TEXT NOT NULL, title TEXT NOT NULL, district TEXT NOT NULL, category TEXT NOT NULL, style TEXT NOT NULL, search TEXT NOT NULL, active INTEGER NOT NULL, version TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX niva_jobs_filters ON niva_jobs(active,category,district,style,id);
CREATE INDEX niva_jobs_source ON niva_jobs(source_id,active);
CREATE INDEX niva_jobs_canonical ON niva_jobs(canonical);
CREATE TABLE niva_documents (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(owner,kind,id));
CREATE INDEX niva_documents_expiry ON niva_documents(expires_at);
CREATE TABLE niva_career_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window INTEGER NOT NULL);
