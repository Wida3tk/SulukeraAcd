# Academic coursework

Install schema before deploying the worker or publishing the UI:

    npx wrangler d1 execute sulukera-exams --remote --file=coursework.sql
    npm test
    npm run check
    npx wrangler deploy

The existing FIREBASE_SERVICE_ACCOUNT secret signs the database service token. It needs Firebase RTDB read/write access. The token scope now includes Firebase database and user email alongside Identity Toolkit. Correct answers stay in D1 and never appear in student responses.

Admin: الدراسة والاختبارات → المحاضرات والواجبات. Configure four lessons per current subject, publish questions and Saudi open/close dates. Homework attempts are unlimited within this window. Once submitted, questions cannot change. Each lesson result goes to its existing w1–w4 homework component; the maximum comes from settings.hw. Zoom presence ≥80% goes to settings.attend. Missing presence below the threshold stays pending until a lecturer reviews the written reflection. Live and reflection grades are not added together.

Attendance import accepts the detailed Zoom CSV with join/leave timestamps. Match email or normalized Arabic/English name, resolve ambiguous rows manually, then approve. Reconnected/overlapping intervals are merged per selected student account; absent roster members are included at zero percent. Imports upsert each lesson/student pair. Specify actual meeting duration before approval. No student grades are written by browser code.

Grade synchronization uses Firebase ETags and preserves other grade components, merging the legacy key if the canonical record does not exist. Saved attempts and reflection reviews survive sync failures. Pending sync is visible after submission and can be retried by admin or the assigned lecturer. No background cron is configured.

Tests use in-memory SQLite, a scoped Firebase fixture and simulated credential failure; they do not insert test records or submit homework to production.

## Consistent grade sources (local fix, 7 October 2026)
Student coursework and lecturer reports now read authenticated Firebase grade snapshots as a fallback when D1 has no attendance, homework attempt score, or graded discussion. Attendance/reflection authorization uses the same fallback. D1 attendance remains preferred where present. Manual homework/discussion marks are shown as manual grading; they do not create attempts, answers, or proof of submission. Reflection credit still requires a real basic homework attempt.

Weekly grade saves record attendEntered/hwEntered/discEntered flags, preserving existing metadata. Legacy positive marks are readable; a legacy default zero without an explicit recording flag remains unknown. Re-save the relevant week to confirm manually recorded zeros. Reviewed reflection feedback remains visible even without a live-attendance record. No backfill, production writes, or deployment were performed.

Lecturer link verification: the authorized lesson report now includes each enrolled student's individual homework attempts and selected answers, plus a three-component grading-completion indicator. Discussion answers are restricted to the current report roster. A reviewed reflection is displayed as awaiting the basic homework until there is an actual submission. Automated integration tests verify lecturer access, outsider denial, student/lecturer score agreement (including zero), answer isolation, and browser grading after search/pagination. Verification uses fixtures/mocked writes, not live accounts. These changes remain local.
