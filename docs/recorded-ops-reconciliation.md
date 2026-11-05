# Recorded ABA and ABAT reconciliation — 5 November 2026

Read-only source: Ops repository `Wida3tk/Oper`, D1 `sulukera-operations-db`. `scripts/ops-recorded-monthly.sql` is the counting query. The site publishes only aggregate counts in `performance-recorded-ops-data.js`, without trainee identities. This is a dated snapshot, updated when the report is refreshed.

Count only `orders.delivery = مسجل` and QBA/QASP-S/QASPS/ABAT. Include every non-deleted operational state, including onboarding, waiting, migrated and withdrawn. A deleted customer or deleted order is excluded because it is no longer present in the system directory. No enrollment or financial-state filter is applied. Count the first recorded program order per customer within the combined QBA/QASP-S group; count ABAT independently. A repeat ABAT order is not a new trainee. Group by first qualifying order creation date in Riyadh time, rather than the older customer profile date. Live orders never contribute.

| Month | QBA + QASP-S new in Ops | ABAT new in Ops |
|---|---:|---:|
| June 2026 | 2 | 8 |
| July 2026 | 9 | 13 |
| August 2026 | 6 | 2 |
| September 2026 | 7 | 15 |
| October 2026 | 7 | 14 |
| November 2026 through snapshot | 4 | 3 |
| All available Ops records | 35 | 55 |

QBA/QASP-S: the administrative baseline of 214 (175 QASP-S + 39 QBA) was recorded on 7 October. Ops has no new first QBA/QASP-S recorded registrations between 1 and 7 October. Add the 7 October and 4 November registrations: 225. End October: 221. Earlier Ops records overlap the 214 baseline and are not added again. Current license components are 181 QASP-S and 44 QBA; the meeting view groups them together.

ABAT: the user supplied the platform total of 468 on 5 November. Subtract the 3 November additions verified in Ops to fix the October closing anchor at **465**. The forward rule is `465 + SUM(ABAT first recorded registrations in Ops for months after 2026-10)`. November closing-to-date is 468. The 55 ABAT customers present in Ops are a subset, not an additional amount. No historical monthly platform totals before October are inferred. Subsequent refreshes should preserve the October anchor and count each later month's additions once.

The meeting summary and recorded ABA certificate view use these totals. Active-system-account figures remain independently calculated from the academic system. Existing graduate counts are historical and are not increased by these additions.

Verification: `node scripts/ops-recorded-monthly.test.cjs`, `node scripts/performance-meeting.test.cjs`, and `node scripts/performance-aba-recorded.test.cjs`. SQL fixtures cover recorded-only delivery, all states, deleted exclusion, repeat orders, combined licenses, independent ABAT and Riyadh month boundaries. UI tests cover the monthly chart, current-semester satisfaction and mobile layout.
