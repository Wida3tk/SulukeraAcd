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
