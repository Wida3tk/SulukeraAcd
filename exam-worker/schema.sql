CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  schedule_key TEXT UNIQUE NOT NULL,
  batch TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  points REAL NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id, position);

CREATE TABLE IF NOT EXISTS exam_exceptions (
  exam_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  opens_at TEXT,
  closes_at TEXT,
  duration_minutes INTEGER,
  extra_attempts INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (exam_id, student_key)
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  score REAL,
  wrong_count INTEGER,
  answers_json TEXT,
  UNIQUE(exam_id, student_key, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_key, exam_id);

CREATE TABLE IF NOT EXISTS evaluations (
  exam_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  responses_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (exam_id, student_key)
);
