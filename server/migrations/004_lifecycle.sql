ALTER TABLE niva_documents ADD COLUMN epoch TEXT NOT NULL DEFAULT '0';
CREATE TABLE niva_career_owners (owner TEXT PRIMARY KEY NOT NULL, epoch TEXT NOT NULL DEFAULT '0', active_resume_id TEXT);
CREATE TABLE niva_career_leases (owner TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, epoch TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE niva_maintenance (id TEXT PRIMARY KEY NOT NULL, started_at INTEGER, succeeded_at INTEGER, error TEXT, removed INTEGER NOT NULL DEFAULT 0, trigger TEXT NOT NULL);
