CREATE TABLE IF NOT EXISTS revenue_periods (
 month TEXT PRIMARY KEY, data_json TEXT NOT NULL, source_hash TEXT NOT NULL,
 imported_by TEXT NOT NULL, imported_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revenue_imports (
 source_hash TEXT PRIMARY KEY, filename TEXT NOT NULL, summary_json TEXT NOT NULL,
 imported_by TEXT NOT NULL, imported_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revenue_config (
 id TEXT PRIMARY KEY, data_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revenue_goal_audit (
 id TEXT PRIMARY KEY, period TEXT NOT NULL, category TEXT NOT NULL,
 previous_json TEXT, next_json TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revenue_snapshots (
 source_hash TEXT NOT NULL, month TEXT NOT NULL, data_json TEXT NOT NULL,
 archived_at TEXT NOT NULL, PRIMARY KEY(source_hash,month)
);
