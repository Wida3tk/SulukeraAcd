CREATE INDEX IF NOT EXISTS coursework_sync_pending ON coursework_sync(state,updated_at);
CREATE TRIGGER IF NOT EXISTS homework_sync_enqueue AFTER INSERT ON homework_attempts
BEGIN
 INSERT INTO coursework_sync VALUES(NEW.lesson_id,NEW.student_key,'pending',NULL,NEW.submitted_at)
 ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=NULL,updated_at=excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS attendance_sync_enqueue_insert AFTER INSERT ON course_attendance
BEGIN
 INSERT INTO coursework_sync VALUES(NEW.lesson_id,NEW.student_key,'pending',NULL,NEW.approved_at)
 ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=NULL,updated_at=excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS attendance_sync_enqueue_update AFTER UPDATE ON course_attendance
BEGIN
 INSERT INTO coursework_sync VALUES(NEW.lesson_id,NEW.student_key,'pending',NULL,NEW.approved_at)
 ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=NULL,updated_at=excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS discussion_sync_enqueue AFTER UPDATE OF score,reviewed_at ON academic_discussions WHEN NEW.reviewed_at IS NOT NULL
BEGIN
 INSERT INTO coursework_sync VALUES(NEW.lesson_id,NEW.student_key,'pending',NULL,NEW.reviewed_at)
 ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=NULL,updated_at=excluded.updated_at;
END;
CREATE TRIGGER IF NOT EXISTS reflection_sync_enqueue AFTER UPDATE OF score,reviewed_at ON attendance_reflections WHEN NEW.reviewed_at IS NOT NULL
BEGIN
 INSERT INTO coursework_sync VALUES(NEW.lesson_id,NEW.student_key,'pending',NULL,NEW.reviewed_at)
 ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=NULL,updated_at=excluded.updated_at;
END;
