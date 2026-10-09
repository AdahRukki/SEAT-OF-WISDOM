import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drizzle} from 'drizzle-orm/pglite';
import {getTableConfig,PgDialect} from 'drizzle-orm/pg-core';
import {SQL} from 'drizzle-orm';
import {feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs} from '../../shared/schema';
import {issueStudentReceipts} from '../../server/payment-receipts';
import {sortReceipts} from '../../shared/payment-receipts';
import {buildReceiptPdf} from '../../client/src/lib/receipt-pdf';
const school='00000000-0000-4000-a000-000000000001',student='00000000-0000-4000-a000-000000000002',second='00000000-0000-4000-a000-000000000005',actor={id:'00000000-0000-4000-a000-000000000003',role:'bursar',schoolId:school};
async function fixture(){
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');const pg=new PGlite();const dialect=new PgDialect();
 for(const table of [feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs]){
  const config=getTableConfig(table);const columns=config.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${c.primary?' PRIMARY KEY':''}${c.default!==undefined?' DEFAULT '+(c.default instanceof SQL?dialect.sqlToQuery(c.default).sql:typeof c.default==='string'?"'"+c.default+"'":String(c.default)):''}`);
  await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
 }
 await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY,first_name text,last_name text);CREATE TABLE classes(id text PRIMARY KEY,name text);CREATE TABLE students(id uuid PRIMARY KEY,student_id text,user_id uuid,class_id text);CREATE TABLE schools(id uuid PRIMARY KEY,name text,address text,logo_url text);
 CREATE TABLE payment_student_receipts(id bigserial PRIMARY KEY,payment_record_id uuid,student_id uuid,school_id uuid,snapshot jsonb,issued_by uuid,UNIQUE(payment_record_id,student_id));
 INSERT INTO schools VALUES('${school}','Seat of Wisdom Academy','Asaba',null);INSERT INTO classes VALUES('c','Basic 2');INSERT INTO users VALUES('${actor.id}','Ada','Adah');INSERT INTO students VALUES('${student}','S001','${actor.id}','c'),('${second}','S002','${actor.id}','c');`);
 const db=drizzle(pg);const [payment]=await db.insert(feePaymentRecords).values({schoolId:school,studentId:null,amount:'100000',purpose:'Multiple purposes',paymentMethod:'transfer',paymentDate:new Date('2026-10-09'),confirmedAt:new Date('2026-10-09T10:00:00Z'),status:'confirmed',recordedBy:actor.id,depositorName:'Parent',term:'First Term',session:'2026/2027'}).returning();
 await db.insert(feePaymentStudentSplits).values([{paymentRecordId:payment.id,studentId:student,amount:'30000',purpose:'Tuition'},{paymentRecordId:payment.id,studentId:student,amount:'10000',purpose:'Books'},{paymentRecordId:payment.id,studentId:second,amount:'60000',purpose:'Tuition'}]);
 return {pg,db,payment,input:{schoolId:school,selections:[{paymentId:payment.id,studentId:student},{paymentId:payment.id,studentId:second}]}};
}
test('split receipts show only each student share, combine purposes and retain numbers on reprint',async()=>{
 const {pg,db,input}=await fixture();try{
  const first=await issueStudentReceipts(db,input,actor);assert.equal(first.length,2);assert.deepEqual(first.map(r=>Number(r.total)),[40000,60000]);assert.equal(first[0].items.length,2);assert.notEqual(first[0].number,first[1].number);
  await pg.exec("UPDATE users SET last_name='Changed'; UPDATE classes SET name='Basic 3'");
  const replay=await issueStudentReceipts(db,{...input,selections:[...input.selections,input.selections[0]]},actor);
  assert.deepEqual(replay,first);assert.equal((await pg.query('SELECT COUNT(*) n FROM payment_student_receipts')).rows[0].n,2);
  assert.equal((await pg.query("SELECT COUNT(*) n FROM payment_audit_logs WHERE action='reprint_receipt'")).rows[0].n,2);
 }finally{await pg.close();}
});
test('reversed, foreign-school and unrelated-student selections cannot issue receipts',async()=>{
 const {pg,db,input}=await fixture();try{
  await assert.rejects(issueStudentReceipts(db,input,{...actor,schoolId:second}),/your school/);
  await assert.rejects(issueStudentReceipts(db,{...input,selections:[{...input.selections[0],studentId:actor.id}]},actor),/no allocation/);
  await pg.exec("UPDATE fee_payment_records SET status='reversed'");
  await assert.rejects(issueStudentReceipts(db,input,actor),/no longer confirmed/);
  assert.equal((await pg.query('SELECT COUNT(*) n FROM payment_student_receipts')).rows[0].n,0);
 }finally{await pg.close();}
});
test('multiple payments for one student keep separate receipt numbers',async()=>{
 const {pg,db,input,payment}=await fixture();try{
  const [next]=await db.insert(feePaymentRecords).values({...payment,id:undefined,studentId:student,amount:'20000',purpose:'Tuition'}).returning();
  const result=await issueStudentReceipts(db,{...input,selections:[input.selections[0],{paymentId:next.id,studentId:student}]},actor);
  assert.equal(result.length,2);assert.notEqual(result[0].number,result[1].number);assert.deepEqual(result.map(r=>Number(r.total)).sort(),[20000,40000]);
 }finally{await pg.close();}
});
test('class order is natural; PDF uses three slots per A4 and long receipts continue',async()=>{
 const {pg,db,input}=await fixture();try{
  const [receipt]=await issueStudentReceipts(db,input,actor);
  const rows=['SS 2','Basic 10','JSS 1','Basic 2'].map((className,i)=>({...receipt,className,number:`SOW-${i}`}));
  assert.deepEqual(sortReceipts(rows).map(r=>r.className),['Basic 2','Basic 10','JSS 1','SS 2']);
  const pdf=buildReceiptPdf(rows);assert.equal(pdf.getNumberOfPages(),2);assert.ok(Math.abs(pdf.internal.pageSize.getHeight()-297)<0.1);
  assert.equal(buildReceiptPdf([{...receipt,items:Array.from({length:16},()=>({purpose:'Tuition',amount:'1'}))}]).getNumberOfPages(),2);
 }finally{await pg.close();}
});
test('already issued receipts cannot be reprinted after reversal or changed payment details',async()=>{
 const {pg,db,input}=await fixture();try{
  await issueStudentReceipts(db,input,actor);
  await pg.exec("UPDATE fee_payment_student_splits SET amount=amount+1");
  await assert.rejects(issueStudentReceipts(db,input,actor),/details changed/);
  await pg.exec("UPDATE fee_payment_records SET status='reversed'");
  await assert.rejects(issueStudentReceipts(db,input,actor),/no longer confirmed/);
 }finally{await pg.close();}
});
