CREATE TABLE IF NOT EXISTS graduation_project_attendance (
 project_id TEXT NOT NULL,student_key TEXT NOT NULL,meeting_index INTEGER NOT NULL CHECK(meeting_index BETWEEN 0 AND 3),
 attended INTEGER NOT NULL CHECK(attended IN (0,1)),updated_by TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(project_id,student_key,meeting_index)
);
CREATE TABLE IF NOT EXISTS graduation_project_topic_choices (
 project_id TEXT NOT NULL,student_key TEXT NOT NULL,topic TEXT NOT NULL,group_id TEXT NOT NULL,chosen_at TEXT NOT NULL,
 PRIMARY KEY(project_id,student_key)
);
