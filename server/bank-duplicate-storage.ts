import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { bankStatements, bankTransactions, clearedDuplicatePairs, type BankTransaction, type InsertBankTransaction } from '../shared/schema';
import { isPossibleDuplicateCredit } from './bank-duplicate-match';

type DuplicateDb = Pick<typeof import('./db').db, 'select' | 'insert' | 'execute'>;

export async function findPossibleBankDuplicate(
  db: DuplicateDb,
  row: InsertBankTransaction & { id?: string; createdAt?: Date | null },
): Promise<BankTransaction | undefined> {
  if (!row.schoolId || (row.transactionType ?? 'credit') !== 'credit' || row.status === 'ignored') return;
  const day = row.transactionDate.toISOString().slice(0, 10);
  const conditions = [
    eq(bankTransactions.schoolId, row.schoolId),
    eq(bankTransactions.transactionType, 'credit'),
    ne(bankTransactions.status, 'ignored'),
    sql`${bankTransactions.amount}::numeric = ${row.amount}::numeric`,
    sql`DATE(${bankTransactions.transactionDate}) = ${day}::date`,
  ];
  if (row.id) {
    conditions.push(ne(bankTransactions.id, row.id));
    // Existing rows point strictly backwards, preventing circular pairs.
    const created = (row.createdAt ?? new Date(0)).toISOString();
    conditions.push(sql`(${bankTransactions.createdAt} < ${created}::timestamp OR (${bankTransactions.createdAt} = ${created}::timestamp AND ${bankTransactions.id} < ${row.id}))`);
  }
  const candidates = await db.select({ transaction: bankTransactions, bankFormat: bankStatements.bankFormat })
    .from(bankTransactions).leftJoin(bankStatements, eq(bankTransactions.statementId, bankStatements.id))
    .where(and(...conditions)).orderBy(asc(bankTransactions.createdAt), asc(bankTransactions.id));
  const [statement] = row.statementId
    ? await db.select({ bankFormat: bankStatements.bankFormat }).from(bankStatements).where(eq(bankStatements.id, row.statementId))
    : [];
  for (const candidate of candidates) {
    if (!isPossibleDuplicateCredit({ ...row, bankFormat: statement?.bankFormat }, { ...candidate.transaction, bankFormat: candidate.bankFormat })) continue;
    if (row.id) {
      const [a, b] = [row.id, candidate.transaction.id].sort();
      const [cleared] = await db.select({ id: clearedDuplicatePairs.id }).from(clearedDuplicatePairs).where(and(
        eq(clearedDuplicatePairs.kind, 'transaction'), eq(clearedDuplicatePairs.entityAId, a), eq(clearedDuplicatePairs.entityBId, b),
      )).limit(1);
      if (cleared) continue;
    }
    return candidate.transaction;
  }
}

// Call inside the caller's transaction. A school lock serializes concurrent
// email/statement inserts; either ordering sees the other saved credit.
// A failed comparison rolls back the insert instead of silently bypassing it.
export async function insertBankCreditWithDuplicateCheck(db: DuplicateDb, data: InsertBankTransaction): Promise<BankTransaction> {
  if (data.schoolId) await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${data.schoolId}))`);
  const duplicate = await findPossibleBankDuplicate(db, data);
  const [created] = await db.insert(bankTransactions).values({
    ...data,
    ...(duplicate ? { possibleDuplicate: true, duplicateOfTransactionId: duplicate.id } : {}),
  }).returning();
  return created;
}
