// PGLITE_TEST_MODULE=/tmp/sowa-test-tools/node_modules/@electric-sql/pglite/dist/index.js node --import tsx --test scripts/tests/student-history.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { sql, eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { setHistoryContext, authorizeStudentMutation, lockHistorySchools, claimHistoryCommand, promoteWithHistory, StudentHistoryError } from '../../server/student-history';

const school1 = '00000000-0000-4000-8000-000000000001';
const school2 = '00000000-0000-4000-8000-000000000002';
const actor = '00000000-0000-4000-8000-000000000003';
const context = { actorId: actor, actorRole: 'admin' as const, schoolId: school1 };
const migration = fs.readFileSync(new URL('../migrations/20261011_student_history.sql', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../../server/storage.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storage.ts', source, ts.ScriptTarget.Latest, true);
const cls = ast.statements.find(n => ts.isClassDeclaration(n) && n.name?.text === 'DatabaseStorage') as ts.ClassDeclaration;
const methodNames = ['createStudent','updateStudent','getStudentSchoolIds','markStudentsAsWithdrawn','rollbackStudentClasses','setSchoolAcademicInfo','executeBulkPromotion','advanceAcademicTermForSchool'];
const compiled = ts.transpileModule('class Storage {' + cls.members.filter(n => ts.isMethodDeclaration(n) && methodNames.includes(n.name.getText(ast))).map(n => n.getText(ast)).join('\n') + '}', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

async function fixture(legacy = false) {
  const { PGlite } = await import(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
  const pg = new PGlite();
  for (const table of [schema.schools,schema.users,schema.classes,schema.students,schema.promotionRecords,schema.academicSessions,schema.academicTerms]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(c => `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}${c.notNull ? ' NOT NULL' : ''}${c.default !== undefined ? ' DEFAULT ' + (typeof c.default === 'object' ? new PgDialect().sqlToQuery(c.default as any).sql : typeof c.default === 'string' ? "'" + c.default.replaceAll("'","''") + "'" : c.default) : ''}`);
    await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
  }
  await pg.exec(`CREATE UNIQUE INDEX request_once ON students(client_request_id) WHERE client_request_id IS NOT NULL; CREATE UNIQUE INDEX student_number_once ON students(student_id);
    INSERT INTO schools(id,name,current_term,current_session) VALUES ('${school1}','Ikpoto','First Term','2026/2027'),('${school2}','Bonsaac','Third Term','2025/2026');
    INSERT INTO classes(id,name,school_id) VALUES ('a','Primary 1','${school1}'),('b','Primary 2','${school1}'),('foreign','Primary 1','${school2}');
    INSERT INTO users(id,email,password,first_name,last_name,middle_name,role) VALUES ('${actor}','admin@test','not-a-real-password','Main','Admin',NULL,'admin');`);
  if (legacy) await pg.exec(`INSERT INTO users(id,email,password,first_name,last_name,school_id) VALUES ('00000000-0000-4000-8000-000000000010','legacy@test','test','Legacy','Student','${school1}');
    INSERT INTO students(user_id,class_id,student_id,parent_whatsapp,status,status_term,status_session,created_at) VALUES ('00000000-0000-4000-8000-000000000010','a','SOWA/1001','123','withdrawn','First Term','2024/2025','2024-01-01');`);
  await pg.exec(migration);
  const db = drizzle(pg);
  const names = ['db','sql','eq','and','inArray','students','classes','schools','users','promotionRecords','academicSessions','academicTerms','setHistoryContext','authorizeStudentMutation','lockHistorySchools','claimHistoryCommand','StudentHistoryError'];
  const Storage = new Function(...names, compiled + '; return Storage;')(db,sql,eq,and,inArray,schema.students,schema.classes,schema.schools,schema.users,schema.promotionRecords,schema.academicSessions,schema.academicTerms,setHistoryContext,authorizeStudentMutation,lockHistorySchools,claimHistoryCommand,StudentHistoryError);
  const store = new Storage(); store.getSchoolNumber = async (id: string) => id === school2 ? 2 : 1;
  async function create(classId = 'a', studentType = 'new', requestId?: string) {
    const [user] = await db.insert(schema.users).values({ email: `${crypto.randomUUID()}@test`, password: 'test', firstName: 'Ada', lastName: 'Student', middleName: 'Grace', schoolId: classId === 'foreign' ? school2 : school1 }).returning();
    return store.createStudent({ userId: user.id, classId, parentWhatsapp: '123', studentType, clientRequestId: requestId }, { ...context, requestId });
  }
  async function events(id: string, type?: string) {
    return (await pg.query(`SELECT * FROM student_status_events WHERE student_id=$1 ${type ? 'AND event_type=$2' : ''} ORDER BY sequence`, type ? [id,type] : [id])).rows as any[];
  }
  return { pg, db, store, create, events };
}

test('new admission is fixed after payment classification changes and an offline creation replay has only one admission', async () => {
  const f = await fixture(); try {
    const s = await f.create('a','new','offline-admit');
    const admitted = (await f.events(s.id,'admission'))[0];
    assert.equal(admitted.admission_category,'new'); assert.equal(admitted.term,'First Term'); assert.equal(admitted.period_verified,true);
    assert.equal(admitted.student_name,'Student Ada Grace'); assert.equal(admitted.actor_id,actor);
    await f.pg.query("UPDATE students SET student_type='returning',student_type_flipped_term='First Term',student_type_flipped_session='2026/2027' WHERE id=$1", [s.id]);
    const replay = await f.store.createStudent({ userId: s.userId, classId:'a',parentWhatsapp:'123',studentType:'new',clientRequestId:'offline-admit' },context);
    assert.equal(replay.id,s.id); assert.equal((await f.events(s.id,'admission')).length,1);
    assert.deepEqual((await f.events(s.id,'admission'))[0],admitted);
  } finally { await f.pg.close(); }
});

test('returning registration and legacy backfill never fabricate original admission dates, periods or classes', async () => {
  const f = await fixture(true); try {
    const s = await f.create('a','returning'); const admission = (await f.events(s.id,'admission'))[0];
    assert.equal(admission.occurred_at,null); assert.equal(admission.session,null); assert.equal(admission.class_id,null);
    const legacy = (await f.pg.query("SELECT * FROM student_status_events WHERE source='legacy_backfill' ORDER BY sequence")).rows as any[];
    assert.equal(legacy.length,2); assert.ok(legacy.every(e => !e.date_verified && !e.period_verified && !e.class_verified));
    assert.ok(legacy.every(e => e.occurred_at === null));
    await f.pg.exec(migration);
    assert.equal((await f.pg.query("SELECT * FROM student_status_events WHERE source='legacy_backfill'")).rows.length,2);
  } finally { await f.pg.close(); }
});

test('withdrawal uses each school period; repeated clicks and request replays do not overwrite earlier withdrawal after readmission', async () => {
  const f = await fixture(); try {
    const a = await f.create(); const b = await f.create('foreign');
    await f.store.markStudentsAsWithdrawn([a.id,b.id],{...context,requestId:'withdraw-1',reason:'Relocated'});
    assert.equal((await f.events(a.id,'withdrawal'))[0].session,'2026/2027');
    assert.equal((await f.events(b.id,'withdrawal'))[0].term,'Third Term');
    assert.equal((await f.events(b.id,'withdrawal'))[0].session,'2025/2026');
    await f.store.markStudentsAsWithdrawn([a.id],context);
    assert.equal((await f.events(a.id,'withdrawal')).length,1);
    await f.store.setSchoolAcademicInfo(school1,'Third Term','2026/2027',context);
    await f.store.updateStudent(a.id,{}, {...context,requestId:'readmit-1'},true);
    assert.equal((await f.events(a.id,'readmission'))[0].term,'Third Term');
    await f.store.markStudentsAsWithdrawn([a.id,b.id],{...context,requestId:'withdraw-1',reason:'Relocated'});
    const row = (await f.pg.query('SELECT status,status_term FROM students WHERE id=$1',[a.id])).rows[0] as any;
    assert.equal(row.status,'active'); assert.equal(row.status_term,null);
    assert.equal((await f.events(a.id,'withdrawal')).length,1);
    await assert.rejects(f.store.markStudentsAsWithdrawn([a.id],{...context,requestId:'withdraw-1'}), /different details/);
    await f.store.markStudentsAsWithdrawn([a.id],{...context,requestId:'withdraw-2'});
    assert.equal((await f.events(a.id,'withdrawal')).length,2);
    assert.equal((await f.events(a.id,'withdrawal'))[0].term,'First Term');
  } finally { await f.pg.close(); }
});

test('no withdrawal is inferred from inactivity, missing assessments or attendance; a transfer creates no fresh academy admission', async () => {
  const f = await fixture(); try {
    const s = await f.create();
    await f.store.updateStudent(s.id,{},context,false);
    assert.equal((await f.events(s.id,'withdrawal')).length,0);
    await f.store.updateStudent(s.id,{classId:'foreign'},context);
    assert.equal((await f.events(s.id,'admission')).length,1);
    assert.equal((await f.events(s.id,'transfer_out'))[0].school_id,school1);
    assert.equal((await f.events(s.id,'transfer_in'))[0].school_id,school2);
    assert.equal((await f.pg.query('SELECT school_id FROM users WHERE id=$1',[s.userId])).rows[0].school_id,school2);
  } finally { await f.pg.close(); }
});

test('school permissions reject withdrawals, registrations and cross-school class changes without partial writes', async () => {
  const f = await fixture(); try {
    const s = await f.create(); const b = await f.create('foreign'); const sub = {...context,actorRole:'sub-admin' as const};
    await assert.rejects(f.store.markStudentsAsWithdrawn([s.id,b.id],sub), /outside your school/);
    await assert.rejects(f.store.updateStudent(s.id,{classId:'foreign'},sub), /outside your school/);
    await assert.rejects(f.store.createStudent({userId:s.userId,classId:'foreign',parentWhatsapp:'123'},sub), /outside your school/);
    assert.equal((await f.events(s.id,'withdrawal')).length,0); assert.equal((await f.events(s.id,'transfer_in')).length,0);
  } finally { await f.pg.close(); }
});

test('closing a term freezes names, school/class populations and pre-promotion classes; snapshots and history reject modification', async () => {
  const f = await fixture(); try {
    const s = await f.create(); await f.store.setSchoolAcademicInfo(school1,'Third Term','2026/2027',context);
    await promoteWithHistory(f.db,{currentClassId:'a',nextClassId:'b',studentIds:[s.id]}, {...context,requestId:'promote-1'});
    await f.store.setSchoolAcademicInfo(school1,'First Term','2027/2028',context);
    const snapshot = (await f.pg.query("SELECT * FROM student_population_snapshots WHERE school_id=$1 AND term='Third Term' AND snapshot_kind='term_end'",[school1])).rows[0] as any;
    assert.equal(snapshot.students[0].classId,'a'); assert.equal(snapshot.students[0].className,'Primary 1'); assert.equal(snapshot.captured_by,actor);
    await f.pg.query("UPDATE users SET last_name='Changed' WHERE id=$1",[s.userId]);
    await f.store.updateStudent(s.id,{classId:'foreign'},context);
    assert.deepEqual((await f.pg.query('SELECT students FROM student_population_snapshots WHERE id=$1',[snapshot.id])).rows[0].students,snapshot.students);
    await assert.rejects(f.pg.exec("DELETE FROM student_status_events"), /append-only/);
    await assert.rejects(f.pg.exec("UPDATE student_population_snapshots SET coverage='fake'"), /append-only/);
    await assert.rejects(f.pg.exec("TRUNCATE student_status_events"), /append-only/);
    await f.pg.query('DELETE FROM students WHERE id=$1',[s.id]);
    assert.equal((await f.events(s.id,'admission')).length,1);
  } finally { await f.pg.close(); }
});

test('failed event recording rolls back student/account changes and command receipt, so retry can succeed', async () => {
  const f = await fixture(); try {
    const s = await f.create();
    await f.pg.exec("ALTER TABLE student_status_events ADD CONSTRAINT refuse_withdrawal CHECK (event_type <> 'withdrawal')");
    await assert.rejects(f.store.markStudentsAsWithdrawn([s.id],{...context,requestId:'retryable'}));
    assert.equal((await f.pg.query('SELECT status FROM students WHERE id=$1',[s.id])).rows[0].status,'active');
    assert.equal((await f.pg.query('SELECT is_active FROM users WHERE id=$1',[s.userId])).rows[0].is_active,true);
    assert.equal((await f.pg.query('SELECT * FROM student_history_commands')).rows.length,0);
    await f.pg.exec('ALTER TABLE student_status_events DROP CONSTRAINT refuse_withdrawal');
    await f.store.markStudentsAsWithdrawn([s.id],{...context,requestId:'retryable'});
    assert.equal((await f.events(s.id,'withdrawal')).length,1);
  } finally { await f.pg.close(); }
});

test('manual and bulk promotions record status history atomically, reject withdrawn students and prevent duplicate graduation', async () => {
  const f = await fixture(); try {
    const s = await f.create(); await f.store.setSchoolAcademicInfo(school1,'Third Term','2026/2027',context);
    await f.store.executeBulkPromotion({schoolId:school1,session:'2026/2027',term:'Third Term',promotedBy:actor,history:context,promotions:[{currentClassId:'a',nextClassId:'b',studentIds:[s.id]}]});
    assert.equal((await f.events(s.id,'promotion')).length,1);
    await assert.rejects(f.store.executeBulkPromotion({schoolId:school1,session:'2026/2027',promotedBy:actor,history:context,promotions:[{currentClassId:'b',nextClassId:'a',studentIds:[s.id]}]}),/already promoted/);
    await promoteWithHistory(f.db,{currentClassId:'b',nextClassId:'graduated',studentIds:[s.id]},context);
    await promoteWithHistory(f.db,{currentClassId:'b',nextClassId:'graduated',studentIds:[s.id]},context);
    assert.equal((await f.events(s.id,'graduation')).length,1);
    assert.equal((await f.events(s.id,'withdrawal')).length,0);
  } finally { await f.pg.close(); }
});

test('all four schools keep distinct immutable populations and empty history is never invented for earlier terms', async () => {
  const f = await fixture(); try {
    const third = '00000000-0000-4000-8000-000000000030';
    const fourth = '00000000-0000-4000-8000-000000000040';
    await f.db.insert(schema.schools).values([{id:third,name:'Akwuofor',currentTerm:'First Term',currentSession:'2026/2027'},{id:fourth,name:'Akwuose',currentTerm:'First Term',currentSession:'2026/2027'}]);
    await f.db.insert(schema.classes).values([{id:'third',name:'Nursery',schoolId:third},{id:'fourth',name:'SS1',schoolId:fourth}]);
    for (const classId of ['a','foreign','third','fourth']) await f.create(classId);
    for (const id of [school1,school2,third,fourth]) await f.store.setSchoolAcademicInfo(id,'Second Term','2027/2028',context);
    const census = (await f.pg.query("SELECT * FROM student_population_snapshots WHERE snapshot_kind='term_end'")).rows as any[];
    assert.equal(census.length,4); assert.equal(census.reduce((total,s) => total+s.students.length,0),4);
    assert.equal(new Set(census.flatMap(s => s.students.map((student:any) => student.studentId))).size,4);
    assert.ok(census.every(s => s.students.length === 1));
    assert.equal((await f.pg.query("SELECT * FROM student_population_snapshots WHERE session='2023/2024'")).rows.length,0);
  } finally { await f.pg.close(); }
});

test('simultaneous creation/withdrawal retries produce one student/admission/withdrawal, and a transferred number stays reserved', async () => {
  const f = await fixture(); try {
    const user = (await f.db.insert(schema.users).values({email:'race@test',password:'test',firstName:'Race',lastName:'Student'}).returning())[0];
    const data = {userId:user.id,classId:'a',parentWhatsapp:'123',studentType:'new',clientRequestId:'race-admit'};
    const [one,two] = await Promise.all([f.store.createStudent({...data},context),f.store.createStudent({...data},context)]);
    assert.equal(one.id,two.id); assert.equal((await f.events(one.id,'admission')).length,1);
    await Promise.all([f.store.markStudentsAsWithdrawn([one.id],{...context,requestId:'race-withdraw'}),f.store.markStudentsAsWithdrawn([one.id],{...context,requestId:'race-withdraw'})]);
    assert.equal((await f.events(one.id,'withdrawal')).length,1);
    await f.store.updateStudent(one.id,{classId:'foreign'},context);
    const next = await f.create(); assert.notEqual(next.studentId,one.studentId);
  } finally { await f.pg.close(); }
});

test('school term advance and a direct period change capture the old period atomically with an attributed actor', async () => {
  const f = await fixture(); try {
    await f.create();
    const result = await f.store.advanceAcademicTermForSchool(school1,context);
    assert.equal(result.newTerm,'Second Term'); assert.equal(result.newSession,'2026/2027');
    const saved = (await f.pg.query("SELECT * FROM student_population_snapshots WHERE snapshot_kind='term_end'")).rows[0] as any;
    assert.equal(saved.term,'First Term'); assert.equal(saved.captured_by,actor); assert.equal(saved.students.length,1);
    await f.store.setSchoolAcademicInfo(school1,'Third Term','2026/2027',context);
    await assert.rejects(f.store.advanceAcademicTermForSchool(school1,{...context,actorRole:'sub-admin',schoolId:school2}), /outside|another/);
  } finally { await f.pg.close(); }
});

test('reliable existing bulk promotion records recover Third Term class history; legacy manual periods stay unverified', async () => {
  const f = await fixture(); try {
    const bulk = await f.create(); const manual = await f.create();
    await f.store.setSchoolAcademicInfo(school1,'Third Term','2026/2027',context);
    // Simulate rows created by the pre-Phase-1 application, before event triggers.
    await f.pg.exec('ALTER TABLE students DISABLE TRIGGER record_student_history');
    await f.pg.query("UPDATE students SET class_id='b' WHERE id IN ($1,$2)",[bulk.id,manual.id]);
    await f.db.insert(schema.promotionRecords).values([
      {schoolId:school1,session:'2026/2027',studentId:bulk.id,fromClassId:'a',toClassId:'b',isBulk:true,promotedBy:actor},
      {schoolId:school1,session:'2026/2027',studentId:manual.id,fromClassId:'a',toClassId:'b',isBulk:false,promotedBy:actor},
    ]);
    await f.pg.exec('ALTER TABLE students ENABLE TRIGGER record_student_history');
    await f.pg.exec(migration); await f.pg.exec(migration);
    assert.equal((await f.events(bulk.id,'promotion')).length,1);
    assert.equal((await f.events(manual.id,'promotion')).length,0);
    await f.store.setSchoolAcademicInfo(school1,'First Term','2027/2028',context);
    const snapshot=(await f.pg.query("SELECT students FROM student_population_snapshots WHERE school_id=$1 AND term='Third Term' AND snapshot_kind='term_end'",[school1])).rows[0].students as any[];
    assert.equal(snapshot.find(s=>s.studentId===bulk.id).classId,'a');
    assert.equal(snapshot.find(s=>s.studentId===manual.id).classId,null);
    assert.equal(snapshot.find(s=>s.studentId===manual.id).historicalClassVerified,false);
  } finally { await f.pg.close(); }
});
