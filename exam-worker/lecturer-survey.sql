CREATE TABLE IF NOT EXISTS lecturer_survey_responses (
 campaign_id TEXT NOT NULL,
 lecturer_uid TEXT NOT NULL,
 lecturer_name TEXT NOT NULL,
 lecturer_username TEXT NOT NULL,
 responses_json TEXT NOT NULL,
 submitted_at TEXT NOT NULL,
 PRIMARY KEY (campaign_id, lecturer_uid)
);
