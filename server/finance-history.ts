import { sql, type SQL } from 'drizzle-orm';
import type { FinanceHistoryEvent, FinanceSnapshot } from '../shared/historical-tuition';

export async function loadFinancePeriods(connection: { execute(query: SQL): Promise<any> }, schoolId: string) {
  const result = await connection.execute(sql`SELECT DISTINCT term,session FROM (
    SELECT current_term AS term,current_session AS session FROM schools WHERE id=${schoolId}
    UNION SELECT r.term,r.session FROM tuition_class_amounts r JOIN fee_types ft ON ft.id=r.fee_type_id WHERE ft.school_id=${schoolId}
    UNION SELECT sf.term,sf.session FROM student_fees sf JOIN fee_types ft ON ft.id=sf.fee_type_id WHERE ft.school_id=${schoolId}
    UNION SELECT term,session FROM fee_payment_records WHERE school_id=${schoolId}
  ) periods WHERE term IN ('First Term','Second Term','Third Term') AND session ~ '^[0-9]{4}/[0-9]{4}$' ORDER BY session DESC,term`);
  return result.rows as {term:string;session:string}[];
}

// Older installations may not yet have the additive student-history migration.
// Inspect first, without creating tables or fabricating records on a report read.
export async function loadFinanceHistory(connection: { execute(query: SQL): Promise<any> }, schoolId: string) {
  const ready = await connection.execute(sql`SELECT to_regclass('student_status_events') IS NOT NULL AS events,
    to_regclass('student_population_snapshots') IS NOT NULL AS snapshots`);
  const events: FinanceHistoryEvent[] = ready.rows[0]?.events ? (await connection.execute(sql`
    SELECT student_id AS "studentId",school_id AS "schoolId",class_id AS "classId",class_name AS "className",event_type AS "eventType",
      term,session,period_verified AS "periodVerified",class_verified AS "classVerified",admission_category AS "admissionCategory",sequence::text,
      previous_data AS "previousData",new_data AS "newData"
    FROM student_status_events WHERE school_id=${schoolId} ORDER BY sequence`)).rows : [];
  const snapshots: FinanceSnapshot[] = ready.rows[0]?.snapshots ? (await connection.execute(sql`
    SELECT term,session,snapshot_kind AS "snapshotKind",students FROM student_population_snapshots WHERE school_id=${schoolId}`)).rows : [];
  const studentIds = Array.from(new Set([...events.map(event => event.studentId), ...snapshots.flatMap(snapshot => snapshot.students.map(student => student.studentId))]));
  const eventsByStudent = new Map<string, FinanceHistoryEvent[]>();
  const snapshotsByStudent = new Map<string, FinanceSnapshot[]>();
  for (const event of events) eventsByStudent.set(event.studentId, [...(eventsByStudent.get(event.studentId) || []), event]);
  for (const snapshot of snapshots) for (const student of snapshot.students) {
    snapshotsByStudent.set(student.studentId, [...(snapshotsByStudent.get(student.studentId) || []), { ...snapshot, students: [student] }]);
  }
  const classes = await connection.execute(sql`SELECT id,name FROM classes WHERE school_id=${schoolId}`);
  const classNames = Object.fromEntries(classes.rows.map((row: { id: string; name: string }) => [row.id, row.name]));
  return { events, snapshots, studentIds, eventsByStudent, snapshotsByStudent, classNames };
}
