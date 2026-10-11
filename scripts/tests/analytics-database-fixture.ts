// Isolated PostgreSQL fixture shared by reporting and full browser/API tests.
import fs from 'node:fs';
import ts from 'typescript';
import { drizzle } from 'drizzle-orm/pglite';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../../shared/schema';
import { GeneralSchoolAnalytics, type TuitionResolver } from '../../server/general-school-analytics';
import { setHistoryContext } from '../../server/student-history';

export const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-00000000000${n}`);
export const actor = '00000000-0000-4000-8000-000000000099';
const migration = fs.readFileSync(new URL('../migrations/20261011_student_history.sql', import.meta.url), 'utf8');
// Exercise the same tuition resolver used by the existing financial workflows.
const source = fs.readFileSync(new URL('../../server/storage.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('storage.ts', source, ts.ScriptTarget.Latest, true);
const storage = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'DatabaseStorage') as ts.ClassDeclaration;
const method = storage.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === 'buildTuitionResolver')!;
const emitted = ts.transpileModule('class Storage {' + method.getText(ast) + '}', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const resolver: TuitionResolver = new (new Function(emitted + ';return Storage;')())().buildTuitionResolver;

export async function createAnalyticsFixture(applyMigration = true) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  for (const table of [schema.schools, schema.users, schema.classes, schema.students, schema.promotionRecords, schema.academicSessions, schema.academicTerms,
    schema.subjects, schema.assessments, schema.attendance, schema.feeTypes, schema.tuitionClassAmounts, schema.studentFees, schema.feePaymentRecords, schema.feePaymentStudentSplits]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}${column.notNull ? ' NOT NULL' : ''}${column.default !== undefined ? ' DEFAULT ' + (typeof column.default === 'object' ? new PgDialect().sqlToQuery(column.default as any).sql : typeof column.default === 'string' ? "'" + column.default.replaceAll("'", "''") + "'" : column.default) : ''}`);
    await pg.exec(`CREATE TABLE ${config.name} (${columns.join(',')})`);
  }
  await pg.query('INSERT INTO users(id,email,password,first_name,last_name,role) VALUES ($1,$2,$3,$4,$5,$6)', [actor, 'admin@test', 'test', 'Main', 'Admin', 'admin']);
  const db = drizzle(pg);
  const students: any[] = [];
  for (let i = 0; i < ids.length; i++) {
    await pg.query('INSERT INTO schools(id,name,current_term,current_session) VALUES ($1,$2,$3,$4)', [ids[i], ['Ikpoto', 'Bonsaac', 'Akwuofor', 'Akwuose'][i], i === 3 ? 'Third Term' : 'First Term', i === 3 ? '2025/2026' : '2026/2027']);
    for (const [prefix, name] of [['p', 'Primary 1'], ['s', 'JSS 1']]) await pg.query('INSERT INTO classes(id,name,school_id) VALUES ($1,$2,$3)', [`${prefix}${i}`, name, ids[i]]);
    const [user] = await db.insert(schema.users).values({ email: `${i}@test`, password: 'test', firstName: 'Ada', middleName: 'Grace', lastName: `Student${i}`, schoolId: ids[i] }).returning();
    const [student] = await db.insert(schema.students).values({ userId: user.id, classId: `p${i}`, studentId: `SOWA/${i + 1}`, parentWhatsapp: '123' }).returning();
    students.push(student);
    const [fee] = await db.insert(schema.feeTypes).values({ schoolId: ids[i], name: 'Tuition', category: 'tuition', amount: '100', isTuition: true }).returning();
    await db.insert(schema.tuitionClassAmounts).values([{ feeTypeId: fee.id, classId: `p${i}`, amount: '100' }, { feeTypeId: fee.id, classId: `s${i}`, amount: '200' }]);
  }
  if (applyMigration) await pg.exec(migration);
  const reporting = new GeneralSchoolAnalytics(db, resolver);
  async function create(index = 0, admissionDate?: string) {
    return db.transaction(async tx => {
      await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', schoolId: ids[index], admissionDate });
      const [user] = await tx.insert(schema.users).values({ email: `${crypto.randomUUID()}@test`, password: 'test', firstName: 'New', middleName: 'Full', lastName: 'Admission', schoolId: ids[index] }).returning();
      const [student] = await tx.insert(schema.students).values({ userId: user.id, classId: `p${index}`, studentId: `SOWA/${crypto.randomUUID()}`, parentWhatsapp: '123', studentType: 'new' }).returning();
      return student;
    });
  }
  async function payment(amount: string, studentId: string | null, purpose = 'Tuition', term = 'First Term', session = '2026/2027', received = '2026-09-10', status = 'confirmed') {
    const [record] = await db.insert(schema.feePaymentRecords).values({ amount, studentId, schoolId: ids[0], purpose, term, session, paymentDate: new Date(received), recordedBy: actor, paymentMethod: 'cash', status }).returning();
    return record;
  }
  return { pg, db, reporting, students, create, payment };
}

