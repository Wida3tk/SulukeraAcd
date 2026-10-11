-- One-time current-term attendance-only regrade; percentages remain untouched.
-- The worker preserves all non-attendance fields and approved compensation.
INSERT INTO coursework_sync(lesson_id,student_key,state,error,updated_at)
SELECT c.lesson_id,c.student_key,'pending','attendance-policy-20261011',strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM course_attendance c JOIN course_lessons l ON l.id=c.lesson_id
JOIN lesson_assessment a ON a.lesson_id=l.id
WHERE l.opens_at>='2026-10-04' AND l.opens_at<'2026-11-06' AND a.attendance_max=3
AND (CASE WHEN c.percent>=80 THEN 3 WHEN c.percent>=50 THEN 2 WHEN c.percent>0 THEN 1 ELSE 0 END)
 <> (CASE WHEN c.percent>=50 THEN 3 WHEN c.percent>=20 THEN 2 WHEN c.percent>=10 THEN 1 ELSE 0 END)
ON CONFLICT(lesson_id,student_key) DO UPDATE SET state='pending',error=excluded.error,updated_at=excluded.updated_at;
