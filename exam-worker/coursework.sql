CREATE TABLE IF NOT EXISTS course_lessons (
 id TEXT PRIMARY KEY, subject_key TEXT NOT NULL, week INTEGER NOT NULL CHECK(week BETWEEN 1 AND 4),
 title TEXT NOT NULL, opens_at TEXT NOT NULL, closes_at TEXT NOT NULL,
 questions_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
 zoom_url TEXT NOT NULL DEFAULT '', recording_url TEXT NOT NULL DEFAULT '', pdf_url TEXT NOT NULL DEFAULT '',
 duration_minutes REAL NOT NULL DEFAULT 120, updated_at TEXT NOT NULL,
 UNIQUE(subject_key,week)
);
CREATE TABLE IF NOT EXISTS homework_attempts (
 id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, student_key TEXT NOT NULL,
 request_id TEXT NOT NULL, answers_json TEXT NOT NULL, score REAL NOT NULL,
 submitted_at TEXT NOT NULL, UNIQUE(lesson_id,student_key,request_id)
);
CREATE TABLE IF NOT EXISTS course_attendance (
 lesson_id TEXT NOT NULL, student_key TEXT NOT NULL, percent REAL NOT NULL,
 source_hash TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 PRIMARY KEY(lesson_id,student_key)
);
CREATE TABLE IF NOT EXISTS attendance_reflections (
 lesson_id TEXT NOT NULL, student_key TEXT NOT NULL, answers_json TEXT NOT NULL,
 submitted_at TEXT NOT NULL, score REAL, feedback TEXT NOT NULL DEFAULT '', reviewed_by TEXT, reviewed_at TEXT,
 PRIMARY KEY(lesson_id,student_key)
);
CREATE TABLE IF NOT EXISTS coursework_sync (
 lesson_id TEXT NOT NULL, student_key TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', error TEXT,
 updated_at TEXT NOT NULL, PRIMARY KEY(lesson_id,student_key)
);
CREATE INDEX IF NOT EXISTS homework_student_lesson ON homework_attempts(student_key,lesson_id);
CREATE TABLE IF NOT EXISTS homework_templates (
 course_key TEXT NOT NULL, week INTEGER NOT NULL, questions_json TEXT NOT NULL,
 updated_at TEXT NOT NULL, PRIMARY KEY(course_key,week)
);
CREATE TABLE IF NOT EXISTS lesson_assessment (
 lesson_id TEXT PRIMARY KEY, homework_max REAL NOT NULL, attendance_max REAL NOT NULL,
 discussion_max REAL NOT NULL, discussion_prompt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS academic_discussions (
 lesson_id TEXT NOT NULL, student_key TEXT NOT NULL, answer TEXT NOT NULL,
 submitted_at TEXT NOT NULL, score REAL, feedback TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT, reviewed_at TEXT, PRIMARY KEY(lesson_id,student_key)
);
CREATE TABLE IF NOT EXISTS assessment_templates (
 course_key TEXT NOT NULL, week INTEGER NOT NULL, homework_max REAL NOT NULL,
 attendance_max REAL NOT NULL, discussion_max REAL NOT NULL, discussion_prompt TEXT NOT NULL,
 PRIMARY KEY(course_key,week)
);
