# Customer service interruption announcement

The original supplied image is published as a static asset. `platform-announcement.js` is an isolated optional UI module loaded by both platform entry pages. Its only Firebase paths are `settings/platformAnnouncement` (admin-controlled configuration) and `platformAnnouncementAcknowledgements/{auth.uid}/whatsapp-service-20261028` (boolean acknowledgement). It never writes grades, attendance, coursework, attempts, or user profiles.

Activation requires `{active:true, version:"whatsapp-service-20261028"}` at the configuration path. Missing configuration or failed reads do not block the platform. Administrators can disable or re-enable the notice from Settings → إعلان قنوات التواصل. Disabling it removes the banner and popup through the realtime listener. Saving unrelated settings uses a partial update to retain the announcement configuration.

Acknowledgements are shared between devices through Firebase, with a local fallback if the acknowledgement write is unavailable. The dialog is deferred during an active electronic exam, another detected modal, or a detected save operation. The banner remains available; it does not take focus or stop any timer. Broken images show the textual message. No Zoom or Drive changes are involved.

Run `node scripts/platform-announcement.test.cjs` with Playwright available. The isolated browser test covers mobile layout, exam deferral, account-scoped acknowledgement writes, reopening, admin deactivation, image failure, logout cleanup, and absence of academic writes. Deployment of the new acknowledgement rule must merge only that root node into the live rules, preserving all other rules.
