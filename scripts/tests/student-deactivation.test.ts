import test from 'node:test';
import assert from 'node:assert/strict';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../../shared/schema';
import { deactivateStudents } from '../../server/student-deactivation';
const school='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const actor={id:'00000000-0000-4000-8000-000000000003',role:'admin',firstName:'Admin'};
test('batch deactivation is scoped, atomic, audited, idempotent and preserves student records',async()=>{
  const {PGlite}=await import(process.env.PGLITE_TEST_MODULE || '@electric-sql/pglite');
  const pg=new PGlite(); const db=drizzle(pg);
  try {
    for(const table of [schema.schools,schema.users,schema.classes,schema.students,schema.paymentAuditLogs]) {
      const config=getTableConfig(table);
      const columns=config.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.primary?' PRIMARY KEY':''}${c.notNull?' NOT NULL':''}${c.default!==undefined?' DEFAULT '+(typeof c.default==='object'?new PgDialect().sqlToQuery(c.default as any).sql:typeof c.default==='string'?"'"+c.default.replaceAll("'","''")+"'":c.default):''}`);
      await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
    }
    await db.insert(schema.schools).values([{id:school,name:'One'},{id:other,name:'Two'}]);
    await db.insert(schema.classes).values([{id:'a',name:'Primary 1',schoolId:school},{id:'b',name:'Primary 2',schoolId:other}]);
    const create=async(classId:string)=>{
      const [u]=await db.insert(schema.users).values({email:crypto.randomUUID()+'@test.com',password:'test',firstName:'Ada',lastName:'Student',role:'student'}).returning();
      const [s]=await db.insert(schema.students).values({userId:u.id,classId,studentId:crypto.randomUUID(),parentWhatsapp:'123'}).returning(); return s;
    };
    const a=await create('a'), b=await create('a'), foreign=await create('b');
    await assert.rejects(deactivateStudents(db,{...actor,role:'teacher'},{classId:'a',studentIds:[a.id]}),/access required/);
    await assert.rejects(deactivateStudents(db,{...actor,role:'sub-admin',schoolId:other,permissions:['tab_students']},{classId:'a',studentIds:[a.id]}),/outside/);
    await assert.rejects(deactivateStudents(db,actor,{classId:'a',studentIds:[a.id,foreign.id]}),/no longer/);
    assert.equal((await db.select().from(schema.users)).every(u=>u.isActive),true);
    const before=await db.select().from(schema.students);
    // If audit insertion fails, the account change must roll back too.
    await pg.exec("ALTER TABLE payment_audit_logs ADD CONSTRAINT refuse CHECK (action <> 'deactivate_students')");
    await assert.rejects(deactivateStudents(db,actor,{classId:'a',studentIds:[a.id,b.id]}));
    assert.equal((await db.select().from(schema.users)).every(u=>u.isActive),true);
    await pg.exec('ALTER TABLE payment_audit_logs DROP CONSTRAINT refuse');
    assert.deepEqual(await deactivateStudents(db,actor,{classId:'a',studentIds:[a.id,b.id,a.id]}),{deactivatedCount:2});
    assert.deepEqual(await db.select().from(schema.students),before);
    const accounts=await db.select().from(schema.users);
    assert.equal(accounts.filter(u=>!u.isActive).length,2);
    assert.equal(accounts.find(u=>u.id===foreign.userId)?.isActive,true);
    assert.deepEqual(await deactivateStudents(db,actor,{classId:'a',studentIds:[a.id,b.id]}),{deactivatedCount:0});
    assert.equal((await db.select().from(schema.paymentAuditLogs)).length,1);
  } finally {await pg.close();}
});
