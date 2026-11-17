# Staff access and activity

Staff who need every current administrative feature use an independent Firebase Authentication account with `role: admin` and an optional `staffTitle`. The title is displayed in the sidebar, user list and activity receipts. Staff must never share the owner's login.

Administration → التنبيهات → سجل النشاط includes an employee filter, search, actor name/username/title, target, field summary and Saudi date/time. A live subscription loads the last 500 detailed receipts. Older receipts remain stored; the view displays up to 200 matching rows. Existing semantic activity entries remain available.

`staff-audit.js` adds a receipt to the same multipath Firebase update as every ordinary administrator SDK `set`, `update` and `remove`. A rejected receipt rejects the data write. Committed transactions receive a separate receipt; aborted transactions do not. If transaction logging fails after commit, a warning states that the data changed but logging failed. Existing student and lecturer writes retain their original behavior. Audit collections themselves are excluded to prevent recursion.

The Worker records administrator mutation intent before dispatching an authenticated route, then records completion or failure. If intent storage is unavailable, the operation is rejected before dispatch. If completion storage fails, the persisted intent remains visibly pending confirmation. Read requests, auth-account lookups, student actions and public media/bootstrap handlers are outside this mutation log. A failed route may have partial effects; a failure entry is not a claim of rollback.

Browser receipts are create-only, bound to the authenticated UID and profile name/username and stamped by Firebase. Browsers cannot overwrite/delete receipts or impersonate server receipts. The trusted Worker can finalize its own receipts. Credentials and free-text answers are excluded; a safe allowlist records scalar field values and other fields are identified by name. This is an application activity trail, not mandatory auditing of an administrator using direct database access or developer tools. Administrative permissions remain broad as requested.

Validation: `node scripts/staff-audit.test.cjs`, `node scripts/staff-audit-rules.test.cjs`, `node scripts/staff-audit-emulator.test.cjs`, the existing Firebase security/zero-grade regressions and `npm test` in `exam-worker`. Rules and browser tests use only a local demo emulator on port 9007. The browser test uses the production Firebase SDK version and headless Chrome; it verifies actual atomic writes, rejected tampering, live filtering and responsive rendering.

Deploy the additive `staffActivityLogs` rules first, then the Worker and static front end. Preserve all other live rules. Existing grade and attendance records do not require migration. Keep provisioning credentials and rule backups outside Git.
