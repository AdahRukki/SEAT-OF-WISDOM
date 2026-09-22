import { sql } from 'drizzle-orm';
import { db } from './db';
import type { LedgerPayment } from '@shared/ledger-payments';

// One query for all direct payments and student allocations in the school scope.
// Dates are applied later so first-payment detection can see earlier payments.
export async function getLedgerPayments(schoolId: string, term?: string, session?: string): Promise<LedgerPayment[]> {
  const result = await db.execute(sql`
    SELECT fpr.id, fpr.id AS "paymentRecordId", fpr.student_id AS "studentDbId",
      fpr.amount::text AS amount, fpr.purpose, fpr.payment_method AS "paymentMethod",
      fpr.reference, fpr.status, fpr.payment_date AS "paymentDate",
      (fpr.created_at AT TIME ZONE 'UTC') AS "createdAt", (fpr.confirmed_at AT TIME ZONE 'UTC') AS "confirmedAt",
      fpr.term, fpr.session, false AS "isSplit"
    FROM fee_payment_records fpr
    WHERE fpr.school_id = ${schoolId} AND fpr.status = 'confirmed' AND fpr.student_id IS NOT NULL
      ${term ? sql`AND fpr.term = ${term}` : sql``}
      ${session ? sql`AND fpr.session = ${session}` : sql``}
    UNION ALL
    SELECT fpss.id, fpr.id AS "paymentRecordId", fpss.student_id AS "studentDbId",
      fpss.amount::text AS amount, fpr.purpose, fpr.payment_method AS "paymentMethod",
      fpr.reference, fpr.status, fpr.payment_date AS "paymentDate",
      (fpr.created_at AT TIME ZONE 'UTC') AS "createdAt", (fpr.confirmed_at AT TIME ZONE 'UTC') AS "confirmedAt",
      fpr.term, fpr.session, true AS "isSplit"
    FROM fee_payment_student_splits fpss
    JOIN fee_payment_records fpr ON fpr.id = fpss.payment_record_id
    WHERE fpr.school_id = ${schoolId} AND fpr.status = 'confirmed'
      ${term ? sql`AND fpr.term = ${term}` : sql``}
      ${session ? sql`AND fpr.session = ${session}` : sql``}
    ORDER BY "confirmedAt" ASC NULLS LAST, "paymentRecordId", id
  `);
  const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null;
  return (result.rows as any[]).map(row => ({...row, amount: String(row.amount),
    paymentDate: iso(row.paymentDate), createdAt: iso(row.createdAt), confirmedAt: iso(row.confirmedAt),
    isSplit: row.isSplit === true || row.isSplit === 't'}));
}
