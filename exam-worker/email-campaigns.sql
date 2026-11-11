CREATE TABLE IF NOT EXISTS email_campaigns (
 id TEXT PRIMARY KEY,
 semester_start TEXT NOT NULL,
 semester_end TEXT NOT NULL,
 subject TEXT NOT NULL,
 preheader TEXT NOT NULL,
 headline TEXT NOT NULL,
 intro TEXT NOT NULL,
 button_label TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','testing','approved','sending','sent','failed')),
 audience_count INTEGER NOT NULL DEFAULT 0,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_campaign_events (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 recipient_email TEXT,
 provider_id TEXT,
 detail TEXT NOT NULL DEFAULT '',
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events ON email_campaign_events(campaign_id,created_at);
