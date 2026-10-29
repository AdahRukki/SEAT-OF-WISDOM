import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveHistoricalTuition, type FinanceStudent} from '../../shared/historical-tuition';
const period={term:'First Term',session:'2026/2027'};
const student:FinanceStudent={studentDbId:'student',schoolId:'school',classId:'class',studentType:'new',discount:20,paymentCount:0,savedTuition:null,
  flippedTerm:'Third Term',flippedSession:'2025/2026'};
const snapshot={...period,snapshotKind:'baseline',students:[{studentId:'student',classId:'class',className:'JSS 1',historicalClassVerified:true,status:'active',discount:10,studentType:'returning'}]};
test('open current periods use current type/discount; an earlier baseline does not freeze mutable current settings',()=>{
  const result=resolveHistoricalTuition({student,schoolId:'school',period,currentPeriod:period,snapshots:[snapshot],rates:[
    {classId:'class',amount:100,studentType:'new'},{classId:'class',amount:80,studentType:'returning'},
  ]});
  assert.equal(result.studentType,'new');assert.equal(result.discount,20);assert.equal(result.tuitionAssigned,80);
});
test('unattributed class movement in a historical period does not become a guessed class rate',()=>{
  const result=resolveHistoricalTuition({student:{...student,paymentCount:1},schoolId:'school',period,snapshots:[snapshot],
    events:[{studentId:'student',schoolId:'school',eventType:'class_change',...period,periodVerified:false,previousData:{classId:'class'},newData:{classId:'different'}}],
    rates:[{classId:'class',amount:100,...period}]});
  assert.equal(result.tuitionKnown,false);assert.match(result.tuitionReason!,/Conflicting historical classes/);
});
test('invalid recorded historical discounts cannot silently become a verified zero deduction',()=>{
  const result=resolveHistoricalTuition({student:{...student,paymentCount:1},schoolId:'school',period,
    snapshots:[{...snapshot,snapshotKind:'term_end',students:[{...snapshot.students[0],discount:-10}]}],rates:[{classId:'class',amount:100,...period}]});
  assert.equal(result.tuitionKnown,false);assert.match(result.tuitionReason!,/historical discount is invalid/);
});
