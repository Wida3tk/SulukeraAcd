# Professional exam result approval

Apply `exam-worker/professional-exam-result-sync.sql` before deploying the result-sync worker.

The exam page exposes each submitted attempt score immediately, together with the best score and a retry action while the exam is open. Evaluations do not prevent further unlimited attempts.

Official professional results live at `professionalProgress/{studentKey}/organizational_behavior/examResults/{examId}`. Only submitted attempts with a matching evaluation can enter this record. The score is the maximum over all submitted attempts; a later lower score cannot lower it. The synchronization uses Firebase ETags and retries HTTP 412 conflicts so concurrent tabs cannot downgrade a result. Failed synchronization is retried by the minute cron.

The student professional page and administrator student profile show only approved, evaluated records. These records do not modify academic grades, attendance, unit completion or enrollment status. Firebase student rules do not permit writes to the official exam-results branch.
