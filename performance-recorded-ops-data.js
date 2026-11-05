/* Aggregate Ops reconciliation; no trainee identities. ABAT platform anchor approved by administration. */
const performanceRecordedOpsData={
  "asOf": "2026-11-05T11:33:34.670Z",
  "source": "Ops / sulukera-operations-db",
  "sourceRepository": "Wida3tk/Oper",
  "timeZone": "Asia/Riyadh",
  "baseline": {
    "asOf": "2026-10-07",
    "qba": 39,
    "qasps": 175,
    "total": 214,
    "octoberBeforeSnapshot": 0
  },
  "current": {
    "qba": 44,
    "qasps": 181,
    "qbaQasps": 225,
    "abatOps": 55,
    "abat": 468
  },
  "months": [
    {
      "month": "2026-06",
      "qbaQasps": 2,
      "abat": 8
    },
    {
      "month": "2026-07",
      "qbaQasps": 9,
      "abat": 13
    },
    {
      "month": "2026-08",
      "qbaQasps": 6,
      "abat": 2
    },
    {
      "month": "2026-09",
      "qbaQasps": 7,
      "abat": 15
    },
    {
      "month": "2026-10",
      "qbaQasps": 7,
      "abat": 14
    },
    {
      "month": "2026-11",
      "qbaQasps": 4,
      "abat": 3
    }
  ],
  "criteria": {
    "delivery": "مسجل",
    "statuses": "all_non_deleted",
    "date": "first_recorded_program_order_created_at_per_customer_and_group",
    "deduplication": "customer_id within QBA_QASPS combined or ABAT",
    "abatCoverage": "Ops only; no additional historical baseline"
  },
  "previousMonth": {
    "month": "2026-10",
    "qbaQasps": 221,
    "abatOps": 52,
    "abat": 465
  },
  "abatPlatform": {
    "anchorMonth": "2026-10",
    "anchorTotal": 465,
    "approvedCurrentTotal": 468,
    "approvedAsOf": "2026-11-05",
    "source": "admin_platform_total_minus_ops_november_additions",
    "monthlyRule": "anchorTotal + Ops ABAT first recorded registrations after anchorMonth"
  }
};
