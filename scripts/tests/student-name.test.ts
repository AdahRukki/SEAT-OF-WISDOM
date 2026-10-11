import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatStudentName} from '../../shared/student-name';
test('student names retain all parts, accents and hyphens in surname-first order',()=>{
 assert.equal(formatStudentName({firstName:' Ada ',middleName:' Chidinma-Grace ',lastName:' Éze '}),'Éze Ada Chidinma-Grace');
});
test('legacy students without middle names and unavailable profiles remain readable',()=>{
 assert.equal(formatStudentName({firstName:'Ada',lastName:'Eze',middleName:null}),'Eze Ada');
 assert.equal(formatStudentName({firstName:'Ada',lastName:'Eze',middleName:'  '}),'Eze Ada');
 assert.equal(formatStudentName(null),'');
});
