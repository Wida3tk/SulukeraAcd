# Meeting performance view

`performance-meeting.js` is the final executive panel override loaded after `performance-presentation.js`. It presents historical program registrations, current active accounts, lecturer productivity, then satisfaction. Existing operational details remain available.

Recorded ABA uses the approved aggregate (214). OBM uses the approved historic cohort totals (438) plus the current practitioner-live cohort identified by the existing cohort helper. System accounts in those historic cohorts are not added again. Other programs use current system counts with their source labeled. The headline is program registrations, not distinct people across programs. Active counts use current active system accounts only and their own system denominator.

Monthly productivity uses `lecturerHoursTotal`: direct imported/manual hours plus Zoom and extra hours, excluding office hours. The semester card separately uses dated recording durations; it does not assign monthly manual entries to a partial semester. Missing months, missing recording durations and the unfinished current month are labeled explicitly. Satisfaction keeps the existing response-weighted reports and source loading/error states.

Verification: `node scripts/performance-meeting.test.cjs` and `node scripts/performance-presentation.test.cjs`. Browser fixtures are synthetic; live account aggregates were checked read-only before publishing.

Satisfaction is restricted to subjects of official active semesters that have started, across all batches. Explicit evaluation semester references from previous periods are excluded. Both cards describe trainee course feedback (overall course experience and lecturer questions q7-q10); the historical general lecturer survey is not shown. Empty management categories are omitted.
