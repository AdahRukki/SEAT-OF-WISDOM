import { sql, type SQL } from 'drizzle-orm';
import type { PopulationSnapshotStudent } from '../shared/schema';
import type { AcademicPeriod, AnalyticsFilters } from '../shared/general-school-analytics';

export interface ReportingConnection { execute(query: SQL): Promise<{ rows: unknown[] }> }
export interface ReportingDatabase extends ReportingConnection {
  transaction<T>(work: (connection: ReportingConnection) => Promise<T>, options: { isolationLevel: 'repeatable read'; accessMode: 'read only' }): Promise<T>;
}
export class AnalyticsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type ReportingSchool = { id: string; name: string; currentTerm: string | null; currentSession: string | null };
export type ReportingClass = { id: string; name: string; schoolId: string };
export type ReportingStudent = PopulationSnapshotStudent & { schoolId: string; discount: string; studentType: string; flippedTerm: string | null; flippedSession: string | null; financeClassId: string };
export type ReportingEvent = {
  id: string; sequence: string; studentId: string; studentNumber: string; studentName: string;
  schoolId: string; classId: string | null; className: string | null; eventType: string; admissionCategory: string | null;
  occurredAt: string | null; recordedAt: string; term: string | null; session: string | null;
  dateVerified: boolean; periodVerified: boolean; classVerified: boolean; reason: string | null;
  actorId: string | null; source: string;
};
export type ReportingSnapshot = AcademicPeriod & { id: string; schoolId: string; schoolName: string; snapshotKind: string; capturedAt: string; students: PopulationSnapshotStudent[] };
export type ReportingPayment = { id: string; schoolId: string; studentId: string | null; amount: string; purpose: string | null; term: string | null; session: string | null; receivedAt: string };
export type ReportingAllocation = { id: string; paymentId: string; studentId: string; amount: string; purpose: string | null };
export type ReportingScore = AcademicPeriod & { id: string; schoolId: string; classId: string; studentId: string; subjectId: string; subjectName: string; firstCA: number | null; secondCA: number | null; exam: number | null; updatedAt: string | null };
export type ReportingAttendance = AcademicPeriod & { id: string; schoolId: string; classId: string; studentId: string; totalDays: number; presentDays: number; absentDays: number; updatedAt: string | null };
export type ReportingFee = { id: string; schoolId: string; name: string; isActive: boolean };
export type ReportingRate = { feeTypeId: string; classId: string; studentType: string | null; term: string | null; session: string | null; amount: string };
export type ReportingCharge = AcademicPeriod & { studentId: string; schoolId: string; amount: string; status: string | null };
export interface AnalyticsData {
  schools: ReportingSchool[]; classes: ReportingClass[]; students: ReportingStudent[];
  events: ReportingEvent[]; snapshots: ReportingSnapshot[]; payments: ReportingPayment[];
  allocations: ReportingAllocation[]; scores: ReportingScore[]; attendance: ReportingAttendance[];
  tuitionFees: ReportingFee[]; rates: ReportingRate[]; charges: ReportingCharge[];
}

// All sources are read in one repeatable-read transaction. Reports cannot mix a
// pre-withdrawal population with post-withdrawal events or half a payment split.
async function reportingScope(tx: ReportingConnection, filters: AnalyticsFilters) {
  const ready = await tx.execute(sql`SELECT to_regclass('student_status_events') IS NOT NULL AND to_regclass('student_population_snapshots') IS NOT NULL AS ready`);
  if (!(ready.rows[0] as { ready: boolean })?.ready) throw new AnalyticsError('Apply the reviewed Phase 1 student-history migration before using analytics', 503);
  const ids = filters.schoolIds || (filters.schoolId ? [filters.schoolId] : undefined);
  const schoolRows = await tx.execute(sql`SELECT id,name,current_term AS "currentTerm",current_session AS "currentSession" FROM schools
    ${ids ? sql`WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})` : sql``} ORDER BY sort_order,id`);
  const schools = schoolRows.rows as ReportingSchool[];
  if (ids && schools.length !== ids.length) throw new AnalyticsError('One or more schools do not exist', 404);
  if (!schools.length) return { schools, classes: [] as ReportingClass[], scope: sql`NULL` };
  const scope = sql.join(schools.map(school => sql`${school.id}`), sql`,`);
  const classRows = await tx.execute(sql`SELECT id,name,school_id AS "schoolId" FROM classes WHERE school_id IN (${scope})
    UNION SELECT student->>'classId' AS id,student->>'className' AS name,s.school_id AS "schoolId"
    FROM student_population_snapshots s CROSS JOIN LATERAL jsonb_array_elements(s.students) student
    WHERE s.school_id IN (${scope}) AND student->>'classId' IS NOT NULL AND (student->>'historicalClassVerified')::boolean=true`);
  const classes = Array.from(new Map((classRows.rows as ReportingClass[]).map(row => [row.id, row])).values());
  if (filters.classId && !classes.some(cls => cls.id === filters.classId)) throw new AnalyticsError('Class does not belong to the selected schools', 404);
  return { schools, classes, scope };
}

