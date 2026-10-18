ALTER TABLE graduation_project_groups ADD COLUMN leader_student_key TEXT;
CREATE TABLE IF NOT EXISTS graduation_project_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  student_key TEXT NOT NULL,
  request_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grad_project_requests ON graduation_project_requests(group_id,status,created_at);
