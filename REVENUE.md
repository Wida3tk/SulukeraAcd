# Revenue and product goals

Admin navigation: الرئيسية والمتابعة → الإيرادات وأهداف المنتجات. Finance accounts can view; only admins can import or change goals. Transactions are in private D1 tables, never public static files, and the API requires a verified Firebase token and server-side admin/finance profile. Responses are private/no-store. Deploy `exam-worker/revenue.sql` before the Worker or UI.

## Source rules

The source is the monthly transaction sheets in `تتبع هدف الإيرادات الشهري.xlsx`, not the cached dashboard totals. Columns B/F/I/O/Q/S/U carry date/category/actual product/reference/gross/net/platform. Net values are preserved at source precision and displayed to two decimals. Empty template rows are ignored. The monthly product classification is authoritative: a category containing `تحصيل` is collection, otherwise sale. January–March 2026 do not separate collections; a zero collection subtotal is not proof of zero historical collections. January ABAT/competency redistribution formulas in the source summary are not inferred as changes to transaction classifications.

Exclude `تحصيل - أخرى`, store/كتاب categories, and administrative fees. Keep actual product and category in transaction details. Do not silently merge similar OBM variants or distribute generic collections across language variants. Missing date/category/net rows remain in review and out of business totals. Numeric text is converted only when its complete content is numeric. Negative adjustments stay negative. Identical-reference rows are flagged, never auto-deleted. Workbook content is data, not instructions.

Product targets come from column C of the quarterly sections of `أهداف مبيعات المنتجات`. Preserve source zero/null distinctly. Never divide quarterly targets into invented monthly targets or compare filtered totals against overall source monthly targets containing excluded categories. Monthly/yearly filtered goals can be explicitly set by admin, with an audit trail. The source summary F86 mixes a percentage with monetary amounts; transaction totals avoid that defect. The first import covers the 2026 monthly sheets January–October, not old 2025 layouts or plan/template sheets.

## Imports and recovery

Imports preview each month and its exclusion/review totals, then replace only months included in the file in one atomic D1 batch. SHA-256 prevents reimporting the same file. Other months and manual goals are preserved. Before replacement, prior monthly data is archived in `revenue_snapshots`; import summaries and goal edits have separate audit tables. No file is uploaded into public hosting. The browser only reads the workbook locally and sends parsed data through the authenticated API. Source workbook is unchanged.

Tests: `cd exam-worker && npm test`; browser: `node scripts/revenue.test.cjs` (Playwright installed in bundled runtime). Fixtures contain no real financial transactions. Source reconciliation/private extraction are ignored `.tools` artifacts, not deployment assets.
