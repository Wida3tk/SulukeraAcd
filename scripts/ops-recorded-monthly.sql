-- Read-only Ops report. No enrollment/status join: onboarding and withdrawn customers remain included.
-- A customer counts once within the combined QBA/QASP-S group, independently within ABAT.
WITH qualifying AS (
 SELECT o.customer_id,
        CASE WHEN upper(replace(o.track,'-',''))='ABAT' THEN 'ABAT' ELSE 'QBA_QASPS' END cohort,
        o.created_at
 FROM orders o JOIN customers c ON c.id=o.customer_id
 WHERE trim(o.delivery)='مسجل'
   AND upper(replace(o.track,'-','')) IN ('QBA','QASPS','ABAT')
   AND c.deleted_at IS NULL AND o.status!='محذوف'
), first_registration AS (
 SELECT customer_id,cohort,MIN(created_at) added_at FROM qualifying GROUP BY customer_id,cohort
)
SELECT strftime('%Y-%m',added_at,'+3 hours') month,cohort,COUNT(*) trainees
FROM first_registration GROUP BY month,cohort ORDER BY month,cohort;
