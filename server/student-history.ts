import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { analyticsSessionSchema } from '../shared/general-school-analytics';

export const historyContextSchema = z.object({
  actorId: z.string().uuid().optional(),
  actorRole: z.enum(['admin', 'sub-admin', 'bursar']).optional(),
  schoolId: z.string().uuid().nullable().optional(),
  requestId: z.string().min(1).max(200).optional(),
  reason: z.string().trim().max(2000).optional(),
  action: z.enum(['registration', 'edit', 'withdrawal', 'readmission', 'promotion', 'rollback', 'academic_period']).optional(),
  admissionDate: z.string().date().optional(),
  admissionTerm: z.enum(['First Term', 'Second Term', 'Third Term']).optional(),
  admissionSession: analyticsSessionSchema.optional(),
  admissionCategory: z.enum(['new', 'returning', 'readmitted']).optional(),
  admissionClassId: z.string().min(1).max(50).optional(),
}).refine(d => !!d.admissionTerm === !!d.admissionSession, 'Supply both admission term and session');
export type HistoryContext = z.infer<typeof historyContextSchema>;
export type HistoryConnection = { execute: (query: SQL) => Promise<any> };

export function studentImportKey(classId: string, rows: Record<string, unknown>[]) {
  // Spreadsheet metadata changes on save. Deduplicate the actual rows, not ZIP
  // bytes, so re-saving the same workbook does not create fresh admissions.
  const canonical = rows.map(row => Object.keys(row).sort().map(key => [key, String(row[key] ?? '').trim()]));
  return createHash('sha256').update(classId).update(JSON.stringify(canonical)).digest('hex');
}

export class StudentHistoryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// PostgreSQL triggers consume transaction-local context. Never use a session-wide
// setting: pooled connections must not attribute a later request to this actor.
export async function setHistoryContext(tx: HistoryConnection, input: HistoryContext = {}) {
  const context = historyContextSchema.parse(input);
  const ready = await tx.execute(sql`SELECT to_regclass('student_status_events') IS NOT NULL
    AND to_regclass('student_history_commands') IS NOT NULL AND to_regclass('student_population_snapshots') IS NOT NULL
    AND (SELECT count(*)=3 FROM pg_trigger WHERE tgname IN ('record_student_history','student_status_period','close_school_period') AND tgenabled IN ('O','A')) AS ready`);
  if (!ready.rows[0]?.ready) throw new StudentHistoryError('The student history migration must be applied before making this change', 503);
  await tx.execute(sql`SELECT set_config('sowa.student_history_context', ${JSON.stringify(context)}, true)`);
}

export async function lockHistorySchools(tx: HistoryConnection, schoolIds: string[]) {
  for (const id of Array.from(new Set(schoolIds)).sort()) {
    // Every lifecycle operation and term closure takes this lock before students.
    await tx.execute(sql`SELECT id FROM schools WHERE id=${id} FOR UPDATE`);
  }
}

export async function authorizeStudentMutation(tx: HistoryConnection, studentId: string, targetClassId: string | undefined, context: HistoryContext) {
  const result = await tx.execute(sql`SELECT c.school_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=${studentId}`);
  if (!result.rows.length) throw new StudentHistoryError('Student not found', 404);
  const schoolId = result.rows[0].school_id;
  const target = targetClassId ? await tx.execute(sql`SELECT school_id FROM classes WHERE id=${targetClassId}`) : result;
  if (!target.rows.length) throw new StudentHistoryError('Class not found');
  const destination = target.rows[0].school_id;
  if (!schoolId || !destination) throw new StudentHistoryError('Student class must belong to a school');
  if (context.actorRole && context.actorRole !== 'admin' && (schoolId !== context.schoolId || destination !== context.schoolId)) {
    throw new StudentHistoryError('Cannot manage students outside your school', 403);
  }
  if (destination !== schoolId && context.actorRole !== 'admin') throw new StudentHistoryError('Only the main administrator can transfer a student', 403);
  await lockHistorySchools(tx, [schoolId, destination]);
  return { schoolId, destination };
}

