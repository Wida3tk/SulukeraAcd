# Security rollout — 2026-10-12

## Stage 1

Rules are based on the live Firebase rules captured before the change, not an assumed local baseline. No production records are migrated or deleted.

- Students can create their own pending requests, but cannot subsequently change their status, administrator notes, review metadata, ownership, or delete the request.
- Student professional progress writes are restricted to existing browser-managed viewing/discussion fields. Attendance and exam fields can only be written by the administrator or trusted backend.
- Existing administrator and lecturer grade permissions remain unchanged in this stage, including explicit zero grades and legacy transactions.
- Browser-computed viewing and unit completion indicators are still approximate, not authoritative certification. Exam and attendance results are protected separately.

## Regression tests

Run Firebase Database Emulator with Java 21+ and `firebase.security-test.json`, project `demo-sulukera-security`, then run `node scripts/firebase-security-stage1.test.cjs`. The test writes only to `127.0.0.1:9007`, using a demo project and isolated fixtures. It tests allowed student flows, forbidden writes, administrator attendance import, and administrator/lecturer zero grade saves.

Also run `node scripts/lecturer-zero-save.test.cjs`, `node scripts/grade-result-policy.test.cjs`, `node scripts/professional-productivity.test.cjs` and `npm test` in `exam-worker`.

## Remaining stages (not yet implemented)

1. Replace whole-database lecturer/finance loaders with role-scoped data retrieval before restricting root reads. Include current and archived courses, shared batches, lecturer reviews, grading transactions, legacy grade cleanup, and professional course assignments.
2. Restrict lecturer grade writes to assigned courses; preserve legitimate shared-course and historical assignments.
3. Restrict lecturer request-review writes to assigned grade-review requests.
4. Add automated independent backups for Firebase, D1 and project file storage; test restore. Do not assume manual Firebase JSON exports include D1/KV data.
5. Prevent concurrent attendance removal/replacement races with a backend transaction/operation lock.
6. Upgrade developer dependencies and enforce CI regression checks before deployment.

## Deployment and rollback

Deploy only database rules using Firebase CLI. The pre-change rules are retained privately in `.tools/firebase-rules-before-security-20261012.json`; do not commit production exports or credentials. A rollback changes permissions only, not grade data. Verify deployed rules match the tested file and compare read-only grade/progress fingerprints before and after deployment. Investigate normal concurrent user changes before treating a fingerprint difference as data loss.
