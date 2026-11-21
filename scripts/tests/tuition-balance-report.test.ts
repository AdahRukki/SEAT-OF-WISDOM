import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { buildTuitionBalanceReport } from '../../client/src/lib/tuition-balance-report';
import type { LedgerResponse } from '../../client/src/components/payment-ledger';
type Entry = LedgerResponse['entries'][number];
const entry = (overrides: Partial<Entry> = {}): Entry => ({
  studentDbId: 's1', studentId: 'SOWA/1', firstName: 'Ada', middleName: 'Joy', lastName: 'Okoro',
  classId: 'c1', className: 'Basic 1', parentWhatsapp: null, studentType: 'new',
  totalPaid: 45000, tuitionPaid: 20000, nonTuitionPaid: 25000, tuitionKnown: true,
  discountKnown: true, tuitionSource: 'saved', totalAssigned: 50000, tuitionAssigned: 50000,
  discount: 0, balance: 30000, paymentCount: 2, lastPaymentDate: null, ...overrides,
});
const scope = { school: 'Bonsaac', term: 'First Term', session: '2026/2027' };
async function xml(rows: Entry[]) {
  const blob = await buildTuitionBalanceReport(rows, scope, new Map([['c2', 0], ['c1', 1]]));
  assert.ok(blob);
  return (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
}
test('Word report uses ledger balance, not total paid subtraction, and full names', async () => {
  const text = await xml([entry()]);
  assert.match(text, /Okoro Ada Joy/);
  assert.match(text, /30,000/);
  assert.doesNotMatch(text, />5,000</);
  assert.match(text, /20,000/);
});
test('excludes zero payments, fully paid, inactive and unverified rows', async () => {
  assert.equal(await buildTuitionBalanceReport([
    entry({ totalPaid: 0 }), entry({ balance: 0 }), entry({ accountActive: false }), entry({ tuitionKnown: false }),
  ], scope, new Map()), null);
});
test('includes other-fee payers without using those fees to reduce tuition', async () => {
  const text = await xml([entry({ tuitionPaid: 0, totalPaid: 5000, balance: 50000 })]);
  assert.match(text, /50,000/);
});
test('groups by class order and sorts student names within each class', async () => {
  const text = await xml([entry({ firstName: 'Zoe' }), entry(), entry({ classId: 'c2', className: 'Nursery', firstName: 'Ben' })]);
  assert.ok(text.indexOf('Nursery') < text.indexOf('Basic 1'));
  assert.ok(text.indexOf('Ada Joy') < text.indexOf('Zoe Joy'));
});
