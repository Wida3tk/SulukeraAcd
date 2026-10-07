# Operational review data contract

Read-only frontend redesign. No API, schema, snapshots, authorization, existing grading or productivity-save behavior changes. `performance-review.js` renders the page using existing helpers and GET endpoints.

## Monthly comparisons

- Registration uses valid `students.regDate`; imported dates may describe import rather than original joining. Invalid dates are excluded with a coverage count. No creation-time fallback.
- Withdrawal uses `withdrawnAt` of currently withdrawn students. Reactivation clears this date in the existing policy. These are retained documented events, not a complete withdrawal ledger.
- Frozen/suspended events use `statusUpdatedAt` with matching current status. Repeated or overwritten transitions cannot be reconstructed.
- Projects use existing GET `/admin/graduation-projects` submissions and their `submitted_at`. A matched student is counted once per month across files and projects. The endpoint omits student enrollment `added_at`; project/group creation never substitutes for entry into the project stage.
- Month-over-month deltas derive from these exact event lists. Zero baseline has no invented percentage. Current month is marked incomplete. Registration trend covers six months of recorded dates.

## Current state

Registry totals, account statuses, program/cohort membership, project eligibility and administrative completion states are explicitly independent of selected month. Current program/cohort labels are not historical membership at event time. QBA/QASP merge within program and cohort. API failure suppresses project counts. Academic completion is not graduation or certificate issuance. No graduation counts are fabricated.

## Semester context

Completed ABA semesters ending before the end of the review month are available. Existing exam-entered and passing threshold semantics remain. Rate is students passing all submitted exams divided by students who submitted at least one exam. Remaining exams do not automatically fail a student. Non-testers exclude withdrawn, frozen and suspended accounts. Continuing OBM programs have no fabricated final pass rate.

Evaluation API exposes aggregates by exam/subject without response dates. Grouping by subject semester is possible; historical as-of/monthly satisfaction is not. One trainee may answer multiple exam surveys. Student ratings of lecturers are not lecturer satisfaction.

Zoom hours use distinct meeting keys per lecturer with `startsAt` within the semester, deduplicated across monthly buckets. Manual productive/office hours remain in the existing monthly store and are not silently attributed to a cross-month semester. Review never writes hours; existing editor stays accessible.

## Future requirements, not implemented

End-of-month snapshots of student/program/cohort/state/stage; append-only account/academic transitions with student key, time and from/to stages; explicit graduation events; semester-attributed manual hours; dated evaluation responses. Future snapshots cannot restore missing past events. Supervision is excluded; revenue is deferred.

## Verification

Synthetic browser fixtures, no live student downloads or writes. Tests cover valid dates/year boundaries, zero baseline, month switching, cohort merging, unique submitters, drill-down/search/escaping, semester counts, source failures, admin guard and desktop/mobile overflow.
