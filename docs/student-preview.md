# Admin student-experience preview

Entry: Administration → Students and records → معاينة تجربة الطالب. Only the `admin` role can call the new endpoints; no test student, login, enrollment or lecturer roster row is created.

Choose an existing student (actual enrollments, plan, account state and exceptions), or a virtual batch/plan context. Virtual contexts are never saved. The academic coursework response uses the existing `handleCoursework` GET implementation, and exam listing uses the same `studentExams` function with an internally resolved context. Student routes do not accept a context override. Published/allowed professional units and sessions are displayed separately. Schedule publication is explicitly distinguished from electronic exam/question publication.

The UI uses the actual academic lesson-card renderer, but strips its inline handlers and replaces actions with local demonstrations. It never sets `currentUser` to the selected student, never changes the shared coursework state, and never calls student submission, evaluation or watch-checkpoint APIs. Exam answers and evaluation inputs remain in the preview dialog's DOM and are discarded on close. Evaluation wording is shared with the student form through `student-evaluation-model.js`.

## Server boundaries

- `GET /admin/student-preview`: read-only contextual metadata and optional scoped exam questions (`examId`). Replies are private/no-store.
- `POST /admin/student-preview/recording`: validates the selected student's entitlement (or virtual plan) and creates an administrative playback ticket only. Academic media uses expiring technical tickets; professional media uses the existing `admin-preview:{uid}` flow. There are no student progress checkpoints or academic writes.
- Every other preview route or mutation is rejected. Students, lecturers and finance users cannot invoke preview endpoints.
- Withdrawn/suspended students remain unavailable, even to the student-facing preview context. Administrative exam simulation may run outside a student's exam window but is clearly labelled; it never changes that student's availability or consumes an attempt.

Completed tests: `npm run test:student-preview` in exam-worker; the existing worker regression suite; `node scripts/student-preview-ui.test.cjs` (Playwright/Edge). Tests cover no academic writes, scoped questions, account/plan restrictions, virtual contexts, independent professional playback, local-only exercises, mobile layout and logout cleanup. The ignored live-audit helper performs reads only; it requires a valid Firebase CLI connection and is not part of the feature's runtime.
