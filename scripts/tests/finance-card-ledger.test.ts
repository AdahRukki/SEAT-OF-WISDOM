import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTuition } from '../../shared/tuition-summary';

const entry = (charge:number, paid:number, balance:number, studentType='returning', tuitionKnown=true) =>
  ({tuitionAssigned:charge,tuitionPaid:paid,balance,studentType,tuitionKnown});

test('all five card totals agree with ledger balances; overpayments cannot settle another student', () => {
  const rows=[entry(50000,60000,0,'new'),entry(50000,20000,30000),entry(10000,0,10000,'unknown')];
  const s=summarizeTuition(rows);
  assert.equal(s.totalFees,110000);
  assert.equal(s.totalPaid,80000);
  assert.equal(s.actualTuitionCollected,70000);
  assert.equal(s.totalOutstanding,rows.reduce((sum,row)=>sum+row.balance,0));
  assert.equal(s.studentsOwing,2);
  assert.equal(s.collectionRate,64);
  assert.equal(s.totalFees-s.actualTuitionCollected,s.totalOutstanding);
  assert.equal(s.typeBreakdown.unknown.totalFees,10000);
});
test('summary consumes the supplied ledger balance rather than recalculating it',()=>{
  assert.equal(summarizeTuition([entry(100,20,60)]).totalOutstanding,60);
});
test('unverified charges stay excluded and block a misleading collection rate',()=>{
  const s=summarizeTuition([entry(100,20,80),entry(0,50,0,'new',false)]);
  assert.equal(s.totalOutstanding,80);assert.equal(s.totalPaid,70);
  assert.equal(s.tuitionUnverifiedCount,1);assert.equal(s.collectionRate,null);
});
test('currency rounding and zero charges retain the ledger identity',()=>{
  const s=summarizeTuition([entry(100.1,20.05,80.05),entry(0,5,0)]);
  assert.equal(s.totalOutstanding,80.05);assert.equal(s.actualTuitionCollected,20.05);
  assert.equal(s.studentsOwing,1);
});
