# Graduation project workspace

Students in the graduation stage see four tabs: meeting schedule and recorded attendance, topics and their team, the adapted Sulukera policy, and PDF submission. The first meeting notice appears once per login session and stops after that meeting ends. Meeting times are shown in Asia/Riyadh. Zoom links are edited in the administration project settings; HTTPS links only.

The October 2026 Q1 QASP-S cohort meets on October 14, 21, 28 and November 4 from 19:00 to 20:00 Saudi time. Topics remain unpublished until after the first meeting. Publishing topics enables student selection, with five seats per group and the remaining students in the final group (four for 24 or 29 students). Selection is saved atomically, prevents duplicate assignment and rejects a full group. Selected topics cannot be reordered once choices exist. Administration retains its group management tools.

Attendance starts unrecorded. Administration can explicitly record present, absent or clear a record for each of the four meetings. Students receive only their own attendance and their own group. Team members' names are read on the server using the existing service account after membership verification; contact details are never returned.

The policy text comes from the supplied graduation project policy, adapted to Sulukera without staff names, document-control or approval pages. PDF submissions retain the existing 20 MB limit, verify the extension and PDF signature, and require group membership. Files remain private in the existing KV namespace. Previously submitted files remain accessible.

Before deploying the Worker, apply `exam-worker/graduation-experience.sql` to D1. The migration adds attendance and topic-choice tables without changing existing project, group, submission or grade records. Keep the four meetings in `general_meetings_json`; the administration settings now save all four rather than truncating them to two.

Validation: `node --test exam-worker/graduation-project.test.mjs`, `node scripts/graduation-project-ui.test.cjs`, and `node scripts/canonical-courses.test.cjs`. UI tests capture desktop, mobile, submission and meeting-notice previews in the ignored `.tools` directory.
