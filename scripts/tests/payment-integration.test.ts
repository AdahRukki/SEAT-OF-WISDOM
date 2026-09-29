import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordFeePaymentSchema, recordMultiStudentPaymentSchema, feePaymentRecords, feePaymentStudentSplits } from '../../shared/schema';
import { and, eq, ne, sql, asc } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import fs from 'node:fs';
const valid = {studentId:'student-a',amount:6000,paymentMethod:'transfer',paymentDate:'2026-09-29',purpose:'Tuition',depositorName:'Parent',term:'First Term',session:'2026/2027'};
test('payment validation accepts real calendar dates and exact decimal amounts',()=>{
  for(const amount of [0.01,6000,1234567.89,9999999999.99]) assert.equal(recordFeePaymentSchema.safeParse({...valid,amount}).success,true,String(amount));
  assert.equal(recordFeePaymentSchema.safeParse({...valid,paymentDate:'2028-02-29'}).success,true);
});
test('payment validation rejects invalid dates, empty required fields and invalid amounts',()=>{
  for(const paymentDate of ['2026-02-29','2026-09-31','29/09/2026','2026-09-29T00:00:00Z']) assert.equal(recordFeePaymentSchema.safeParse({...valid,paymentDate}).success,false,paymentDate);
  for(const amount of [0,-1,Infinity,NaN,10000000000,100.001]) assert.equal(recordFeePaymentSchema.safeParse({...valid,amount}).success,false,String(amount));
  for(const field of ['purpose','depositorName','term','session']) assert.equal(recordFeePaymentSchema.safeParse({...valid,[field]:'   '}).success,false,field);
});
test('split payment schema shares the validated date and amount rules',()=>{
  const data={...valid,schoolId:'school',amount:3000.03,entries:[{studentId:'a',amount:1000.01},{studentId:'b',amount:2000.02}]};
  assert.equal(recordMultiStudentPaymentSchema.safeParse(data).success,true);
  assert.equal(recordMultiStudentPaymentSchema.safeParse({...data,entries:[{studentId:'a',amount:1.001},{studentId:'b',amount:2}]}).success,false);
});

// Exercise the actual storage methods with a capturing DB adapter: three
// duplicate lookups must retain purpose, amount, date and reversal predicates.
const storageText=fs.readFileSync(new URL('../../server/storage.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('storage.ts',storageText,ts.ScriptTarget.Latest,true);
const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage') as ts.ClassDeclaration;
const methods=cls.members.filter(n=>ts.isMethodDeclaration(n)&&['recordFeePayment','createFeePaymentWithSplits'].includes(n.name.getText(ast))).map(n=>n.getText(ast)).join('\n');
const compiled=ts.transpileModule('class CaptureStorage {'+methods+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function duplicateQueries(purpose: string | null, split: boolean) {
  const captured: any[]=[];
  const stored={...valid,id:'new-record',schoolId:'school',purpose,amount:'6000',paymentDate:new Date('2026-09-29'),createdAt:new Date()};
  const chain:any={from:()=>chain,innerJoin:()=>chain,where:(value:any)=>{captured.push(new PgDialect().sqlToQuery(value));return chain;},orderBy:()=>chain,limit:async()=>[]};
  const db:any={select:()=>chain,insert:()=>({values:()=>({returning:async()=>[stored]})}),transaction:async(fn:any)=>fn(db)};
  const Storage=new Function('db','feePaymentRecords','feePaymentStudentSplits','and','eq','ne','sql','asc',compiled+'; return CaptureStorage;')(db,feePaymentRecords,feePaymentStudentSplits,and,eq,ne,sql,asc);
  if(split) await new Storage().createFeePaymentWithSplits(stored,[{studentId:'a',amount:6000}]);
  else await new Storage().recordFeePayment(stored);
  return captured;
}
test('single and both split duplicate lookups require the same purpose',async()=>{
  for(const split of [false,true]) {
    const queries=await duplicateQueries('Books',split);
    assert.equal(queries.length,split?2:1);
    for(const query of queries){assert.match(query.sql,/"purpose" =/);assert.ok(query.params.includes('Books'));assert.ok(query.params.includes('reversed'));assert.match(query.sql,/DATE\(/);assert.match(query.sql,/::numeric/);}
  }
});
test('legacy null purposes use IS NULL rather than matching another purpose',async()=>{
  for(const query of await duplicateQueries(null,true)) assert.match(query.sql,/"purpose" IS NULL/);
});
