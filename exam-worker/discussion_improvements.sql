CREATE TABLE IF NOT EXISTS academic_discussion_attempts (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, student_key TEXT NOT NULL,
 answer TEXT NOT NULL, submitted_at TEXT NOT NULL, score REAL,
 feedback TEXT NOT NULL DEFAULT '', reviewed_by TEXT, reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS discussion_attempt_history ON academic_discussion_attempts(lesson_id,student_key,submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS discussion_one_pending ON academic_discussion_attempts(lesson_id,student_key) WHERE reviewed_at IS NULL;
