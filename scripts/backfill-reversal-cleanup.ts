import 'dotenv/config';
import { eq, and, sql } from 'drizzle-orm';
import { db, pool } from '../server/db';
import {
  feePaymentRecords,
  paymentAllocations,
  bankTransactions,
  paymentAuditLogs,
  users,
} from '@shared/schema';

async function main() {
  console.log('[backfill-reversal-cleanup] Starting...');

  const stale = await db
    .select({
      paymentId: feePaymentRecords.id,
      schoolId: feePaymentRecords.schoolId,
      reversedBy: feePaymentRecords.reversedBy,
      allocCount: sql<number>`count(${paymentAllocations.id})::int`,
    })
    .from(feePaymentRecords)
    .innerJoin(
      paymentAllocations,
      eq(paymentAllocations.paymentRecordId, feePaymentRecords.id),
    )
    .where(eq(feePaymentRecords.status, 'reversed'))
    .groupBy(
      feePaymentRecords.id,
      feePaymentRecords.schoolId,
      feePaymentRecords.reversedBy,
    );

  console.log(
    `[backfill-reversal-cleanup] Found ${stale.length} legacy reversed payments with stale allocations.`,
  );

  if (stale.length === 0) {
    console.log('[backfill-reversal-cleanup] Nothing to do. Exiting.');
    await pool.end();
    return;
  }

  let fallbackUserId: string | null = null;
  const needsFallback = stale.some((s) => !s.reversedBy);
  if (needsFallback) {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
      .limit(1);
    if (!admin) {
      throw new Error(
        'No active admin user found to attribute audit log entries to for payments with no reversedBy.',
      );
    }
    fallbackUserId = admin.id;
    console.log(
      `[backfill-reversal-cleanup] Using fallback admin ${fallbackUserId} for audit logs on payments with no reversedBy.`,
    );
  }

  let cleanedPayments = 0;
  let freedBankTransactions = 0;

  for (const row of stale) {
    const { paymentId, schoolId, reversedBy } = row;
    const auditUserId = reversedBy ?? fallbackUserId!;

    const result = await db.transaction(async (tx) => {
      const allocs = await tx
        .select({ bankTransactionId: paymentAllocations.bankTransactionId })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentRecordId, paymentId));

      const bankTransactionIds = Array.from(
        new Set(allocs.map((a) => a.bankTransactionId)),
      );

      if (bankTransactionIds.length === 0) {
        return { freed: [] as string[] };
      }

      await tx
        .delete(paymentAllocations)
        .where(eq(paymentAllocations.paymentRecordId, paymentId));

      const freed: string[] = [];
      for (const txId of bankTransactionIds) {
        const remaining = await tx
          .select({ id: paymentAllocations.id })
          .from(paymentAllocations)
          .where(eq(paymentAllocations.bankTransactionId, txId))
          .limit(1);
        if (remaining.length === 0) {
          await tx
            .update(bankTransactions)
            .set({
              status: 'unmatched',
              matchConfidence: 0,
              updatedAt: new Date(),
            })
            .where(eq(bankTransactions.id, txId));
          freed.push(txId);
        }
      }

      await tx.insert(paymentAuditLogs).values({
        action: 'cleanup_backfill_reversal',
        entityType: 'payment_record',
        entityId: paymentId,
        userId: auditUserId,
        schoolId: schoolId ?? null,
        previousData: { allocatedBankTransactionIds: bankTransactionIds },
        newData: { releasedBankTransactionIds: freed },
      });

      return { freed };
    });

    cleanedPayments += 1;
    freedBankTransactions += result.freed.length;
    console.log(
      `[backfill-reversal-cleanup] Payment ${paymentId}: released ${result.freed.length} bank transaction(s).`,
    );
  }

  console.log('---');
  console.log(
    `[backfill-reversal-cleanup] Found ${stale.length} legacy reversed payments with stale allocations.`,
  );
  console.log(
    `[backfill-reversal-cleanup] Cleaned ${cleanedPayments} payments. Freed ${freedBankTransactions} bank transactions.`,
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error('[backfill-reversal-cleanup] FAILED:', err);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
