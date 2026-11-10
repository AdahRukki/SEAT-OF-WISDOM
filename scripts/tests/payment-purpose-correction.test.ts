import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drizzle} from 'drizzle-orm/pglite';
import {getTableConfig,PgDialect} from 'drizzle-orm/pg-core';
import {SQL,eq} from 'drizzle-orm';
import {feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs} from '../../shared/schema';
import {correctPaymentPurpose,previewPurposeCorrection} from '../../server/payment-purpose-correction';
import {issueStudentReceipts} from '../../server/payment-receipts';
const school='00000000-0000-4000-a000-000000000001',student='00000000-0000-4000-a000-000000000002',second='00000000-0000-4000-a000-000000000005',fee='00000000-0000-4000-a000-000000000006',actor={id:'00000000-0000-4000-a000-000000000003',role:'admin',schoolId:school};
const ledger=async()=>({entries:[student,second].map(studentDbId=>({studentDbId,tuitionKnown:true,tuitionAssigned:100000}))});
async function fixture(split=false){
 const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');const pg=new PGlite();const dialect=new PgDialect();
 for(const table of [feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs]){const cfg=getTableConfig(table);await pg.exec(`CREATE TABLE ${cfg.name} (${cfg.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${c.primary?' PRIMARY KEY':''}${c.default!==undefined?' DEFAULT '+(c.default instanceof SQL?dialect.sqlToQuery(c.default).sql:typeof c.default==='string'?"'"+c.default+"'":String(c.default)):''}`).join(',')})`);}
 await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY,first_name text,last_name text,middle_name text);CREATE TABLE classes(id text PRIMARY KEY,name text);CREATE TABLE students(id uuid PRIMARY KEY,student_id text,user_id uuid,class_id text);CREATE TABLE schools(id uuid PRIMARY KEY,name text,address text,logo_url text);
 CREATE TABLE fee_types(id uuid,name text,school_id uuid,is_tuition boolean,is_active boolean);
 CREATE TABLE payment_student_receipts(id bigserial PRIMARY KEY,payment_record_id uuid,student_id uuid,school_id uuid,snapshot jsonb,issued_by uuid,UNIQUE(payment_record_id,student_id));
 CREATE TABLE payment_allocations(payment_record_id uuid,bank_transaction_id text,allocated_amount numeric);
 INSERT INTO schools VALUES('${school}','Seat of Wisdom Academy','Asaba',null);INSERT INTO classes VALUES('c','Basic 2');INSERT INTO users VALUES('${actor.id}','Ada','Adah','Grace');INSERT INTO students VALUES('${student}','S001','${actor.id}','c'),('${second}','S002','${actor.id}','c');
 INSERT INTO fee_types VALUES('${fee}','Tuition','${school}',true,true);`);
 const db=drizzle(pg);const [payment]=await db.insert(feePaymentRecords).values({schoolId:school,studentId:split?null:student,amount:'50000',purpose:'Books',paymentMethod:'transfer',paymentDate:new Date('2026-10-09'),confirmedAt:new Date('2026-10-09T10:00:00Z'),confirmedBy:actor.id,status:'confirmed',recordedBy:actor.id,depositorName:'Parent',term:'First Term',session:'2026/2027'}).returning();
 if(split)await db.insert(feePaymentStudentSplits).values([{paymentRecordId:payment.id,studentId:student,amount:'30000',purpose:null},{paymentRecordId:payment.id,studentId:second,amount:'20000',purpose:null}]);
 await pg.query('INSERT INTO payment_allocations VALUES($1,\'bank-match\',50000)',[payment.id]);
 const input={schoolId:school,selections:[{paymentId:payment.id,studentId:student},...(split?[{paymentId:payment.id,studentId:second}]:[])]};
 const request=async(amount:number)=>{const p=await previewPurposeCorrection(db,payment.id,actor,ledger),a=p.allocations.find((a:any)=>a.studentId===student&&!a.isTuition);return {allocationId:a.id,tuitionFeeTypeId:fee,amount,reason:'Recorded under Books by mistake',expectedUpdatedAt:new Date(p.payment.updatedAt).toISOString(),expectedAmount:a.amount,expectedPurpose:a.purpose};};
 return {pg,db,payment,input,request};
}
test('full correction keeps payment identity, bank allocation, confirmation and receipt number',async()=>{
 const f=await fixture();try{
  const receipts=await issueStudentReceipts(f.db,f.input,actor);const bank=await f.pg.query('SELECT * FROM payment_allocations');const req=await f.request(50000);
  await correctPaymentPurpose(f.db,f.payment.id,req,actor,ledger);
  const [p]=await f.db.select().from(feePaymentRecords);assert.equal(p.purpose,'Tuition');
  for(const k of ['id','studentId','amount','status','confirmedBy','term','session','reference','recordedBy','paymentMethod'])assert.deepEqual(p[k],f.payment[k]);
  assert.deepEqual(p.confirmedAt,f.payment.confirmedAt);assert.deepEqual(p.paymentDate,f.payment.paymentDate);assert.deepEqual(await f.pg.query('SELECT * FROM payment_allocations'),bank);
  const reprinted=await issueStudentReceipts(f.db,f.input,actor);assert.equal(reprinted[0].number,receipts[0].number);assert.equal(reprinted[0].total,receipts[0].total);assert.equal(reprinted[0].items[0].purpose,'Tuition');
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,req,actor,ledger),/changed|already tuition/);
  assert.equal((await f.db.select().from(feePaymentRecords)).length,1);
 }finally{await f.pg.close();}
});
test('partial direct correction keeps remainder under original purpose and one confirmed parent',async()=>{
 const f=await fixture();try{
  await issueStudentReceipts(f.db,f.input,actor);
  await correctPaymentPurpose(f.db,f.payment.id,await f.request(20000),actor,ledger);
  const [p]=await f.db.select().from(feePaymentRecords);assert.equal(p.studentId,null);assert.equal(p.amount,'50000.00');assert.equal(p.status,'confirmed');
  const splits=await f.db.select().from(feePaymentStudentSplits);assert.deepEqual(splits.map(s=>[s.purpose,s.amount]),[['Books','30000.00'],['Tuition','20000.00']]);
  const receipt=await issueStudentReceipts(f.db,f.input,actor);assert.equal(receipt[0].total,'50000.00');assert.equal(receipt[0].items.length,2);
 }finally{await f.pg.close();}
});
test('split correction does not change another student or legacy inherited purpose; receipt history is audited',async()=>{
 const f=await fixture(true);try{
  const old=await issueStudentReceipts(f.db,f.input,actor);await correctPaymentPurpose(f.db,f.payment.id,await f.request(10000),actor,ledger);
  const other=(await f.db.select().from(feePaymentStudentSplits)).find(s=>s.studentId===second);assert.equal(other?.amount,'20000.00');assert.equal(other?.purpose,'Books');
  const updated=await issueStudentReceipts(f.db,f.input,actor);assert.deepEqual(updated.find(r=>r.studentId===second),old.find(r=>r.studentId===second));
  assert.equal(updated.find(r=>r.studentId===student)?.total,'30000.00');
  const audit=await f.db.select().from(paymentAuditLogs);assert.equal(audit.filter(a=>a.action==='correct_receipt_purpose').length,1);assert.equal(audit.filter(a=>a.action==='correct_payment_purpose').length,1);
 }finally{await f.pg.close();}
});
test('permission, confirmation, balance, stale data and audit failures leave the payment unchanged',async()=>{
 const f=await fixture();try{
  const req=await f.request(50000);
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,req,{...actor,role:'sub-admin'},ledger),/main admin/);
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,{...req,amount:50001},actor,ledger),/exceed/);
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,req,actor,async()=>({entries:[]})),/not verified/);
  await f.db.insert(feePaymentRecords).values({...f.payment,id:undefined,status:'recorded',purpose:'Tuition',amount:'70000'});
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,req,actor,ledger),/30,000/);
  await f.pg.exec("ALTER TABLE payment_audit_logs ADD CONSTRAINT fail_audit CHECK (action <> 'correct_payment_purpose')");
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,{...req,amount:10000},actor,ledger));
  assert.equal((await f.db.select().from(feePaymentRecords).where(eq(feePaymentRecords.id,f.payment.id)))[0].studentId,student);assert.equal((await f.db.select().from(feePaymentStudentSplits)).length,0);
  await f.pg.exec('ALTER TABLE payment_audit_logs DROP CONSTRAINT fail_audit');
  await f.db.update(feePaymentRecords).set({status:'reversed'}).where(eq(feePaymentRecords.id,f.payment.id));
  await assert.rejects(correctPaymentPurpose(f.db,f.payment.id,req,actor,ledger),/confirmed/);
 }finally{await f.pg.close();}
});

test('legacy payments without a purpose keep a clear remainder and printable corrected receipt',async()=>{
 const f=await fixture();try{
  await f.db.update(feePaymentRecords).set({purpose:null}).where(eq(feePaymentRecords.id,f.payment.id));
  const old=await issueStudentReceipts(f.db,f.input,actor);
  await correctPaymentPurpose(f.db,f.payment.id,await f.request(10000),actor,ledger);
  const updated=await issueStudentReceipts(f.db,f.input,actor);
  assert.equal(updated[0].number,old[0].number);assert.ok(updated[0].items.some(i=>i.purpose==='Payment'&&Number(i.amount)===40000));
 }finally{await f.pg.close();}
});
