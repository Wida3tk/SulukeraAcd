-- Monthly, read-only metadata audit. Jobs are explicitly queued by an operator.
CREATE TABLE IF NOT EXISTS productivity_audit_jobs (
 id TEXT PRIMARY KEY,month TEXT NOT NULL,host TEXT NOT NULL,
 files_json TEXT NOT NULL DEFAULT '[]',state TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,lock_until INTEGER NOT NULL DEFAULT 0,
 result_json TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
);
