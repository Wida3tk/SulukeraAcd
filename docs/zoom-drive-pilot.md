# Zoom to Drive pilot

The connection inspector is restricted to Zoom host `rushdacd.sa@gmail.com`, meeting `88245118262`, course `course_07`, and its Q2/Q3 October 2026 offerings. On October 18 the user authorized transferring the other courses on this same host. The operations-only catalog therefore lists this host's current-month recordings; manual reviewed manifests identify each exact file, destination folder and lesson IDs. Ambiguous titles/dates must not be linked automatically. The recordings root is the existing `DRIVE_RECORDING_FOLDER_ID`; no recording is made public or deleted.

Zoom credentials are stored in Cloudflare secret `ZOOM_PILOT_CREDENTIALS`. They are not returned to clients or committed. `POST /integrations/zoom-drive-pilot/inspect` is disabled unless a strong `RECORDING_PILOT_KEY` is configured and requires that exact bearer key. This operations-only inspection lists completed MP4 metadata for the exact pilot meeting and checks Drive metadata and folder capabilities within the configured root. It never returns Zoom access tokens, download URLs, or client secrets and performs no grade or attendance writes.

The October 18 inspection verified one October 4 recording (105,892,120 bytes) and located the course folder `1A4UvkeSse2FY00tK0uO4ysHuGGkNucTS` under `SIS Recording - 2026`. This is a My Drive folder rather than a shared drive. The service account can read the folder and its capabilities indicate write access, but service accounts cannot own uploaded My Drive files because they have no storage quota. This is distinct from the folder's sharing permissions. The pilot needs user OAuth for uploading to the existing folder. See Google's [shared drive and service account guidance](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

The local setup helpers are ignored under `.tools`. Google authorization uses a Desktop OAuth client, loopback callback with PKCE and an expiring random state, a real browser for account consent, and a separate `DRIVE_UPLOAD_OAUTH` Cloudflare secret. Authorization was verified for `maryam@sulukera.com`. The consent screen describes the Drive scope explicitly. The helper checks the selected folder is under the authorized root, write capability and storage before saving the refresh credential.

`POST /integrations/zoom-drive-pilot/catalog` and `/transfer` require the same private operations key. Transfer state is persisted in the additive `zoom_drive_transfers` table. Each call uploads at most 8 MiB, checks Google's authoritative resumable offset, uses a stable pre-generated Drive ID, and holds a per-source D1 lease. Source recordings are not deleted. Before publishing a link the worker verifies size, parent, MP4 signature and byte-range readability through the existing playback service account. It patches only `course_lessons.recording_url` and `updated_at`, protecting existing links; no marks, deadlines, submissions or attendance are changed. No automatic transfer schedule is enabled.

Academic Drive links now open an in-platform video dialog. Authenticated `/coursework/recording/start` uses the existing active-student/subject and lecturer assignment scope and checks published status for students, then creates a high-entropy, expiring private media ticket. This does not make Drive files public or require students to sign into Google. Playback does **not** award attendance or silently change the recorded-attendance homework/lecturer-approval policy. ABA watched-duration accounting is not yet implemented. A successful connection inspection is not evidence of completed transfer or viewing-credit integration.

Run `node --test zoom-drive-pilot.test.mjs` in `exam-worker`. Tests cover disabled/unauthorized access, folder containment, credential redaction and exact meeting/file filtering. The existing Worker suite remains required before deployment. Browser, actual transfer, resumable retry, idempotence and playback verification must be completed after Drive upload authorization.

## October 18 transfer results

All four completed MP4 recordings returned by this host's October catalog were transferred and linked:

- October 4 Behavior Change Interventions → lecture 1, Q2 and Q3; Drive `1ntZsoTZdDkCRMLq1DFDjURfhEBTdAv5c` (105,892,120 bytes).
- October 6 Advanced Supervision → lecture 1, Q1; Drive `1CNzqHoQxw8Hg5F7pIyN-jpcf98U8fi-L` (65,990,660 bytes).
- October 13 Advanced Supervision → lecture 2, Q1; Drive `1CEMPgX7xA2L4dw-K6wK6s9afb_oLzBPm` (76,317,856 bytes).
- October 14 Skill Acquisition Programming → lecture 1, Q2 and Q3; Drive `1Ya2AtIUYpkvMJnIPWw787Ws9dl2c5fyH` (158,654,818 bytes).

The October 14 historical Zoom topic incorrectly says Behavior Change Interventions. Maryam explicitly clarified the course and that this was the first lecture. The matching Zoom meeting ID is `85761104229`, already assigned to course_08. Its date differs from the existing lesson 1 assignment opening (October 7); this is recorded in `zoom_drive_mapping_reviews`, without changing assignment windows, questions, attempts or grades. Date overrides require an operator reason and an exact Zoom meeting-ID match for all destination lessons.

## Separate account connections

On October 18, `rushdacd1@gmail.com` was connected and verified using the separate secret `ZOOM_ACCOUNT_RUSHDACD1`, without replacing `ZOOM_PILOT_CREDENTIALS`. `transferAccount` accepts only explicitly enabled account emails, checks that each credential belongs to its expected host, and creates a request-local environment rather than mutating shared credentials. The private catalog accepts `{host}`; each manual transfer manifest must specify its host. `zoom_drive_transfer_accounts` records job ownership and rejects cross-account resumes. The original four jobs retain their original-host default for compatibility.

The second account's October catalog contains classroom-management recordings on October 7 and 14 (`86843545960`) and an assessment-protocols recording on October 6 (`87401037383`). These map by exact date, existing lesson meeting ID, and the existing course folders. No October 13 assessment-protocols recording was returned by this account. No scheduled automatic sync or source-deletion policy is enabled.

All three second-account recordings completed transfer and private byte-range playback verification (HTTP 206, MP4 signature verified): classroom management lecture 1 → Drive `1nLB2UcaQQAiL05JrZfz0R5Xyq-Z6yOia`, lecture 2 → `1z72wy2dXfMv5OZ5I-xz4XpZGthF9Nlkj`, assessment protocols lecture 1 (Q2 and Q3) → `1Gnl7pk2XzbuOucdt-Lr6BoXCCBT1QWhz`. The final D1 readback showed all seven original and second-account jobs complete, with source byte sizes matching uploaded byte sizes. No grades, attendance, question sets or homework dates were changed by these operations.

The next user-authorized account is `RushdABAT@gmail.com` for academic OBM plus the professional program. Its localhost credential form is separate and stores `ZOOM_ACCOUNT_RUSHDABAT`; it is not enabled for transfer until connection and lecture/session mapping are verified.

## Third account verification

The third account is now verified and explicitly enabled through `ZOOM_ACCOUNT_RUSHDABAT`. Its October catalog contains one academic OBM lecture (October 11, meeting `87930048061`), three professional foundations recordings (October 5/6/12, meeting `86410858243`) and one graduation-project recording. Maryam explicitly requested leaving the graduation recording alone; it is excluded from the transfer manifest.

Professional unit `track_1/unit_1` already has recording links for all five sessions. The three October recordings match existing session 3/4/5 video byte sizes exactly (88,264,266; 188,202,467; 102,263,335) and their durations agree to less than one second. All five existing professional videos passed configured-root validation and private byte-range playback verification. Their existing links, watch progress, assignments, approvals and grades are retained; no duplicate uploads or link replacement are needed.

Academic OBM lecture 1 (`off_5zwxxi_course_14_lesson_1`, October 11) was uploaded to the separate academic OBM folder and linked to Drive `19kf7xLnPYIyvIn5a6PHELWuNdIOVTd0u` (76,122,346 bytes). The final upload passed byte-size, MP4 signature and private media-ticket playback checks. Graduation configuration and its recording were left unchanged.

The private catalog reads sanitized professional session metadata using the existing server credential, never exporting student data, exam questions, credentials or tokens. It reports metadata/playback readiness without awarding watch progress. Some later-unit session dates repeat dates from unit 1; these are not modified or used for automatic publishing. Automatic recording matching must not infer a later unit from these copied dates.
