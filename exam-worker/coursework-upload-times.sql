CREATE TABLE IF NOT EXISTS coursework_upload_times (
  lesson_id TEXT PRIMARY KEY REFERENCES course_lessons(id) ON DELETE CASCADE,
  uploaded_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS coursework_capture_initial_upload
AFTER INSERT ON course_lessons
WHEN json_array_length(NEW.questions_json) > 0
BEGIN
  INSERT INTO coursework_upload_times (lesson_id, uploaded_at)
  VALUES (NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(lesson_id) DO NOTHING;
END;

CREATE TRIGGER IF NOT EXISTS coursework_capture_upload_to_draft
AFTER UPDATE OF questions_json ON course_lessons
WHEN json_array_length(OLD.questions_json) = 0 AND json_array_length(NEW.questions_json) > 0
BEGIN
  INSERT INTO coursework_upload_times (lesson_id, uploaded_at)
  VALUES (NEW.id, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(lesson_id) DO NOTHING;
END;
