# Executive Navy admin redesign — local review

Branch: `codex/executive-navy-admin`. No production deployment, push, migrations, or backend changes.

## Audit and implementation
The app is plain HTML/CSS/JavaScript. `index.html` owns existing authentication, role navigation, page routes, dashboard data and renderers. Existing IBM Plex Sans Arabic is retained. The administration already has five accordion groups and 25 routes; these remain intact. Its dashboard already provides priorities, cohorts, current assessments and reliable activity records.

The redesign builds on the existing `admin-shell` progressive enhancement rather than replacing the architecture. Tokens are centralized under `.admin-shell`; navy navigation, semantic headers, KPI links, a breadcrumb, existing request count, user menu and Ctrl K navigation search share those tokens. The original logo is preserved on a small white surface. User identity moves to the footer. Desktop collapse keeps all route icons accessible; mobile uses a drawer with focus management. The active accordion is kept open. Reduced motion, visible keyboard focus and narrow-screen table scrolling are supported.

## Modified files
- `admin-shell.css`: scoped tokens, shell, dashboard, shared control/table appearance and responsive states.
- `admin-shell.js`: admin-only enhancement of original renderers; page search uses the existing route list only.
- `index.html`: asset cache versions only.
- `scripts/admin-shell.test.cjs`: full-page browser regression checks with synthetic data and all backend requests blocked.
- This document: implementation and review notes.

Preserved: every module/route, role checks, authentication, original data calculations, sort/filter/pagination handlers, dashboard priority ordering, activity logs, APIs, DB schema/data, integrations, lecturer/student views. The separate supervision system is untouched. No new dependencies.

## Verification
Browser checks cover all 25 navigation routes, active-group protection, Ctrl K filtering/Enter/Escape, five widths (1440/1280/1024/768/390), desktop icon rail, mobile close/inert state, repeat renders and role isolation. Dashboard fixture count checks verify that existing renderer values reach the cards. Tests block backend access and make no writes. Full index and Student login regression suites also run. Screenshots are synthetic fixtures, not production statistics.

No build step is required by this static frontend: inline scripts and the new shell script are syntax-compiled by the browser test. No blanket WCAG certification is claimed.

## Scope and limitations
The rollout includes the shell, main landing dashboard, and scoped shared styles; deeper redesigns of individual admin modules wait for review. Existing operational counts and priority definitions remain unchanged. The cohort KPI now says "دفعات تضم طلابًا" because its existing count includes any cohort with registered students; this avoids claiming a new active-cohort calculation. Attention totals may overlap across categories, as in the existing dashboard.

Command search covers pages only. Cross-record search needs a separately approved backend capability. Loading/error/modals/charts retain their existing workflows; no new data endpoints or fabricated charts were introduced. Long tables scroll inside their wrappers. Accessibility checks here are functional and visual, not a formal audit.

## Preview
`http://127.0.0.1:8877/index.html` is the working local application with its existing authentication. `.tools/executive-preview.html` is a local screenshot gallery that requires no account; generated preview files are ignored by Git. Do not deploy until explicitly approved after local review.
