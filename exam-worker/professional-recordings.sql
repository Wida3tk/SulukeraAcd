CREATE TABLE IF NOT EXISTS professional_recording_assignments (
 student_key TEXT NOT NULL,unit_id TEXT NOT NULL,session_key TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'optional' CHECK(mode IN ('optional','recorded')),
 approved INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL,PRIMARY KEY(student_key,unit_id,session_key)
);
CREATE TABLE IF NOT EXISTS professional_recording_progress (
 student_key TEXT NOT NULL,video_key TEXT NOT NULL,ranges_json TEXT NOT NULL DEFAULT '[]',watched_seconds REAL NOT NULL DEFAULT 0,
 duration_seconds REAL NOT NULL,last_position REAL NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 0,last_nonce TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,
 PRIMARY KEY(student_key,video_key)
);
CREATE TABLE IF NOT EXISTS professional_recording_runs (
 id TEXT PRIMARY KEY,student_key TEXT NOT NULL,video_key TEXT NOT NULL,unit_id TEXT NOT NULL,session_key TEXT NOT NULL,resource_key TEXT NOT NULL DEFAULT '',
 duration_seconds REAL NOT NULL,expires_at INTEGER NOT NULL,last_sequence INTEGER NOT NULL DEFAULT 0,last_position REAL NOT NULL DEFAULT 0,last_time INTEGER NOT NULL,playing INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_recording_runs_expiry ON professional_recording_runs(expires_at);
