import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityChanges,activitySubject,activityValue} from '../../shared/activity-display';
test('shows changed fields, leaves out unchanged fields and formats account access',()=>{
 assert.deepEqual(activityChanges({firstName:'Ada',isActive:true},{firstName:'Ada',isActive:false}),[{field:'Account access',before:'Enabled',after:'Disabled'}]);
});
test('missing history is distinguished from cleared values',()=>{
 assert.deepEqual(activityChanges(null,{middleName:null}),[{field:'Middle name',before:'Not recorded',after:'Not set'}]);
});
test('nested secrets are never displayed, including arrays',()=>{
 const result=activityChanges(null,{password:'secret',user:{accessToken:'secret',firstName:'Ada'},items:[{passwordHash:'secret',amount:20000}]});
 assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(result.length,2);
 assert.match(result[1].after,/20,000/);
});
test('subjects use recorded names and do not invent names from IDs',()=>{
 assert.equal(activitySubject(null,{firstName:'Faith',middleName:'Elohor',lastName:'Adah'}),'Faith Elohor Adah');
 assert.equal(activitySubject(null,{studentId:'abc'}),'');
});
test('payment status and timestamps are readable',()=>{
 assert.equal(activityValue('status','recorded'),'Awaiting confirmation');
 assert.match(activityValue('confirmedAt','2026-11-11T09:00:00.000Z'),/10:00:00 WAT/);
});