export async function loadAnalyticsData(tx: ReportingConnection, filters: AnalyticsFilters, extraSession?: string): Promise<AnalyticsData> {
  const { schools, classes, scope } = await reportingScope(tx, filters);
  if (!schools.length) return { schools, classes, students: [], events: [], snapshots: [], payments: [], allocations: [], scores: [], attendance: [], tuitionFees: [], rates: [], charges: [] };
  const sessions = Array.from(new Set([...(filters.session ? [filters.session] : schools.map(school => school.currentSession).filter((value): value is string => !!value)), ...(extraSession ? [extraSession] : [])]));
  const sessionScope = sessions.length ? sql.join(sessions.map(value => sql`${value}`), sql`,`) : sql`NULL`;
  const censusSessions = Array.from(new Set(sessions.flatMap(value => [value, `${Number(value.slice(0, 4)) - 1}/${Number(value.slice(5)) - 1}`])));
  const censusScope = censusSessions.length ? sql.join(censusSessions.map(value => sql`${value}`), sql`,`) : sql`NULL`;
  // Raw period sources retain null/unknown periods for completeness accounting.
  // Historical snapshots and admissions are scoped by recorded school, never by
  // the student's mutable current school/class or payment classification.
  const queries = [
    sql`SELECT s.id AS "studentId",s.student_id AS "studentNumber",concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')) AS "studentName",
      s.class_id AS "classId",c.name AS "className",c.school_id AS "schoolId",true AS "historicalClassVerified",s.status,u.is_active AS "accountActive",
      s.discount,s.student_type AS "studentType",s.student_type_flipped_term AS "flippedTerm",s.student_type_flipped_session AS "flippedSession",
      COALESCE((SELECT CASE WHEN count(DISTINCT p.from_class_id)=1 THEN min(p.from_class_id) END FROM promotion_records p
        WHERE p.student_id=s.id AND p.school_id=c.school_id AND p.session=sc.current_session AND p.is_bulk=true),s.class_id) AS "financeClassId"
      FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id JOIN schools sc ON sc.id=c.school_id WHERE c.school_id IN (${scope})`,
    sql`SELECT id,sequence::text,student_id AS "studentId",student_number AS "studentNumber",student_name AS "studentName",school_id AS "schoolId",
      class_id AS "classId",class_name AS "className",event_type AS "eventType",admission_category AS "admissionCategory",occurred_at::text AS "occurredAt",
      recorded_at::text AS "recordedAt",term,session,date_verified AS "dateVerified",period_verified AS "periodVerified",class_verified AS "classVerified",reason,actor_id AS "actorId",source
      FROM student_status_events WHERE school_id IN (${scope}) ORDER BY sequence`,
    sql`SELECT id,school_id AS "schoolId",school_name AS "schoolName",term,session,snapshot_kind AS "snapshotKind",captured_at::text AS "capturedAt",students
      FROM student_population_snapshots WHERE school_id IN (${scope}) AND (snapshot_kind='baseline' OR session IN (${censusScope})) ORDER BY captured_at,id`,
    sql`SELECT id,school_id AS "schoolId",student_id AS "studentId",amount::text,purpose,term,session,payment_date::text AS "receivedAt"
      FROM fee_payment_records WHERE school_id IN (${scope}) AND status='confirmed' AND session IN (${sessionScope})`,
    sql`SELECT a.id,a.payment_record_id AS "paymentId",a.student_id AS "studentId",a.amount::text,COALESCE(a.purpose,p.purpose) AS purpose
      FROM fee_payment_student_splits a JOIN fee_payment_records p ON p.id=a.payment_record_id WHERE p.school_id IN (${scope}) AND p.status='confirmed' AND p.session IN (${sessionScope})`,
    sql`SELECT a.id,c.school_id AS "schoolId",COALESCE(pr.class_id,a.class_id) AS "classId",a.student_id AS "studentId",a.subject_id AS "subjectId",su.name AS "subjectName",
      a.term,a.session,a.first_ca AS "firstCA",a.second_ca AS "secondCA",a.exam,a.updated_at::text AS "updatedAt"
      FROM assessments a JOIN classes c ON c.id=a.class_id JOIN subjects su ON su.id=a.subject_id
      LEFT JOIN LATERAL (SELECT CASE WHEN count(DISTINCT p.from_class_id)=1 THEN min(p.from_class_id) END AS class_id FROM promotion_records p
        WHERE p.student_id=a.student_id AND p.session=a.session AND p.school_id=c.school_id AND p.is_bulk=true) pr ON true
      WHERE c.school_id IN (${scope}) AND a.session IN (${sessionScope})`,
    sql`SELECT a.id,c.school_id AS "schoolId",COALESCE(pr.class_id,a.class_id) AS "classId",a.student_id AS "studentId",a.term,a.session,
      a.total_days AS "totalDays",a.present_days AS "presentDays",a.absent_days AS "absentDays",a.updated_at::text AS "updatedAt"
      FROM attendance a JOIN classes c ON c.id=a.class_id
      LEFT JOIN LATERAL (SELECT CASE WHEN count(DISTINCT p.from_class_id)=1 THEN min(p.from_class_id) END AS class_id FROM promotion_records p
        WHERE p.student_id=a.student_id AND p.session=a.session AND p.school_id=c.school_id AND p.is_bulk=true) pr ON true
      WHERE c.school_id IN (${scope}) AND a.session IN (${sessionScope})`,
    sql`SELECT id,school_id AS "schoolId",name,is_active AS "isActive" FROM fee_types WHERE school_id IN (${scope}) AND is_tuition=true`,
    sql`SELECT r.fee_type_id AS "feeTypeId",r.class_id AS "classId",r.student_type AS "studentType",r.term,r.session,r.amount::text
      FROM tuition_class_amounts r JOIN fee_types f ON f.id=r.fee_type_id WHERE f.school_id IN (${scope}) AND f.is_tuition=true`,
    sql`SELECT s.student_id AS "studentId",f.school_id AS "schoolId",s.term,s.session,s.amount::text,s.status
      FROM student_fees s JOIN fee_types f ON f.id=s.fee_type_id WHERE f.school_id IN (${scope}) AND f.is_tuition=true AND s.session IN (${sessionScope})`,
  ];
  const results = [];
  for (const query of queries) results.push((await tx.execute(query)).rows);
  return { schools, classes, students: results[0] as ReportingStudent[], events: results[1] as ReportingEvent[], snapshots: results[2] as ReportingSnapshot[],
    payments: results[3] as ReportingPayment[], allocations: results[4] as ReportingAllocation[], scores: results[5] as ReportingScore[], attendance: results[6] as ReportingAttendance[],
    tuitionFees: results[7] as ReportingFee[], rates: results[8] as ReportingRate[], charges: results[9] as ReportingCharge[] };
}

