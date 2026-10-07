# Operational review data contract

Frontend redesign with no API, schema, snapshots, authorization or grading changes. `performance-review.js` renders the page using existing helpers and GET endpoints. The subsequently requested manual productivity ratios are saved only to the existing lecturer productivity record as described below.

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

### Requested lecturer attainment

Required workload is 2.5 hours per lecture. Regular lecturers have one weekly lecture; Afnan and Nouf use deduplicated schedule sessions or a manually specified weekly lecture count. Shared day/time slots are counted once. The scheduled-weekly helper now follows this explicit policy instead of summing cohort rows.

Automatic monthly attainment divides productive hours (Zoom plus existing manual productive hours) by 2.5 times scheduled lectures due through today within dated schedule boundaries. Missing historical schedules do not generate invented targets. Office hours are excluded. Manual historical percentages take precedence, saved under `lecturerProductivity/<month>/<lecturer>/reviewProductivity` with weekly lecture count and audit metadata. Existing hour and meeting fields are preserved. The chart is the unweighted mean of available lecturer percentages, with coverage, since historical percentages alone lack hour weights. Success charts group completed-semester outcomes by semester end month, not exam submission date.

## Future requirements, not implemented

End-of-month snapshots of student/program/cohort/state/stage; append-only account/academic transitions with student key, time and from/to stages; explicit graduation events; semester-attributed manual hours; dated evaluation responses. Future snapshots cannot restore missing past events. Supervision is excluded; revenue is deferred.

## Verification

### Hour-based view and 2026 workbook import

The subsequently requested `lecturer-hours.js` overrides the productivity view with monthly direct/office hours and year-to-date sums in both review and lecturer productivity pages. Old percentages are preserved but never interpreted as hours. Direct hours include manual/imported productiveHours, Zoom meetings and existing extraHours; office hours are separate. Only current lecturer users contribute to totals. Monthly edits preserve meeting records and unrelated fields.

The provided 2026 lecturer report was read without modifying the workbook. Individual monthly component rows were used, not repeated subtotals or grand totals. The combined Rozan/Mohammad row explicitly identifies Mohammad from March; January/February were excluded from his existing account. Seven existing lecturer usernames matched, with 31 populated monthly records. Import sets component fields and provenance at the existing monthly productivity path, making repeat execution idempotent; it never writes users or creates accounts. No 2025, supervision or unmatched lecturer data is imported.

Synthetic browser fixtures, no live student downloads or writes. Tests cover valid dates/year boundaries, zero baseline, month switching, cohort merging, unique submitters, drill-down/search/escaping, semester counts, source failures, admin guard and desktop/mobile overflow.
