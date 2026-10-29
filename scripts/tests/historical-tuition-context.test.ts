import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {sql} from 'drizzle-orm';
import {createAnalyticsFixture,ids} from './analytics-database-fixture';
import {resolveHistoricalTuition} from '../../shared/historical-tuition';
import {loadFinanceHistory} from '../../server/finance-history';

const migration=fs.readFileSync(new URL('../migrations/20261029_tuition_history_context.sql',import.meta.url),'utf8');
const source=ts.createSourceFile('storage.ts',fs.readFileSync(new URL('../../server/storage.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const storage=source.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='DatabaseStorage') as ts.ClassDeclaration;
const method=storage.members.find(node=>ts.isMethodDeclaration(node)&&node.name.getText(source)==='getStudentPaymentLedger')!;
const dates=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='confirmedDateClause')!;
const code=ts.transpileModule(dates.getText(source)+'\nclass Storage {'+method.getText(source)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function ledger(db:any){return new (new Function('db','sql','resolveHistoricalTuition','loadFinanceHistory',code+';return Storage;')(db,sql,resolveHistoricalTuition,loadFinanceHistory))();}

test('the context migration has no historical backfill and can be rerun safely',async()=>{
  const f=await createAnalyticsFixture();try{
    const before=await f.pg.query('SELECT (SELECT count(*) FROM student_population_snapshots) AS snapshots,(SELECT count(*) FROM tuition_class_amounts) AS rates');
    await f.pg.exec(migration);await f.pg.exec(migration);
    assert.deepEqual((await f.pg.query('SELECT (SELECT count(*) FROM student_population_snapshots) AS snapshots,(SELECT count(*) FROM tuition_class_amounts) AS rates')).rows,before.rows);
  }finally{await f.pg.close();}
});

test('term closure records the effective type and discount and freezes the actual current class rates',async()=>{
  const f=await createAnalyticsFixture();try{
    await f.pg.exec(migration);
    await f.pg.query("UPDATE students SET discount=10,student_type='returning',student_type_flipped_term='First Term',student_type_flipped_session='2026/2027' WHERE id=$1",[f.students[0].id]);
    const store=ledger(f.db);
    const before=(await store.getStudentPaymentLedger(ids[0],undefined,'First Term','2026/2027')).entries[0];
    assert.equal(before.tuitionAssigned,90);assert.equal(before.studentType,'new');
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1",[ids[0]]);
    await f.pg.query('UPDATE students SET discount=80 WHERE id=$1',[f.students[0].id]);
    await f.pg.query('UPDATE tuition_class_amounts SET amount=999 WHERE term IS NULL AND fee_type_id IN (SELECT id FROM fee_types WHERE school_id=$1)',[ids[0]]);
    const after=(await store.getStudentPaymentLedger(ids[0],undefined,'First Term','2026/2027')).entries[0];
    assert.equal(after.tuitionKnown,true);assert.equal(after.tuitionAssigned,before.tuitionAssigned);
    assert.equal(after.studentType,'new');assert.equal(after.discount,10);assert.equal(after.discountKnown,true);
    assert.equal(after.tuitionSource,'Period-specific class rate');
  }finally{await f.pg.close();}
});

test('term closure does not replace a scoped universal rate with typed general defaults, and retains zero',async()=>{
  const f=await createAnalyticsFixture();try{
    await f.pg.exec(migration);
    await f.pg.query("INSERT INTO tuition_class_amounts(fee_type_id,class_id,amount,term,session) SELECT id,'p0',0,'First Term','2026/2027' FROM fee_types WHERE school_id=$1",[ids[0]]);
    await f.pg.query("INSERT INTO tuition_class_amounts(fee_type_id,class_id,amount,student_type) SELECT id,'p0',900,'returning' FROM fee_types WHERE school_id=$1",[ids[0]]);
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1",[ids[0]]);
    const entry=(await ledger(f.db).getStudentPaymentLedger(ids[0],undefined,'First Term','2026/2027')).entries[0];
    assert.equal(entry.tuitionKnown,true);assert.equal(entry.tuitionAssigned,0);
    const rows=(await f.pg.query("SELECT amount FROM tuition_class_amounts WHERE class_id='p0' AND term='First Term' AND session='2026/2027'")).rows;
    assert.equal(rows.length,1);assert.equal(Number(rows[0].amount),0);
  }finally{await f.pg.close();}
});

test('already-closed periods are never reconstructed from later defaults',async()=>{
  const f=await createAnalyticsFixture();try{
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1",[ids[0]]);
    await f.pg.exec(migration);
    await f.pg.query('UPDATE tuition_class_amounts SET amount=999 WHERE term IS NULL');
    await f.pg.query("SELECT sowa_capture_population($1,'First Term','2026/2027','term_end')",[ids[0]]);
    assert.equal((await f.pg.query("SELECT count(*) AS n FROM tuition_class_amounts WHERE term='First Term' AND session='2026/2027'")).rows[0].n,0);
    const entry=(await ledger(f.db).getStudentPaymentLedger(ids[0],undefined,'First Term','2026/2027')).entries[0];
    assert.equal(entry.tuitionKnown,false);assert.match(entry.tuitionReason,/exact term and session/);
  }finally{await f.pg.close();}
});
