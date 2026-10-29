import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTuitionRateUpdate } from '../../server/tuition-rate-updates';
const current={currentTerm:'First Term',currentSession:'2026/2027'};
const historical={term:'Third Term',session:'2025/2026',amounts:[{classId:'old',amount:'55000'}]};
test('historical rate corrections require explicit verification and a recorded source',()=>{
  assert.throws(()=>parseTuitionRateUpdate(historical,current),/Confirm the historical rate/);
  assert.throws(()=>parseTuitionRateUpdate({...historical,verifiedHistoricalRate:true,verificationReason:'guess'},current));
  const approved=parseTuitionRateUpdate({...historical,verifiedHistoricalRate:true,verificationReason:'Reviewed approved fee schedule for Third Term'},current);
  assert.equal(approved.amounts[0].amount,'55000.00');assert.equal(approved.term,'Third Term');
});
test('rates retain explicit zero and reject incomplete scopes, invalid amounts and duplicate type keys',()=>{
  assert.equal(parseTuitionRateUpdate({amounts:[{classId:'new',amount:'0'}]},current).amounts[0].amount,'0.00');
  for(const payload of [{term:'First Term',amounts:[]},{session:'2026/2027',amounts:[]},{amounts:[{classId:'x',amount:-1}]},{amounts:[{classId:'x',amount:''}]},{amounts:[{classId:'x',amount:'1.234'}]},{amounts:[{classId:'x',amount:1},{classId:'x',amount:2}]}]) assert.throws(()=>parseTuitionRateUpdate(payload,current));
});
