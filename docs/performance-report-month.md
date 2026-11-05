# Executive report month

`performance-month-scope.js` adds one selector at the top of the meeting view. The default remains the last completed month (October 2026 for this meeting). Available months start at the fixed October ABAT anchor and end at the latest verified Ops snapshot/current month. The same selected period controls all executive sections.

- Recorded QBA/QASP-S: historical 214 plus qualifying Ops additions through the selected month, giving 221 for October and 225 for November.
- Recorded ABAT: October anchor 465 plus subsequent Ops additions through the selected month, giving 465/468.
- Ops charts/tables omit later months entirely, including explanatory figures and snapshot-date badges.
- Other program/system account groups exclude registrations after the cutoff and undated registrations. Active status remains the current state of that eligible cohort, explicitly labeled; the system lacks a complete end-of-month account status ledger. Current operational details are hidden in historical report mode rather than presented as historical snapshots.
- Monthly direct lecturer hours end at the selected month. Dated semester recording hours stop at the selected month/day. The current month stops at today.
- Course ratings remain limited to the current semester's subjects and are fetched through the authenticated `/admin/evaluations?throughMonth=YYYY-MM` endpoint. SQL filters response submission dates before aggregation using the exclusive Riyadh month-end boundary. Missing/mismatched scope metadata is an error, never an unfiltered fallback. Existing endpoint callers without a month retain their original behavior and lecturer/publication routes are unchanged.
- Lecturer survey responses are recalculated from the already-authorized report records submitted before the cutoff. Campaign-period labels remain explicit. A prior-campaign answer submitted later belongs to the month it was actually submitted for cutoff purposes.

Month-specific evaluation responses are cached separately per signed-in user and month. A late response for another selected month does not replace the visible report. The frontend always selects its cache entry using the current month.

Verification: `node scripts/performance-month-scope.test.cjs`; `node --test exam-worker/evaluation-month.test.mjs exam-worker/lecturer-survey.test.mjs`; `wrangler deploy --dry-run` from exam-worker. Tests verify the October/November totals, omitted future rows/hours/registrations, undated exclusions, response cutoffs, month cache switching, mobile rendering, admin authorization, unchanged unfiltered API behavior, and the Riyadh month/year boundary.

Live source check on 5 November: the current-semester course responses are dated November, so October correctly has no responses for those courses. The previous lecturer campaign has responses submitted in October and can still be shown as explicitly labeled prior-semester feedback.
