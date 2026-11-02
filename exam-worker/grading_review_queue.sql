CREATE TABLE IF NOT EXISTS grading_review_referrals (
 task_key TEXT NOT NULL, source_version TEXT NOT NULL, lesson_id TEXT NOT NULL,
 student_key TEXT NOT NULL, kind TEXT NOT NULL, attempt_id TEXT,
 reason TEXT NOT NULL, lecturer_uid TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, admin_note TEXT NOT NULL DEFAULT '',
 resolved_by TEXT, PRIMARY KEY(task_key,source_version)
);
