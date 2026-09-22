import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { firstPaymentStudents, inConfirmationRange, type LedgerPayment } from '../../shared/ledger-payments';
import { buildLedgerWorkbook } from '../../client/src/lib/ledger-workbook';
const from = '2026-09-20T23:00:00.000Z';
const to = '2026-09-21T23:00:00.000Z';
const record = (studentDbId: string, confirmedAt: string | null, overrides: Partial<LedgerPayment> = {}): LedgerPayment => ({
  id: 'allocation-' + studentDbId, paymentRecordId: 'payment-1', studentDbId, confirmedAt,
  amount: '1000.00', status: 'confirmed', paymentDate: '2026-09-21T00:00:00Z', createdAt: from,
  purpose: 'Tuition', reference: 'REF123', paymentMethod: 'transfer', term: 'First Term', session: '2026/2027', isSplit: false, ...overrides,
});
test('Nigerian date range includes midnight start but excludes next midnight', () => {
  assert.equal(inConfirmationRange(from, from, to), true);
  assert.equal(inConfirmationRange('2026-09-20T22:59:59Z', from, to), false);
  assert.equal(inConfirmationRange(to, from, to), false);
  assert.equal(inConfirmationRange(null, from, to), false);
  assert.equal(inConfirmationRange(null), true);
});
test('first payment is determined before narrowing by date, across split and direct payments', () => {
  const rows = [record('old', from), record('old','2026-09-01T10:00:00Z',{isSplit:true}), record('new',from,{isSplit:true}), record('new','2026-09-21T10:00:00Z')];
  assert.deepEqual([...firstPaymentStudents(rows,from,to)],['new']);
});
test('missing historical confirmation times do not create false first payments', () => {
  assert.equal(firstPaymentStudents([record('unknown',null),record('unknown',from)],from,to).size,0);
});
test('reversed and pending records cannot establish the first confirmed payment', () => {
  assert.deepEqual([...firstPaymentStudents([record('a','2026-09-01T10:00:00Z',{status:'reversed'}),record('a',from)],from,to)],['a']);
});
test('workbook retains student split amounts and matching numeric totals after serialization', () => {
  const entries = [{studentDbId:'a',studentId:'SOWA001',firstName:'Ada',lastName:'Test',className:'JSS1',studentType:'new',totalPaid:3000,tuitionAssigned:10000,totalAssigned:10000,discount:0,balance:7000}];
  const records = [record('a',from,{amount:'3000.00',isSplit:true,reference:'=1+1'}),record('b',from,{amount:'7000.00',isSplit:true})];
  const workbook = buildLedgerWorkbook(entries,records,{School:'Test'},true);
  const read = XLSX.read(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
  assert.deepEqual(read.SheetNames,['Ledger summary','Payment records','Filters and totals']);
  const details = XLSX.utils.sheet_to_json<any>(read.Sheets['Payment records']);
  assert.equal(details.length,1); assert.equal(details[0]['Student amount (NGN)'],3000);
  assert.equal(details[0]['Reference'],'=1+1');
  assert.equal(read.Sheets['Payment records']['J2'].f,undefined);
  assert.match(details[0]['Confirmed at (WAT)'],/21 Sept 2026.*00:00:00/);
  const summary = XLSX.utils.sheet_to_json<any>(read.Sheets['Ledger summary'])[0];
  assert.equal(summary['Confirmed in range (NGN)'],3000); assert.equal(summary['Outstanding fees (NGN)'],undefined);
  const totals = XLSX.utils.sheet_to_json<any>(read.Sheets['Filters and totals']);
  assert.equal(totals.find(row=>row.Filter==='Records total (NGN)').Value,3000);
  assert.equal(totals.find(row=>row.Filter==='Summary total (NGN)').Value,3000);
});
test('unpaid students can export with an empty, headed payment sheet', () => {
  const entry = {studentDbId:'a',studentId:'SOWA001',firstName:'Ada',lastName:'Test',className:'JSS1',studentType:'returning',totalPaid:0,tuitionAssigned:10000,totalAssigned:10000,discount:0,balance:10000};
  const wb = buildLedgerWorkbook([entry],[],{},false);
  assert.equal(wb.Sheets['Payment records'].A1.v,'Student ID');
  assert.equal(XLSX.utils.sheet_to_json<any>(wb.Sheets['Ledger summary'])[0]['Outstanding fees (NGN)'],10000);
});

import fs from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
function ledgerHandler(storage: any, getLedgerPayments: any) {
  const source = ts.createSourceFile('routes.ts', fs.readFileSync(new URL('../../server/routes.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let handler: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && node.arguments[0]?.getText(source) === '"/api/payments/ledger"') {
      assert.equal(node.arguments[1].getText(source), 'authenticate');
      assert.equal(node.arguments[2].getText(source), 'requireBursarOrAdmin');
      handler = node.arguments[node.arguments.length - 1];
    }
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(handler);
  const code = ts.transpileModule('const handler = ' + handler.getText(source) + ';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function('storage','getLedgerPayments','firstPaymentStudents','inConfirmationRange','z', code + '; return handler;')(storage,getLedgerPayments,firstPaymentStudents,inConfirmationRange,z);
}
test('ledger API keeps bursar school scope, filters first-payment students and reconciles export amounts', async () => {
  const calls: string[] = [];
  const handler = ledgerHandler({getStudentPaymentLedger: async (schoolId: string) => {
    calls.push(schoolId); return {entries:[{studentDbId:'new',totalPaid:999,totalAssigned:10000},{studentDbId:'old',totalPaid:900,totalAssigned:10000}],meta:{}};
  }}, async (schoolId: string) => {
    calls.push(schoolId); return [record('new',from,{amount:'3000'}),record('old','2026-09-01T10:00:00Z'),record('old',from)];
  });
  let body: any;
  await handler({user:{role:'bursar',schoolId:'allowed'},query:{schoolId:'other-school',term:'First Term',session:'2026/2027',confirmedFrom:'2026-09-21',confirmedTo:'2026-09-21',firstPaymentOnly:'true',includeRecords:'true'}},{json:(value:any)=>body=value,status:()=>{throw Error('Unexpected status');}});
  assert.deepEqual(calls,['allowed','allowed']);
  assert.equal(body.entries.length,1); assert.equal(body.entries[0].studentDbId,'new');
  assert.equal(body.entries[0].totalPaid,3000); assert.equal(body.entries[0].balance,7000);
  assert.equal(body.paymentRecords.length,1); assert.equal(body.paymentRecords[0].studentDbId,'new');
});
test('ledger API rejects first-payment filtering without a date range before querying', async () => {
  const handler = ledgerHandler({getStudentPaymentLedger:()=>{throw Error('Must not query');}},()=>{throw Error('Must not query');});
  let status=0;
  const res={status:(value:number)=>{status=value;return res;},json:()=>{}};
  await handler({user:{role:'admin'},query:{schoolId:'a',term:'First Term',session:'2026/2027',firstPaymentOnly:'true'}},res);
  assert.equal(status,400);
});
