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

CREATE TABLE IF NOT EXISTS evaluation_publications (
  exam_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft',
  show_comments INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT,
  approved_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graduation_projects (
  id TEXT PRIMARY KEY,
  batch TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  title TEXT NOT NULL,
  required_semesters INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  topics_json TEXT NOT NULL DEFAULT '[]',
  general_meetings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(batch, plan_type)
);

CREATE TABLE IF NOT EXISTS graduation_project_students (
  project_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  eligible INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL,
  PRIMARY KEY (project_id, student_key)
);

CREATE TABLE IF NOT EXISTS graduation_project_groups (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  supervisor_name TEXT NOT NULL DEFAULT '',
  meeting_at TEXT,
  meeting_link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graduation_project_group_members (
  group_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  PRIMARY KEY (group_id, student_key)
);

CREATE TABLE IF NOT EXISTS graduation_project_submissions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  kv_key TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS graduation_project_grades (
  group_id TEXT PRIMARY KEY,
  content_score REAL NOT NULL DEFAULT 0,
  methodology_score REAL NOT NULL DEFAULT 0,
  output_score REAL NOT NULL DEFAULT 0,
  presentation_score REAL NOT NULL DEFAULT 0,
  total_score REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  graded_by TEXT NOT NULL,
  graded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_grad_project_students ON graduation_project_students(student_key, project_id);
CREATE INDEX IF NOT EXISTS idx_grad_project_groups ON graduation_project_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_grad_project_members ON graduation_project_group_members(student_key, group_id);
