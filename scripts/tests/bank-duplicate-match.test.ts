import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { bankStatements, bankTransactions, clearedDuplicatePairs } from '../../shared/schema';
import { isPossibleDuplicateCredit } from '../../server/bank-duplicate-match';
import { findPossibleBankDuplicate, insertBankCreditWithDuplicateCheck } from '../../server/bank-duplicate-storage';

const schoolId = '00000000-0000-4000-8000-000000000002';
const base = { schoolId, transactionDate: new Date('2026-10-12'), amount: '20000.00',
  rawDescription: 'TRF CHIKA To SCHOOL|Transfer from CHIKA OKAFOR', emailFrom: 'ibanking@fidelitybank.ng' };

test('different channel codes, punctuation, spacing and name order still flag a possible duplicate', () => {
  assert.equal(isPossibleDuplicateCredit(base, { ...base, rawDescription: 'MOBILE TRANSFER FROM OKAFOR CHIKA / REF987654321' }), true);
  assert.equal(isPossibleDuplicateCredit(base, { ...base, rawDescription: 'INSTANT PAYMENT TRF CHIKA To SCHOOL|Transfer from CHIKA OKAFOR / 123456789' }), true);
});
test('truncated names and single explicit senders can be reviewed without requiring identical narrations', () => {
  assert.equal(isPossibleDuplicateCredit(base, { ...base, rawDescription: 'TRF CHIKA To SCHOOL|Transfer from CHIKA OKAF' }), true);
  assert.equal(isPossibleDuplicateCredit({ ...base, rawDescription: 'TRF HAPPINESS To SCHOOL|ussd transfer' },
    { ...base, rawDescription: 'INSTANT PAYMENT TRF HAPPINESS To SCHOOL|ussd transfer / 987654321' }), true);
});
test('same recipient, amount or generic transfer text is insufficient', () => {
  assert.equal(isPossibleDuplicateCredit(base, { ...base, rawDescription: 'TRF CHINWE To SCHOOL|Transfer from CHINWE EZE' }), false);
  assert.equal(isPossibleDuplicateCredit({ ...base, rawDescription: 'NIP TRANSFER' }, { ...base, rawDescription: 'NIP TRANSFER' }), false);
});
test('school, amount, date, bank, account, reference and debit conflicts do not flag', () => {
  for (const difference of [
    { schoolId: 'another-school' }, { schoolId: null }, { amount: '20001' },
    { transactionDate: new Date('2026-10-13') }, { transactionType: 'debit' }, { status: 'ignored' },
    { emailFrom: 'no_reply@accessbankplc.com' }, { smsAccount: '******9999' }, { reference: 'OTHER123' },
  ]) assert.equal(isPossibleDuplicateCredit({ ...base, smsAccount: '******0025', reference: 'REF123' },
    { ...base, smsAccount: '******0025', reference: 'REF123', ...difference }), false, JSON.stringify(difference));
});
test('matching references can flag changed descriptions, without automatically discarding either payment', () => {
  assert.equal(isPossibleDuplicateCredit({ ...base, reference: 'ABC-123' }, { ...base, rawDescription: 'Transfer received', reference: 'ABC123' }), true);
});

test('database insertion checks both arrival orders, exact uniqueness and cleared-pair rescans', async () => {
  const pg = new PGlite();
  try {
    for (const table of [bankStatements, bankTransactions, clearedDuplicatePairs]) {
      const config = getTableConfig(table);
      const columns = config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${column.isUnique ? ' UNIQUE' : ''}${column.default !== undefined ? ' DEFAULT ' + (typeof column.default === 'object' ? new PgDialect().sqlToQuery(column.default as any).sql : typeof column.default === 'string' ? "'" + column.default.replaceAll("'", "''") + "'" : column.default) : ''}`);
      await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
    }
    const db = drizzle(pg);
    // Same PostgreSQL SQL, with the PGlite adapter used only in this fixture.
    const save = (data: any) => db.transaction(tx => insertBankCreditWithDuplicateCheck(tx as any, data));
    const [statement] = await db.insert(bankStatements).values({ fileName: 'fixture.pdf', fileType: 'pdf', bankFormat: 'fidelity', schoolId, uploadedBy: schoolId }).returning();
    const email = await save({ ...base, source: 'email', fingerprint: 'email-balance-key' });
    const uploaded = await save({ ...base, emailFrom: null, source: 'statement', statementId: statement.id,
      rawDescription: 'MOBILE TRANSFER FROM OKAFOR CHIKA / REF987654321', fingerprint: 'statement-without-balance' });
    assert.equal(uploaded.possibleDuplicate, true);
    assert.equal(uploaded.duplicateOfTransactionId, email.id);
    assert.equal((await db.select().from(bankTransactions)).length, 2, 'possible match is retained for review');
    await assert.rejects(save({ ...base, fingerprint: 'email-balance-key' }));

    const firstStatement = await save({ ...base, amount: '30000', source: 'statement', statementId: statement.id, fingerprint: 'statement-first' });
    const laterEmail = await save({ ...base, amount: '30000', source: 'email', fingerprint: 'email-second' });
    assert.equal(laterEmail.duplicateOfTransactionId, firstStatement.id);

    await db.update(bankTransactions).set({ possibleDuplicate: false, duplicateOfTransactionId: null }).where(eq(bankTransactions.id, uploaded.id));
    const [entityAId, entityBId] = [uploaded.id, email.id].sort();
    await db.insert(clearedDuplicatePairs).values({ kind: 'transaction', entityAId, entityBId });
    assert.equal(await findPossibleBankDuplicate(db as any, uploaded), undefined, 'rescan honours Not a duplicate');

    const otherBank = await save({ ...base, emailFrom: 'no_reply@accessbankplc.com', source: 'email', fingerprint: 'other-bank' });
    assert.equal(otherBank.possibleDuplicate, false);
    // A query failure must abort the transaction rather than insert unreviewed.
    const before = (await db.select().from(bankTransactions)).length;
    await assert.rejects(db.transaction(async tx => {
      const failingDb = { select() { throw new Error('comparison unavailable'); }, insert: tx.insert.bind(tx), execute: tx.execute.bind(tx) };
      await insertBankCreditWithDuplicateCheck(failingDb as any, { ...base, fingerprint: 'must-not-save' });
    }));
    assert.equal((await db.select().from(bankTransactions)).length, before);
  } finally {
    await pg.close();
  }
});
