// PGLITE_TEST_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --import tsx --test scripts/tests/ledger-corrections.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {sql} from 'drizzle-orm';
import {PgDialect} from 'drizzle-orm/pg-core';
import {buildLedgerWorkbook} from '../../client/src/lib/ledger-workbook';
import * as XLSX from 'xlsx';
const source=fs.readFileSync(new URL('../../server/storage.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('storage.ts',source,ts.ScriptTarget.Latest,true);
const cls=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage') as ts.ClassDeclaration;
const methods=cls.members.filter(n=>ts.isMethodDeclaration(n)&&['getStudentPaymentLedger','buildTuitionResolver','reviewNameChangeRequest'].includes(n.name.getText(ast))).map(n=>n.getText(ast)).join('\n');
const dates=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='confirmedDateClause')!;
const compiled=ts.transpileModule(dates.getText(ast)+'\nclass Storage {'+methods+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
async function fixture(){
  const {PGlite}=await import(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
  const pg=new PGlite();
  await pg.exec(`
    CREATE TABLE users (id text PRIMARY KEY,first_name text NOT NULL,last_name text NOT NULL,is_active boolean,school_id text,middle_name text,updated_at timestamp);
    CREATE TABLE students (id text PRIMARY KEY,user_id text,student_id text,class_id text,parent_whatsapp text,discount numeric,student_type text,student_type_flipped_term text,student_type_flipped_session text);
    CREATE TABLE classes (id text PRIMARY KEY,name text,school_id text);
    CREATE TABLE fee_types (id text PRIMARY KEY,name text,school_id text,is_tuition boolean,is_active boolean,created_at timestamp);
    CREATE TABLE student_fees (student_id text,fee_type_id text,amount numeric,term text,session text);
    CREATE TABLE fee_payment_records (id text PRIMARY KEY,student_id text,school_id text,status text,amount numeric,purpose text,term text,session text,payment_date timestamp,confirmed_at timestamp);
    CREATE TABLE fee_payment_student_splits (student_id text,payment_record_id text,amount numeric,purpose text);
    CREATE TABLE promotion_records (student_id text,school_id text,session text,from_class_id text,is_bulk boolean);
    CREATE TABLE student_name_change_requests (id text PRIMARY KEY,status text,reviewed_by text,reviewer_notes text,reviewed_at timestamp);
    INSERT INTO student_name_change_requests VALUES ('request','pending',null,null,null);
    CREATE TABLE assessments (student_id text,class_id text,term text,session text);
    INSERT INTO classes VALUES ('old','JSS1','school'),('new','JSS2','school'),('foreign','Other','other');
    INSERT INTO users VALUES ('u','Ada','Oldname',true,'school',null,NOW());
    INSERT INTO students VALUES ('s','u','SOWA1','new',null,5000,'returning',null,null);
    INSERT INTO fee_types VALUES ('tuition','Tuition','school',true,true,NOW()),('books','Books','school',false,true,NOW());
    INSERT INTO fee_payment_records VALUES
      ('tuition-direct','s','school','confirmed',70000,'Tuition','First Term','2026/2027','2026-09-29','2026-09-29 12:00'),
      ('books','s','school','confirmed',20000,'Books','First Term','2026/2027','2026-09-29','2026-09-29 12:00'),
      ('split',null,'school','confirmed',20000,'Tuition','First Term','2026/2027','2026-09-29','2026-09-29 12:00'),
      ('pending','s','school','recorded',99999,'Tuition','First Term','2026/2027','2026-09-29',null),
      ('reversed','s','school','reversed',99999,'Tuition','First Term','2026/2027','2026-09-29','2026-09-29 12:00'),
      ('foreign','s','other','confirmed',99999,'Tuition','First Term','2026/2027','2026-09-29','2026-09-29 12:00'),
      ('historic','s','school','confirmed',30000,'Tuition','Third Term','2025/2026','2026-07-01','2026-07-01 12:00');
    INSERT INTO fee_payment_student_splits VALUES ('s','split',10000,NULL);
    INSERT INTO promotion_records VALUES ('s','school','2025/2026','old',true);
  `);
  const adapter=(connection:any):any=>({execute: async(query:any)=>{const q=new PgDialect().sqlToQuery(query); return connection.query(q.sql,q.params);},transaction:async(fn:any)=>connection.transaction((tx:any)=>fn(adapter(tx)))});
  const db=adapter(pg);
  const Storage=new Function('db','sql',compiled+'; return Storage;')(db,sql);
  const store=new Storage();
  store.getCurrentAcademicInfo=async()=>({currentTerm:'First Term',currentSession:'2026/2027'});
  store.getTuitionClassAmounts=async()=>[{classId:'new',studentType:null,term:null,session:null,amount:'105000'},{classId:'old',studentType:null,term:null,session:null,amount:'55000'}];
  return {pg,store};
}
test('actual ledger SQL separates purposes, counts only student split share, and preserves school/status scope',async()=>{
  const {pg,store}=await fixture();try{
    const {entries:[e]}=await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027');
    assert.equal(e.totalPaid,100000);assert.equal(e.tuitionPaid,80000);assert.equal(e.nonTuitionPaid,20000);
    assert.equal(e.tuitionAssigned,100000);assert.equal(e.balance,20000);assert.equal(e.paymentCount,3);
    assert.equal(e.tuitionKnown,true);
    await pg.exec("UPDATE users SET last_name='Newname' WHERE id='u'");
    assert.equal((await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027')).entries[0].lastName,'Newname');
  }finally{await pg.close();}
});
test('historical class filtering uses promotion history; old fee settings and current discount are never substituted',async()=>{
  const {pg,store}=await fixture();try{
    let result=await store.getStudentPaymentLedger('school','old','Third Term','2025/2026');
    assert.equal(result.entries.length,1);assert.equal(result.entries[0].className,'JSS1');
    assert.equal(result.entries[0].tuitionKnown,false);
    assert.equal((await store.getStudentPaymentLedger('school','new','Third Term','2025/2026')).entries.length,0);
    await pg.exec("INSERT INTO student_fees VALUES ('s','tuition',45000,'Third Term','2025/2026')");
    result=await store.getStudentPaymentLedger('school','old','Third Term','2025/2026');
    assert.equal(result.entries[0].tuitionAssigned,45000);assert.equal(result.entries[0].balance,15000);
    assert.equal(result.entries[0].discountKnown,false);
    await pg.exec("UPDATE students SET discount=99999,class_id='foreign'");
    const later=await store.getStudentPaymentLedger('school','old','Third Term','2025/2026');
    assert.equal(later.entries[0].tuitionAssigned,45000);assert.equal(later.entries[0].balance,15000);
  }finally{await pg.close();}
});
test('missing or conflicting history stays unknown, assessments recover a unique class, and all-term totals have no fabricated balance',async()=>{
  const {pg,store}=await fixture();try{
    await pg.exec('DELETE FROM promotion_records');
    let e=(await store.getStudentPaymentLedger('school',undefined,'Third Term','2025/2026')).entries[0];
    assert.equal(e.classId,'');assert.equal(e.tuitionKnown,false);
    await pg.exec("INSERT INTO assessments VALUES ('s','old','Third Term','2025/2026')");
    e=(await store.getStudentPaymentLedger('school',undefined,'Third Term','2025/2026')).entries[0];assert.equal(e.classId,'old');
    await pg.exec("INSERT INTO assessments VALUES ('s','new','Third Term','2025/2026')");
    e=(await store.getStudentPaymentLedger('school',undefined,'Third Term','2025/2026')).entries[0];assert.equal(e.classId,'');
    e=(await store.getStudentPaymentLedger('school')).entries[0];assert.equal(e.tuitionKnown,false);assert.equal(e.totalPaid,130000);
  }finally{await pg.close();}
});
test('confirmation date boundaries apply equally to tuition and other payments',async()=>{
  const {pg,store}=await fixture();try{
    assert.equal((await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027','2026-09-28T23:00:00Z','2026-09-29T23:00:00Z')).entries[0].totalPaid,100000);
    assert.equal((await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027','2026-09-29T23:00:00Z','2026-09-30T23:00:00Z')).entries.length,0);
  }finally{await pg.close();}
});
test('exports retain tuition shortfall and other payment values; unknown historical balances are explicit',()=>{
  const e={studentDbId:'s',studentId:'S',firstName:'Ada',lastName:'Test',className:'JSS1',studentType:'returning',totalPaid:100000,tuitionPaid:80000,nonTuitionPaid:20000,tuitionAssigned:100000,totalAssigned:100000,balance:20000,discount:0,tuitionKnown:true};
  let row=XLSX.utils.sheet_to_json<any>(buildLedgerWorkbook([e],[],{},false).Sheets['Ledger summary'])[0];
  assert.equal(row['Outstanding tuition (NGN)'],20000);assert.equal(row['Other payments (NGN)'],20000);
  row=XLSX.utils.sheet_to_json<any>(buildLedgerWorkbook([{...e,tuitionKnown:false}],[],{},false).Sheets['Ledger summary'])[0];
  assert.equal(row['Outstanding tuition (NGN)'],'Not verified');
});
test('approving a name change invalidates the ledger cache',()=>{
  const text=fs.readFileSync(new URL('../../client/src/pages/admin-dashboard.tsx',import.meta.url),'utf8');
  const source=ts.createSourceFile('dashboard.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let callback:ts.Node|undefined;
  function walk(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='reviewNameChangeMutation'){
    const call=node.initializer as ts.CallExpression; const options=call.arguments[0] as ts.ObjectLiteralExpression;
    callback=(options.properties.find(p=>p.name?.getText(source)==='onSuccess') as ts.PropertyAssignment).initializer;
  }ts.forEachChild(node,walk);}walk(source);assert.ok(callback);
  const emitted=ts.transpileModule('const handler='+callback!.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const keys:any[]=[];
  const handler=new Function('queryClient','toast','setNameChangeReviewingId','setNameChangeReviewNotes',emitted+';return handler;')({invalidateQueries:({queryKey}:any)=>keys.push(queryKey)},()=>{},()=>{},()=>{});
  handler(null,{id:'x',action:'approved'});assert.ok(keys.some(k=>k[0]==='/api/payments/ledger'));
});

test('name approval updates the shared profile atomically; failed application leaves request pending',async()=>{
  const {pg,store}=await fixture();try{
    await assert.rejects(store.reviewNameChangeRequest('request',{action:'approved',reviewedBy:'admin',studentUserId:'u',newFirstName:'Ada'}));
    assert.equal((await pg.query("SELECT status FROM student_name_change_requests WHERE id='request'")).rows[0].status,'pending');
    await store.reviewNameChangeRequest('request',{action:'approved',reviewedBy:'admin',studentUserId:'u',newFirstName:'Ada',newLastName:'Approved'});
    assert.equal((await pg.query("SELECT status FROM student_name_change_requests WHERE id='request'")).rows[0].status,'approved');
    assert.equal((await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027')).entries[0].lastName,'Approved');
    await assert.rejects(store.reviewNameChangeRequest('request',{action:'rejected',reviewedBy:'admin'}));
  }finally{await pg.close();}
});

test('tuition status and ledger filters do not count books as tuition or guess unknown balances',()=>{
  const text=fs.readFileSync(new URL('../../client/src/components/payment-ledger.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('ledger.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const status=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='getEntryStatus')!;
  const statusCode=ts.transpileModule(status.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const getStatus=new Function(statusCode+';return getEntryStatus;')();
  const entry={studentDbId:'s',firstName:'Ada',lastName:'Test',studentId:'S',studentType:'returning',tuitionAssigned:100000,tuitionPaid:80000,nonTuitionPaid:20000,totalPaid:100000,paymentCount:2,tuitionKnown:true};
  assert.equal(getStatus(entry),'Partial');assert.equal(getStatus({...entry,tuitionPaid:100000}),'Paid');
  assert.equal(getStatus({...entry,tuitionKnown:false}),'Not verified');
  let filter:ts.Node|undefined;
  function walk(n:ts.Node){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='filterEntries')filter=n.initializer;ts.forEachChild(n,walk);}walk(ast);assert.ok(filter);
  const code=ts.transpileModule('const filter='+filter!.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const factory=new Function('nameSearch','confirmationFiltered','paymentStatusFilter','studentTypeFilter',code+';return filter;');
  assert.equal(factory('',false,'fully-paid','all')([entry]).length,0);
  assert.equal(factory('',false,'outstanding','all')([entry]).length,1);
  assert.equal(factory('',false,'paid','all')([entry]).length,1);
  assert.equal(factory('',false,'outstanding','all')([{...entry,tuitionKnown:false}]).length,0);
});
test('mixed-purpose allocations use their own purposes and count one transfer per student; reversal removes all shares',async()=>{
  const {pg,store}=await fixture();try{
    await pg.exec(`UPDATE fee_payment_records SET purpose='Multiple purposes' WHERE id='split';
      UPDATE fee_payment_student_splits SET purpose='Tuition';
      INSERT INTO fee_payment_student_splits VALUES ('s','split',10000,'Books')`);
    let e=(await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027')).entries[0];
    assert.equal(e.totalPaid,110000);assert.equal(e.tuitionPaid,80000);assert.equal(e.nonTuitionPaid,30000);assert.equal(e.paymentCount,3);
    await pg.exec("UPDATE fee_payment_records SET status='reversed' WHERE id='split'");
    e=(await store.getStudentPaymentLedger('school',undefined,'First Term','2026/2027')).entries[0];
    assert.equal(e.totalPaid,90000);assert.equal(e.tuitionPaid,70000);assert.equal(e.nonTuitionPaid,20000);assert.equal(e.paymentCount,2);
  }finally{await pg.close();}
});
