# Professional recorded meetings

Published meetings remain accessible. Recordings are optional by default; an administrator can designate an individual meeting as recorded compensation for a specific trainee. Watching 80% of unique video content enables manual approval. Live Zoom attendance takes precedence and is never overwritten. No grades, account status, or existing Firebase enrollment records are written by recording tracking.

The student HTML video player streams existing configured Drive recording URLs through authenticated server-created playback tickets. The Worker uses Drive read-only OAuth and validates that each video belongs to the configured folder (including nested folders). Google credentials remain on the Worker. If this connection fails, the existing Drive preview remains available and receives no viewing credit.

Progress uses one D1 row per trainee and video, merged unique playback intervals, and optimistic version checks inside atomic D1 batches. A playback run belongs to one trainee. Replayed reports, large seeks, paused playback and hidden-page intervals do not add watched time. Multiple tabs merge intervals instead of overwriting progress. Streaming does not buffer the full recording in Worker memory.

## Setup

- Apply `exam-worker/professional-recordings.sql` additively to D1.
- Set `DRIVE_RECORDING_FOLDER_ID` to the designated recordings folder.
- Use `DRIVE_SERVICE_ACCOUNT`, or the existing `FIREBASE_SERVICE_ACCOUNT` fallback; neither credential belongs in the repository or browser.
- Enable Google Drive API for the service-account project.
- In the administration professional progress page, use **فحص اتصال Drive** to identify the exact integration email and check folder access. The owner must share this particular folder with that identity as Viewer. Do not make recordings public as a workaround.
- Recording URLs are assigned using the existing meeting editor. This release does not automatically classify newly uploaded files into meetings.
- After access is granted, test an actual video, seeking, stopping, resuming and the recorded-compensation approval workflow. Local tests are not proof of real Drive streaming or its external quotas.

## Validation

Run the Worker test suite, `scripts/recording-watch-model.test.cjs`, `scripts/professional-recording-ui.test.cjs`, and `scripts/canonical-courses.test.cjs`. Concurrency tests cover five trainees and two tabs for the same trainee. UI tests preserve access to later published meetings and the Drive fallback when tracking is unavailable.
