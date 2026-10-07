import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drizzle} from 'drizzle-orm/pglite';
import {getTableConfig,PgDialect} from 'drizzle-orm/pg-core';
import {SQL,sql} from 'drizzle-orm';
import {feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs} from '../../shared/schema';
import {recordPaymentBatch,paymentBatchSchema} from '../../server/payment-batch';
import {summarizeTuition} from '../../shared/tuition-summary';
const school='00000000-0000-4000-a000-000000000001', student='00000000-0000-4000-a000-000000000002', actor={id:'00000000-0000-4000-a000-000000000003',role:'bursar',schoolId:school};
const key='00000000-0000-4000-a000-000000000004';
const payload={schoolId:school,clientRequestId:key,paymentMethod:'transfer',paymentDate:'2026-10-06',depositorName:'Parent',reference:'Bank transfer 123',term:'First Term',session:'2026/2027',totalAmount:100000,rows:[{studentId:student,purpose:'Tuition',amount:80000},{studentId:student,purpose:'Books',amount:20000}]};
const ledger=async()=>({entries:[{studentDbId:student,tuitionKnown:true,tuitionAssigned:100000,tuitionPaid:0}]});
async function fixture(){
  const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');
  const pg=new PGlite();const dialect=new PgDialect();
  for(const table of [feePaymentRecords,feePaymentStudentSplits,paymentAuditLogs]){
    const config=getTableConfig(table);
    const columns=config.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${c.primary?' PRIMARY KEY':''}${c.default!==undefined?' DEFAULT '+(c.default instanceof SQL?dialect.sqlToQuery(c.default).sql:typeof c.default==='string'?"'"+c.default+"'":String(c.default)):''}`);
    await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
  }
  await pg.exec(`CREATE UNIQUE INDEX batch_key ON fee_payment_records(client_request_id);
    CREATE TABLE classes(id text,school_id uuid); CREATE TABLE users(id uuid,is_active boolean); CREATE TABLE students(id uuid,class_id text,user_id uuid);
    CREATE TABLE fee_types(name text,school_id uuid,is_tuition boolean);
    INSERT INTO classes VALUES ('class','${school}'); INSERT INTO users VALUES ('${actor.id}',true); INSERT INTO students VALUES ('${student}','class','${actor.id}');
    INSERT INTO fee_types VALUES ('Tuition','${school}',true),('Books','${school}',false);`);
  return {pg,db:drizzle(pg)};
}
test('one transfer saves one parent with purpose allocations and one audit atomically; replay does not duplicate',async()=>{
  const {pg,db}=await fixture();try{
    const first=await recordPaymentBatch(db,payload,actor,ledger);
    assert.equal(first.records.length,1);assert.equal(first.records[0].studentId,null);
    const splits=(await pg.query('SELECT purpose,amount FROM fee_payment_student_splits ORDER BY purpose')).rows;
    assert.deepEqual(splits.map(r=>r.purpose),['Books','Tuition']);
    assert.deepEqual(splits.map(r=>Number(r.amount)),[20000,80000]);
    assert.equal(first.records.reduce((s,r)=>s+Number(r.amount),0),100000);assert.ok(first.records.every(r=>r.status==='recorded'&&r.reference===payload.reference));
    const replay=await recordPaymentBatch(db,payload,actor,ledger);assert.equal(replay.idempotent,true);
    await assert.rejects(recordPaymentBatch(db,{...payload,totalAmount:80000,rows:[payload.rows[0]]},actor,ledger),/different details|already in use/);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM fee_payment_records')).rows[0].n,1);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM payment_audit_logs')).rows[0].n,1);
    await assert.rejects(recordPaymentBatch(db,{...payload,rows:[{...payload.rows[0],amount:100000}]},actor,ledger),/different details|already in use/);
  }finally{await pg.close();}
});
test('tuition checks include pending payments and excess never becomes miscellaneous',async()=>{
  const {pg,db}=await fixture();try{
    await recordPaymentBatch(db,payload,actor,ledger);
    const more={...payload,clientRequestId:'00000000-0000-4000-a000-000000000005',totalAmount:30000,rows:[{studentId:student,purpose:'Tuition',amount:30000}]};
    await assert.rejects(recordPaymentBatch(db,more,actor,ledger),/exceeds.*10,000/);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM fee_payment_records')).rows[0].n,1);
    await pg.exec("UPDATE fee_payment_records SET status='confirmed'");
    await assert.rejects(recordPaymentBatch(db,more,actor,ledger),/exceeds.*10,000/);
    const allowed={...more,totalAmount:20000,rows:[{...more.rows[0],amount:20000}]};
    await recordPaymentBatch(db,allowed,actor,ledger);
    assert.equal((await pg.query("SELECT SUM(amount) AS n FROM fee_payment_student_splits WHERE purpose='Tuition'")).rows[0].n,'100000.00');
  }finally{await pg.close();}
});
test('a failure on the second row rolls back the first record and its audit',async()=>{
  const {pg,db}=await fixture();try{
    await pg.exec("ALTER TABLE fee_payment_student_splits ADD CONSTRAINT fail_books CHECK (purpose <> 'Books')");
    await assert.rejects(recordPaymentBatch(db,payload,actor,ledger));
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM fee_payment_records')).rows[0].n,0);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM payment_audit_logs')).rows[0].n,0);
  }finally{await pg.close();}
});
test('school access, inactive students and unknown tuition block the complete batch',async()=>{
  const {pg,db}=await fixture();try{
    await assert.rejects(recordPaymentBatch(db,payload,{...actor,schoolId:'another'},ledger),/your school/);
    await assert.rejects(recordPaymentBatch(db,payload,actor,async()=>({entries:[]})),/not verified/);
    await pg.exec('UPDATE users SET is_active=false');
    await assert.rejects(recordPaymentBatch(db,payload,actor,ledger),/inactive/);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM fee_payment_records')).rows[0].n,0);
  }finally{await pg.close();}
});
test('row validation uses cents, requires a purpose and rejects duplicate student-purpose rows',()=>{
  assert.equal(paymentBatchSchema.safeParse({...payload,totalAmount:0.3,rows:[{...payload.rows[0],amount:0.1},{...payload.rows[1],amount:0.2}]}).success,true);
  for(const bad of [{...payload,totalAmount:99999},{...payload,rows:[{...payload.rows[0],purpose:' '} ]},{...payload,totalAmount:160000,rows:[payload.rows[0],payload.rows[0]]},{...payload,totalAmount:1.001,rows:[{...payload.rows[0],amount:1.001}]}])assert.equal(paymentBatchSchema.safeParse(bad).success,false);
});
test('tuition cards exclude other purposes, distinguish unverified charges, and cap collection rate',()=>{
  const summary=summarizeTuition([{tuitionAssigned:100000,tuitionPaid:80000,tuitionKnown:true,studentType:'new',totalPaid:100000} as any,{tuitionAssigned:10000,tuitionPaid:12000,tuitionKnown:true},{tuitionAssigned:0,tuitionPaid:5000,tuitionKnown:false}]);
  assert.equal(summary.totalPaid,97000);assert.equal(summary.totalFees,110000);assert.equal(summary.totalOutstanding,20000);assert.equal(summary.actualTuitionCollected,90000);assert.equal(summary.collectionRate,82);assert.equal(summary.studentsOwing,1);assert.equal(summary.tuitionUnverifiedCount,1);
});
test('a transfer across two students still creates only one confirmation record',async()=>{
  const {pg,db}=await fixture();try{
    const second='00000000-0000-4000-a000-000000000006';
    await pg.exec(`INSERT INTO students VALUES ('${second}','class','${actor.id}')`);
    const input={...payload,rows:[{studentId:student,purpose:'Books',amount:40000},{studentId:second,purpose:'Books',amount:60000}]};
    const saved=await recordPaymentBatch(db,input,actor,ledger);
    assert.equal(saved.records.length,1);assert.equal(Number(saved.records[0].amount),100000);
    assert.equal((await pg.query('SELECT COUNT(DISTINCT student_id) AS n FROM fee_payment_student_splits')).rows[0].n,2);
    assert.equal((await recordPaymentBatch(db,input,actor,ledger)).idempotent,true);
  }finally{await pg.close();}
});
test('legacy child batch retries never create a new parent transfer',async()=>{
  const {pg,db}=await fixture();try{
    for(const [i,row] of payload.rows.entries()) await db.insert(feePaymentRecords).values({...row,amount:row.amount.toFixed(2),schoolId:school,recordedBy:actor.id,paymentMethod:payload.paymentMethod,paymentDate:new Date(payload.paymentDate),reference:payload.reference,depositorName:payload.depositorName,term:payload.term,session:payload.session,clientRequestId:`batch:${key}:${i}`});
    const replay=await recordPaymentBatch(db,payload,actor,ledger);
    assert.equal(replay.idempotent,true);assert.equal(replay.records.length,2);
    assert.equal((await pg.query('SELECT COUNT(*) AS n FROM fee_payment_student_splits')).rows[0].n,0);
  }finally{await pg.close();}
});
