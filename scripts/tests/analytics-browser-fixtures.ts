// Deterministic test records only; never imported by the application.
import { buildAnalyticsReport, type GeneralSchoolReport } from '../../server/general-school-analytics';
import { analyticsFiltersSchema, metricChange } from '../../shared/general-school-analytics';
import type { AnalyticsData, ReportingEvent } from '../../server/analytics-repository';
export const schools = ['Ikpoto', 'Bonsaac', 'Akwuofor', 'Akwuose'].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, name, currentSession: '2026/2027', currentTerm: 'First Term' }));
const classes = schools.map((s, i) => ({ id: `class-${i}`, name: i % 2 ? 'SS 1' : 'Primary 1', schoolId: s.id }));
const student = (i: number) => ({ studentId: `student-${i}`, studentNumber: `SOWA/${i + 1}`, studentName: `Student Ada Grace ${i + 1}`, classId: classes[i % 4].id, className: classes[i % 4].name, schoolId: schools[i % 4].id, historicalClassVerified: true, status: 'active', accountActive: true, discount: '0', studentType: 'returning', flippedTerm: null, flippedSession: null, financeClassId: classes[i % 4].id });
const students = Array.from({ length: 28 }, (_, i) => student(i));
const admission = (i: number): ReportingEvent => ({ id: `event-${i}`, sequence: String(i + 1), studentId: students[i].studentId, studentNumber: students[i].studentNumber, studentName: students[i].studentName, schoolId: students[i].schoolId, classId: students[i].classId, className: students[i].className, eventType: 'admission', admissionCategory: 'new', occurredAt: '2026-09-10T00:00:00Z', recordedAt: '2026-09-10T00:00:00Z', term: 'First Term', session: '2026/2027', dateVerified: true, periodVerified: true, classVerified: true, reason: null, actorId: 'admin', source: 'admin' });
const data: AnalyticsData = {
  schools, classes, students,
  events: [...students.map((_, i) => admission(i)), { ...admission(0), id: 'withdrawal-1', sequence: '40', eventType: 'withdrawal', reason: 'Relocation' }, { ...admission(0), id: 'readmission-1', sequence: '41', eventType: 'readmission', admissionCategory: 'readmitted' }],
  snapshots: schools.flatMap((s, i) => [{ id: `baseline-${i}`, schoolId: s.id, schoolName: s.name, session: '2024/2025', term: 'Third Term', snapshotKind: 'baseline', capturedAt: '2025-07-01T00:00:00Z', students: students.filter(st => st.schoolId === s.id) }, { id: `closing-${i}`, schoolId: s.id, schoolName: s.name, session: '2025/2026', term: 'Third Term', snapshotKind: 'term_end', capturedAt: '2026-07-01T00:00:00Z', students: students.filter(st => st.schoolId === s.id) }]),
  payments: schools.map((s, i) => ({ id: `payment-${i}`, schoolId: s.id, studentId: students[i].studentId, amount: String(10000 * (i + 1)), purpose: 'Tuition', term: 'First Term', session: '2026/2027', receivedAt: '2026-09-10T00:00:00Z' })),
  allocations: [], tuitionFees: schools.map((s, i) => ({ id: `fee-${i}`, schoolId: s.id, name: 'Tuition', isActive: true })), rates: [], charges: [],
  scores: students.map((s, i) => ({ id: `score-${i}`, studentId: s.studentId, schoolId: s.schoolId, classId: s.classId, subjectId: 'maths', subjectName: 'Mathematics', firstCA: 15, secondCA: 15, exam: i % 2 ? 30 : 45, term: 'First Term', session: '2026/2027', updatedAt: null })),
  attendance: students.map((s, i) => ({ id: `attendance-${i}`, studentId: s.studentId, schoolId: s.schoolId, classId: s.classId, totalDays: 20, presentDays: i % 4 ? 18 : 0, absentDays: i % 4 ? 2 : 20, term: 'First Term', session: '2026/2027', updatedAt: null })),
};
export const metadata = { schools, classes: [...classes, { id: 'archived-class', name: 'Historical Primary 2', schoolId: schools[0].id }], periods: schools.flatMap(s => ['2025/2026', '2026/2027'].flatMap(session => ['First Term', 'Third Term'].map(term => ({ schoolId: s.id, schoolName: s.name, session, term, populationSnapshot: session === '2025/2026' && term === 'Third Term', baselineObservation: false, lifecycleEvents: true, confirmedPayments: true, assessments: true, attendance: true })))) };
export function reportFixture(params: URLSearchParams) {
  const filters = analyticsFiltersSchema.parse(Object.fromEntries(params));
  const selected = filters.schoolIds || (filters.schoolId ? [filters.schoolId] : schools.map(s => s.id));
  return buildAnalyticsReport({ ...data, schools: schools.filter(s => selected.includes(s.id)) }, filters, () => () => 10000);
}
export function comparisonFixture(params: URLSearchParams) {
  const scope = Object.fromEntries([...params].filter(([key]) => ['schoolId', 'schoolIds', 'classId', 'passThreshold'].includes(key)));
  const original = reportFixture(new URLSearchParams({ ...scope, session: params.get('originalSession')!, ...(params.get('originalTerm') ? { term: params.get('originalTerm')! } : {}) }));
  const comparison = reportFixture(new URLSearchParams({ ...scope, session: params.get('comparisonSession')!, ...(params.get('comparisonTerm') ? { term: params.get('comparisonTerm')! } : {}) }));
  const metrics = fixtureChanges(original, comparison);
  const coverage = (r: typeof original) => ({ population: r.population.coverage, admissions: r.admissions.coverage, finance: r.finance.coverage, academics: r.academics.coverage, attendance: r.attendance.coverage });
  const bySchool = original.meta.selectedSchools.map(s => {
    const one = new URLSearchParams({ ...scope, schoolId: s.id, session: params.get('originalSession')!, ...(params.get('originalTerm') ? { term: params.get('originalTerm')! } : {}) });
    const two = new URLSearchParams({ ...scope, schoolId: s.id, session: params.get('comparisonSession')!, ...(params.get('comparisonTerm') ? { term: params.get('comparisonTerm')! } : {}) });
    one.delete('schoolIds'); two.delete('schoolIds');
    return { schoolId: s.id, schoolName: s.name, metrics: fixtureChanges(reportFixture(one), reportFixture(two)) };
  });
  return { mode: params.get('mode'), original: original.meta, comparison: comparison.meta, metrics, bySchool, coverage: { original: coverage(original), comparison: coverage(comparison) }, recordedEventComparisonsAreProvisional: true };
}
function fixtureChanges(one: GeneralSchoolReport, two: GeneralSchoolReport) {
  const values = (r: GeneralSchoolReport): Record<string, number | null> => ({
    activePopulation: r.population.combined.activeEnrolled,
    recordedNewAdmissions: r.admissions.coverage === 'available' ? r.admissions.originalNewAdmissions : null,
    recordedWithdrawals: r.withdrawals.coverage === 'available' ? r.withdrawals.uniqueStudentsWithdrawn : null,
    confirmedRevenue: r.finance.combined.confirmedRevenue, expectedTuition: r.finance.combined.expectedTuition,
    outstandingTuition: r.finance.combined.outstandingTuition, collectionRate: r.finance.combined.collectionRate,
    averageScore: r.academics.averageScore, passRate: r.academics.passRate, attendancePercentage: r.attendance.percentage,
  });
  const original = values(one), compared = values(two);
  return Object.fromEntries(Object.keys(original).map(name => [name, metricChange(original[name], compared[name])]));
}
