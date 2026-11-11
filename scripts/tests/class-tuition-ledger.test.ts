import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeTuition,summarizeTuitionByClass} from '../../shared/tuition-summary';

test('class totals equal all school cards including excess payments and unverified class',()=>{
 const entries=[
  {classId:'a',className:'Basic 1',tuitionAssigned:100,tuitionPaid:120,balance:0,tuitionKnown:true},
  {classId:'a',className:'Basic 1',tuitionAssigned:100,tuitionPaid:20,balance:80,tuitionKnown:true},
  {classId:'b',className:'Basic 2',tuitionAssigned:200,tuitionPaid:40,balance:160,tuitionKnown:true},
  {classId:'',className:'Class not verified',tuitionAssigned:0,tuitionPaid:50,balance:0,tuitionKnown:false},
 ];
 const school=summarizeTuition(entries), classes=summarizeTuitionByClass(entries);
 for(const [column,total] of [['expectedTuition','totalFees'],['tuitionConfirmed','totalPaid'],['tuitionCollected','actualTuitionCollected'],['outstanding','totalOutstanding'],['studentsOwing','studentsOwing']] as const)
  assert.equal(classes.reduce((sum,row)=>sum+row[column],0),school[total]);
 assert.equal(classes.reduce((sum,row)=>sum+row.activeStudentCount,0),entries.length);
 assert.equal(classes[0].collectionRate,60);
 assert.equal(classes[2].collectionRate,null);
 assert.equal(school.collectionRate,null);
});
test('empty ledger produces no fabricated class balances',()=>assert.deepEqual(summarizeTuitionByClass([]),[]));
