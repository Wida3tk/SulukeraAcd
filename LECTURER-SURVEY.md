# Lecturer satisfaction survey

Campaign: `lecturer-2026-08-23-2026-09-24`, covering 23 August through 24 September 2026. Questions and displayed scales follow the supplied lecturer satisfaction PDF. The recommendation choices in that PDF are 1–10 (its explanatory caption also mentions 0); the system retains the displayed 1–10 choices. The lecturer name comes from the authenticated account rather than an editable answer.

The login dialog is shown to every lecturer account until the server confirms a submission. It blocks background interaction, Escape and backdrop dismissal. Logout remains available. Failed saves retain the entered answers. Completion is never inferred from browser storage. Database uniqueness by campaign and Firebase UID makes retries and parallel submissions idempotent; the first saved response is immutable.

`GET /lecturer/satisfaction` returns only campaign, name and the caller's completion status. `POST /lecturer/satisfaction` requires every question and derives identity from authentication. `GET /admin/lecturer-satisfaction` is admin-only, including comments and individual identities; finance, lecturer and student roles cannot read it. Responses live in D1, not the broadly readable Firebase administration tree. No publication-to-lecturer action exists.

Analytics are available under Evaluation → Lecturer satisfaction. Overall satisfaction uses the dedicated overall question's mean divided by 5, with a separately labeled mean for all six rating questions. Recommendation uses its own 1–10 distribution and mean. Participation compares currently existing lecturer UIDs with submitted UIDs; historical responses remain in the response report if an account is later removed. With no responses, satisfaction is unavailable, never fabricated as 0%. Challenge stages permit multiple answers, while “no difficulties” is exclusive.

Apply the additive `exam-worker/lecturer-survey.sql` before deploying the Worker. No existing user or academic table is modified. Backend tests: `node --test lecturer-survey.test.mjs`; UI tests: `node scripts/lecturer-survey-ui.test.cjs`. Future semesters must use a new campaign ID to keep responses separate.