// A request replay after a later readmission must not withdraw the student again.
// Compare the complete command, not only the current student status.
export async function claimHistoryCommand(tx: HistoryConnection, context: HistoryContext, command: unknown): Promise<boolean> {
  if (!context.requestId) return true;
  if (!context.actorId) throw new StudentHistoryError('An actor is required for an idempotent command');
  const key = `${context.actorId}:${context.requestId}`;
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  const payload = JSON.stringify(command);
  const previous = await tx.execute(sql`SELECT command FROM student_history_commands WHERE actor_id=${context.actorId} AND request_id=${context.requestId}`);
  if (previous.rows.length) {
    const matches = await tx.execute(sql`SELECT command=${payload}::jsonb AS matches FROM student_history_commands WHERE actor_id=${context.actorId} AND request_id=${context.requestId}`);
    if (!matches.rows[0].matches) throw new StudentHistoryError('This request ID was already used for different details', 409);
    return false;
  }
  await tx.execute(sql`INSERT INTO student_history_commands(actor_id,request_id,command) VALUES (${context.actorId},${context.requestId},${payload}::jsonb)`);
  return true;
}

export async function promoteWithHistory(database: any, input: unknown, context: HistoryContext) {
  const data = z.object({ currentClassId: z.string().min(1), nextClassId: z.string().min(1), studentIds: z.array(z.string().uuid()).min(1).max(2000) }).parse(input);
  if (new Set(data.studentIds).size !== data.studentIds.length) throw new StudentHistoryError('Duplicate students in promotion');
  if (data.nextClassId === data.currentClassId) throw new StudentHistoryError('Choose a different promotion class');
  return database.transaction(async (tx: HistoryConnection) => {
    await setHistoryContext(tx, { ...context, action: 'promotion' });
    const source = await tx.execute(sql`SELECT school_id FROM classes WHERE id=${data.currentClassId}`);
    if (!source.rows[0]?.school_id) throw new StudentHistoryError('Class must belong to a school');
    const schoolId = source.rows[0].school_id;
    await lockHistorySchools(tx, [schoolId]);
    if (context.actorRole !== 'admin' && context.schoolId !== schoolId) throw new StudentHistoryError('Cannot promote students outside your school', 403);
    if (data.nextClassId !== 'graduated') {
      const target = await tx.execute(sql`SELECT school_id FROM classes WHERE id=${data.nextClassId}`);
      if (target.rows[0]?.school_id !== schoolId) throw new StudentHistoryError('Promotion classes must belong to the same school');
    }
    if (!await claimHistoryCommand(tx, context, { action: 'promotion', ...data, reason: context.reason ?? null })) return { idempotent: true };
    const ids = [...data.studentIds].sort();
    const roster = await tx.execute(sql`SELECT * FROM students WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)}) ORDER BY id FOR UPDATE`);
    if (roster.rows.length !== ids.length) throw new StudentHistoryError('One or more students were not found');
    if (roster.rows.every((s: any) => data.nextClassId === 'graduated' ? s.status === 'graduated' : s.class_id === data.nextClassId)) return { idempotent: true };
    if (roster.rows.some((s: any) => s.class_id !== data.currentClassId || s.status !== 'active')) throw new StudentHistoryError('Only active students in the source class can be promoted');
    const period = await tx.execute(sql`SELECT current_session,current_term FROM schools WHERE id=${schoolId}`);
    const session = period.rows[0].current_session;
    if (!session || !period.rows[0].current_term) throw new StudentHistoryError('Set the school academic period before promoting students');
    for (const student of roster.rows) {
      await tx.execute(sql`INSERT INTO promotion_records(school_id,session,student_id,from_class_id,to_class_id,is_bulk,promoted_by) VALUES (${schoolId},${session},${student.id},${data.currentClassId},${data.nextClassId},false,${context.actorId ?? null})`);
      if (data.nextClassId === 'graduated') {
        await tx.execute(sql`UPDATE students SET status='graduated',updated_at=now() WHERE id=${student.id}`);
        await tx.execute(sql`UPDATE users SET is_active=false WHERE id=${student.user_id}`);
      } else {
        await tx.execute(sql`UPDATE students SET class_id=${data.nextClassId},updated_at=now() WHERE id=${student.id}`);
      }
    }
    return { idempotent: false };
  });
}