// Period selectors read distinct period metadata, never the entire score or
// payment history. This also keeps unverified legacy periods out of the picker.
export async function loadAvailablePeriods(tx: ReportingConnection, filters: AnalyticsFilters) {
  const { schools, classes, scope } = await reportingScope(tx, filters);
  const selectedSchools = schools.filter(school => !filters.classId || classes.some(cls => cls.id === filters.classId && cls.schoolId === school.id));
  if (!selectedSchools.length) return { schools: selectedSchools, periods: [] };
  const result = await tx.execute(sql`SELECT school_id AS "schoolId",session,term,source FROM (
    SELECT id AS school_id,current_session AS session,current_term AS term,'current' AS source FROM schools WHERE id IN (${scope})
    UNION SELECT school_id,session,term,snapshot_kind FROM student_population_snapshots WHERE school_id IN (${scope})
    UNION SELECT school_id,session,term,'events' FROM student_status_events WHERE school_id IN (${scope}) AND period_verified=true
      ${filters.classId ? sql`AND class_verified=true AND class_id=${filters.classId}` : sql``}
    UNION SELECT school_id,session,term,'payments' FROM fee_payment_records WHERE school_id IN (${scope}) AND status='confirmed'
    UNION SELECT c.school_id,a.session,a.term,'scores' FROM assessments a JOIN classes c ON c.id=a.class_id WHERE c.school_id IN (${scope})
      ${filters.classId ? sql`AND a.class_id=${filters.classId}` : sql``}
    UNION SELECT c.school_id,a.session,a.term,'attendance' FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.school_id IN (${scope})
      ${filters.classId ? sql`AND a.class_id=${filters.classId}` : sql``}
  ) periods WHERE session IS NOT NULL AND term IS NOT NULL
    ${filters.session ? sql`AND session=${filters.session}` : sql``} ${filters.term ? sql`AND term=${filters.term}` : sql``}
    ORDER BY session,term,school_id`);
  return { schools: selectedSchools, periods: result.rows as { schoolId: string; session: string; term: string; source: string }[] };
}
