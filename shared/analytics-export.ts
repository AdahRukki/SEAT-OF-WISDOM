import type { AnalyticsReport, AnalyticsComparison, AnalyticsPeriods } from './general-school-analytics-contracts';
import { COMPARISON_METRICS } from './analytics-metrics';

export const EXPORT_REPORTS = {
  overview: 'General School overview', population: 'School-by-school population report',
  admissions: 'New admission register', withdrawals: 'Withdrawal and readmission report',
  finance: 'Financial performance comparison', comparison: 'Historical term/session comparison',
} as const;
export type ExportReport = keyof typeof EXPORT_REPORTS;
export type ExportCell = string | number | null;
export type ExportColumn = { label: string; unit?: 'number' | 'money' | 'percent' | 'points' };
export type ExportTable = { title: string; columns: ExportColumn[]; rows: ExportCell[][]; identityColumns?: number };
export type AnalyticsExportDocument = {
  brand: string; title: string; kind: ExportReport; exportedAt: string;
  metadata: [string, string][]; notes: string[]; tables: ExportTable[];
};
const col = (label: string, unit?: ExportColumn['unit']): ExportColumn => ({ label, unit });
const coverage = (value: string) => value === 'available' ? 'Available records' : value === 'partial' ? 'Partial records' : 'Unavailable';
type Meta = AnalyticsReport['meta'];
function scopeMetadata(meta: Meta, metadata?: AnalyticsPeriods): [string, string][] {
  const filters = meta.filters;
  return [
    ['Report generated (UTC)', meta.generatedAt], ['Schools', meta.selectedSchools.map(s => s.name).join(', ') || 'No schools in scope'],
    ['School IDs', meta.selectedSchools.map(s => s.id).join(', ') || 'None'],
    ['Session', filters.session || 'Each school’s current session'], ['Term', filters.session ? filters.term || 'Whole session' : 'Each school’s current term'],
    ['Class', filters.classId ? metadata?.classes.find(c => c.id === filters.classId)?.name || filters.classId : 'All classes'],
    ['Class ID', filters.classId || 'All classes'], ['Event/receipt date from (UTC)', filters.dateFrom || 'Any'], ['Event/receipt date to, inclusive (UTC)', filters.dateTo || 'Any'],
    ['Pass threshold / 100', String(filters.passThreshold)],
    ...meta.selectedSchools.map(s => [`${s.name} current academic period`, `${s.currentSession || 'Not recorded'} / ${s.currentTerm || 'Not recorded'}`] as [string, string]),
  ];
}
const commonNotes = [
  'N/A means evidence is unavailable; it is not zero. Genuine zero values remain zero.',
  'Exports contain the complete API register, regardless of dashboard search or pagination. The report uses the displayed API response; later database changes require refreshing the dashboard.',
  'Date ranges affect admission/withdrawal events and payment receipts only. Population, tuition balances, assessments and attendance follow the applied academic period.',
];
function reportNotes(r: AnalyticsReport): string[] {
  return [
    ...commonNotes,
    `Population: ${coverage(r.population.coverage)}. ${r.population.missingSchoolIds.length} schools lack a usable census; ${r.population.duplicateSchoolMemberships} overlapping school memberships deduplicated. Observed counts are not necessarily complete totals. Unfinished sessions are not final annual censuses.`,
    `Admissions: ${coverage(r.admissions.coverage)}. ${r.admissions.recordedOnly ? 'Recorded events only; historical counts may be incomplete.' : 'Verified event coverage for this period.'} ${r.admissions.admissionRecordsWithUnverifiedHistory} admission records in the selected schools have unverified history.`,
    `Withdrawals: ${coverage(r.withdrawals.coverage)}. Only official recorded withdrawals count; readmission preserves earlier events. ${r.withdrawals.recordedOnly ? 'Historical counts may be incomplete.' : 'Verified event coverage for this period.'}`,
    `Finance: ${coverage(r.finance.coverage)}. Confirmed receipts count once, including shared payments. Historical tuition classification or charge gaps remain N/A. Receipt dates affect received amounts; balances cover the full assigned period.`,
    `Academics: ${coverage(r.academics.coverage)}; provisional. ${r.academics.limitation} ${r.academics.weighting}.`,
    `Attendance: ${coverage(r.attendance.coverage)}. ${r.attendance.weighting}.`,
  ];
}
function newDocument(kind: ExportReport, metadata: [string, string][], notes: string[], exportedAt: string): AnalyticsExportDocument {
  return { brand: 'Seat of Wisdom Academy', title: EXPORT_REPORTS[kind], kind, exportedAt, metadata: [['Exported (UTC)', exportedAt], ...metadata], notes, tables: [] };
}

export function buildAnalyticsExport(r: AnalyticsReport, kind: Exclude<ExportReport, 'comparison'>, metadata?: AnalyticsPeriods, exportedAt = new Date().toISOString()): AnalyticsExportDocument {
  const doc = newDocument(kind, scopeMetadata(r.meta, metadata), reportNotes(r), exportedAt);
  const table = (title: string, columns: ExportColumn[], rows: ExportCell[][], identityColumns = 1) => doc.tables.push({ title, columns, rows, identityColumns });
  const metricColumns = [col('Metric'), col('Value'), col('Unit / basis')];
  const schoolName = (id: string) => r.meta.selectedSchools.find(s => s.id === id)?.name || 'Not recorded';
  if (kind === 'overview') {
    table('Executive summary', metricColumns, [
      ['Active enrolled students', r.population.combined.activeEnrolled, coverage(r.population.coverage)],
      ['Recorded new admissions', r.admissions.originalNewAdmissions, r.admissions.recordedOnly ? 'Recorded only; partial history' : 'Verified period events'],
      ['Recorded withdrawals', r.withdrawals.uniqueStudentsWithdrawn, r.withdrawals.recordedOnly ? 'Recorded only; partial history' : 'Verified period events'],
      ['Confirmed revenue', r.finance.combined.confirmedRevenue, 'NGN'], ['Outstanding tuition', r.finance.combined.outstandingTuition, 'NGN; full assigned period'],
      ['Assessment average', r.academics.averageScore, 'Score / 100; provisional'], ['Attendance', r.attendance.percentage, '% of recorded student-days'],
      ['Population growth', r.population.growth.percentageChange, '% versus previous closing census'],
    ]);
    table('Schools overview', [col('School'), col('Academic period'), col('Active students', 'number'), col('Recorded new admissions', 'number'), col('Recorded withdrawals', 'number'), col('Confirmed revenue (NGN)', 'money'), col('Assessment average / 100', 'number'), col('Attendance (%)', 'percent')], r.meta.selectedSchools.map(s => {
      const p = r.population.bySchool.find(row => row.schoolId === s.id);
      return [s.name, p?.period ? `${p.period.session} / ${p.period.term}` : 'Not recorded', p?.activeEnrolled ?? null, r.admissions.bySchool.find(row => row.schoolId === s.id)?.originalNewAdmissions ?? null, r.withdrawals.bySchool.find(row => row.schoolId === s.id)?.uniqueStudentsWithdrawn ?? null, r.finance.bySchool.find(row => row.schoolId === s.id)?.confirmedRevenue ?? null, r.academics.bySchool.find(row => row.schoolId === s.id)?.averageScore ?? null, r.attendance.bySchool.find(row => row.schoolId === s.id)?.percentage ?? null];
    }));
    table('Data completeness', [col('Area'), col('Coverage'), col('Recorded / usable'), col('Excluded / missing')], [
      ['Population', coverage(r.population.coverage), r.population.combined.observedActiveEnrolled, r.population.missingSchoolIds.length],
      ['Admissions', coverage(r.admissions.coverage), r.admissions.originalNewAdmissions, r.admissions.admissionRecordsWithUnverifiedHistory],
      ['Withdrawals', coverage(r.withdrawals.coverage), r.withdrawals.withdrawalEvents, r.withdrawals.unverifiedWithdrawalEvents],
      ['Academics', coverage(r.academics.coverage), r.academics.usableSubjectResults, r.academics.excludedIncompleteOrAmbiguousResults],
      ['Attendance', coverage(r.attendance.coverage), r.attendance.studentTermRecords, r.attendance.missingStudentTermRecords],
    ]);
  }
  if (kind === 'population') {
    const counts = r.population.combined;
    table('Combined population', metricColumns, [
      ['Active enrolled', counts.activeEnrolled, coverage(r.population.coverage)], ['Observed active enrolled', counts.observedActiveEnrolled, 'Available observations only'],
      ['Nursery / Primary observed', counts.nurseryPrimary, 'Observed'], ['Secondary observed', counts.secondary, 'Observed'], ['Unclassified class level', counts.unclassified, 'Observed'],
      ['New in admission period, observed', counts.newEnrolments, 'Preserved admission history'], ['Returning, observed', counts.returningEnrolments, 'Preserved admission history'], ['Admission classification unknown', counts.admissionClassificationUnknown, 'Observed'],
      ['Withdrawn in census', counts.withdrawn, 'Selected census'], ['Graduated in census', counts.graduated, 'Selected census'], ['Inactive accounts', counts.inactiveAccounts, 'Selected census'], ['Population growth', r.population.growth.percentageChange, '% versus previous closing census'],
    ]);
    table('School populations', [col('School'), col('Session'), col('Term'), col('Active students', 'number'), col('Observed active', 'number'), col('Nursery / Primary observed', 'number'), col('Secondary observed', 'number'), col('New observed', 'number'), col('Returning observed', 'number'), col('Admission unknown', 'number'), col('Withdrawn', 'number'), col('Graduated', 'number'), col('Census source'), col('Captured (UTC)'), col('Session complete')], r.population.bySchool.map(s => [s.schoolName, s.period?.session || 'Not recorded', s.period?.term || 'Not recorded', s.activeEnrolled, s.observedActiveEnrolled, s.nurseryPrimary, s.secondary, s.newEnrolments, s.returningEnrolments, s.admissionClassificationUnknown, s.withdrawn, s.graduated, s.source === 'term_end' ? 'Saved term-end census' : s.source === 'live' ? 'Current population' : 'Unavailable', s.capturedAt || 'Not recorded', s.sessionComplete ? 'Yes' : 'No']));
    table('Population by class', [col('School'), col('Historical class'), col('Class ID'), col('Active', 'number'), col('New observed', 'number'), col('Returning observed', 'number'), col('Admission unknown', 'number'), col('Withdrawn', 'number'), col('Graduated', 'number')], r.population.bySchool.flatMap(s => s.classes.map(c => [s.schoolName, c.className, c.classId || 'Unverified', c.activeEnrolled, c.newEnrolments, c.returningEnrolments, c.admissionClassificationUnknown, c.withdrawn, c.graduated])), 3);
  }
  if (kind === 'admissions') {
    table('Admission summary', metricColumns, [
      ['Original new admissions, recorded', r.admissions.originalNewAdmissions, coverage(r.admissions.coverage)], ['Returning registrations', r.admissions.returningRegistrations, 'Recorded events'],
      ['Readmission events', r.admissions.readmissionEvents, 'Recorded events'], ['Unique readmitted students', r.admissions.uniqueReadmittedStudents, 'Recorded students'],
      ['New with confirmed payment', r.admissions.newWithConfirmedPayments, 'Admission period'], ['New without confirmed payment', r.admissions.newWithoutConfirmedPayments, 'Admission period'],
      ['Admission growth', r.admissions.growth.percentageChange, '%; N/A when baseline unverified'], ['Selected new admissions without verified date', r.admissions.newAdmissionsWithoutVerifiedDate, 'Recorded events'],
    ]);
    table('Original new admission register', [col('Full student name'), col('Student number'), col('School'), col('Original admission class'), col('Class ID'), col('Admission date'), col('Session'), col('Term'), col('Date verified'), col('Class verified'), col('Confirmed payment'), col('Student ID'), col('Event ID')], r.admissions.register.filter(row => row.category === 'new').map(row => [row.studentName, row.studentNumber, row.schoolName, row.classVerified ? row.originalClassName || 'Unverified' : 'Unverified', row.originalClassId || 'Unverified', row.dateVerified ? row.admissionDate || 'Unverified' : 'Unverified', row.session || 'Unverified', row.term || 'Unverified', row.dateVerified ? 'Yes' : 'No', row.classVerified ? 'Yes' : 'No', row.hasConfirmedPayment ? 'Yes' : 'No', row.studentId, row.eventId]), 3);
    table('All registration events', [col('Full student name'), col('Student number'), col('School'), col('Category'), col('Original class'), col('Admission date'), col('Session'), col('Term'), col('Confirmed payment'), col('Event ID')], r.admissions.register.map(row => [row.studentName, row.studentNumber, row.schoolName, row.category || 'Unverified', row.classVerified ? row.originalClassName || 'Unverified' : 'Unverified', row.dateVerified ? row.admissionDate || 'Unverified' : 'Unverified', row.session || 'Unverified', row.term || 'Unverified', row.hasConfirmedPayment ? 'Yes' : 'No', row.eventId]), 3);
    table('Admissions by school and class', [col('School'), col('Original class'), col('Original new admissions', 'number')], r.admissions.bySchool.flatMap(s => s.byClass.map(c => [s.schoolName, c.className, c.originalNewAdmissions])));
    for (const [period, buckets] of Object.entries(r.admissions.buckets)) table(`New admissions by ${period}`, [col('Period'), col('Recorded new admissions', 'number')], buckets.map(b => [b.period, b.count]));
  }
  if (kind === 'withdrawals') {
    table('Withdrawal and retention summary', metricColumns, [
      ['Unique students officially withdrawn', r.withdrawals.uniqueStudentsWithdrawn, coverage(r.withdrawals.coverage)], ['Selected-period withdrawal events', r.withdrawals.withdrawalEvents, 'Recorded events'], ['Lifetime recorded withdrawal events', r.withdrawals.lifetimeRecordedWithdrawalEvents, 'Selected schools/class'],
      ['Currently withdrawn', r.withdrawals.currentlyWithdrawn, 'Current status'], ['Still withdrawn from selected period', r.withdrawals.stillWithdrawnFromSelectedPeriod, 'Current status'], ['Current status unknown', r.withdrawals.currentStatusUnknown, 'Selected-period students'],
      ['Readmission events', r.withdrawals.readmissionEvents, 'Selected period'], ['Withdrawal rate', r.withdrawals.withdrawalRate, '% of opening cohort'], ['Retention rate', r.withdrawals.retentionRate, '% of eligible opening cohort'], ['Opening active population', r.withdrawals.openingActivePopulation, 'Preserved opening census'], ['Graduated during period', r.withdrawals.graduatedDuringPeriod, 'Recorded students'],
    ]);
    table('Withdrawal register', [col('Full student name'), col('Student number'), col('School'), col('Class at withdrawal'), col('Withdrawal date'), col('Session'), col('Term'), col('Reason'), col('Current status'), col('Recorded by'), col('Student ID'), col('Event ID')], r.withdrawals.register.map(row => [row.studentName, row.studentNumber, schoolName(row.schoolId), row.className || 'Unverified', row.withdrawnDate || 'Unverified', row.session || 'Unverified', row.term || 'Unverified', row.reason || 'Not recorded', row.currentlyWithdrawn === null ? 'Unknown' : row.currentlyWithdrawn ? 'Withdrawn' : 'No longer withdrawn', row.actorId || 'Not recorded', row.studentId, row.eventId]), 3);
    table('Readmission register', [col('Full student name'), col('Student number'), col('School'), col('Class at readmission'), col('Readmission date'), col('Session'), col('Term'), col('Recorded by'), col('Student ID'), col('Event ID')], r.withdrawals.readmissionRegister.map(row => [row.studentName, row.studentNumber, schoolName(row.schoolId), row.className || 'Unverified', row.readmittedDate || 'Unverified', row.session || 'Unverified', row.term || 'Unverified', row.actorId || 'Not recorded', row.studentId, row.eventId]), 3);
    table('Withdrawal reasons', [col('Reason'), col('Unique students', 'number')], r.withdrawals.byReason.map(row => [row.reason, row.uniqueStudents]));
    table('Withdrawals by school', [col('School'), col('Opening population', 'number'), col('Unique withdrawn', 'number'), col('Withdrawal events', 'number'), col('Withdrawal rate (%)', 'percent')], r.withdrawals.bySchool.map(s => [s.schoolName, s.openingActivePopulation, s.uniqueStudentsWithdrawn, s.withdrawalEvents, s.withdrawalRate]));
    table('Withdrawals by class', [col('School'), col('Class'), col('Unique students withdrawn', 'number')], r.withdrawals.bySchool.flatMap(s => s.byClass.map(c => [s.schoolName, c.className, c.uniqueStudentsWithdrawn])));
  }
  if (kind === 'finance') {
    const columns = [col('Scope'), col('Confirmed revenue (NGN)', 'money'), col('Tuition received (NGN)', 'money'), col('Expected tuition (NGN)', 'money'), col('Tuition applied (NGN)', 'money'), col('Outstanding tuition (NGN)', 'money'), col('Students owing', 'number'), col('Collection rate (%)', 'percent')];
    const values = (name: string, s: AnalyticsReport['finance']['combined']): ExportCell[] => [name, s.confirmedRevenue, s.tuitionReceived, s.expectedTuition, s.appliedTuition, s.outstandingTuition, s.studentsOwing, s.collectionRate];
    table('Financial performance', columns, [values('Combined selected schools', r.finance.combined), ...r.finance.bySchool.map(s => values(s.schoolName, s))]);
    table('Financial verification', [col('School'), col('Tuition unverified students', 'number'), col('Missing population periods'), col('Invalid receipt allocations', 'number'), col('Historical payment class unknown', 'number'), col('Unallocated confirmed (NGN)', 'money'), col('Historical receipt classification unknown')], r.finance.bySchool.map(s => [s.schoolName, s.tuitionUnverifiedStudents, s.missingPopulationPeriods.map(p => p ? `${p.session} / ${p.term}` : 'Unverified academic period').join('; ') || 'None', s.invalidPaymentAllocations, s.paymentClassUnknown, s.unallocatedConfirmedAmount, s.historicalReceiptClassificationUnknown ? 'Yes' : 'No']));
    table('Assigned payment periods', [col('School'), col('Assigned session'), col('Assigned term'), col('Revenue (NGN)', 'money')], r.finance.bySchool.flatMap(s => s.assignedPeriods.map(p => [s.schoolName, p.session, p.term, p.revenue])));
    table('Monthly payment receipts', [col('School'), col('Receipt month (UTC)'), col('Revenue (NGN)', 'money')], r.finance.bySchool.flatMap(s => s.receiptMonths.map(p => [s.schoolName, p.month, p.revenue])));
    doc.notes.push(r.finance.balanceBasis, r.finance.tuitionClassificationBasis);
  }
  return doc;
}

export function buildComparisonExport(r: AnalyticsComparison, metadata?: AnalyticsPeriods, exportedAt = new Date().toISOString()): AnalyticsExportDocument {
  const doc = newDocument('comparison', scopeMetadata(r.original, metadata), [...commonNotes.filter(note => !note.startsWith('Date ranges')),
    'Comparison uses applied school/class/pass-threshold filters. Date ranges do not apply.',
    'Percentage change requires a valid, non-zero original value. Absolute rate differences are percentage points (pp). Recorded admissions/withdrawals require verified history; academic results remain provisional.',
    'Combined rates come from combined underlying numerators and denominators, rather than averaging school percentages.',
  ], exportedAt);
  doc.metadata.push(['Comparison mode', r.mode], ['Original period', `${r.original.filters.session} / ${r.original.filters.term || 'Whole session'}`], ['Comparison period', `${r.comparison.filters.session} / ${r.comparison.filters.term || 'Whole session'}`], ['Comparison report generated (UTC)', r.comparison.generatedAt]);
  for (const [period, values] of Object.entries(r.coverage)) for (const [area, value] of Object.entries(values)) doc.notes.push(`${period} ${area}: ${coverage(value)}`);
  const columns = [col('Scope'), col('Metric'), col('Original value'), col('Comparison value'), col('Absolute difference'), col('Percentage change (%)', 'percent'), col('Unit / difference unit')];
  const rows: ExportCell[][] = [];
  for (const scope of [{ schoolName: 'Combined selected schools', metrics: r.metrics }, ...r.bySchool]) for (const [key, definition] of Object.entries(COMPARISON_METRICS)) {
    const change = scope.metrics[key];
    rows.push([scope.schoolName, definition.label, change?.original ?? null, change?.comparison ?? null, change?.difference ?? null, change?.percentageChange ?? null, definition.unit === 'money' ? 'NGN' : definition.unit === 'percent' ? '% / pp difference' : 'Number']);
  }
  doc.tables.push({ title: 'Historical comparison', columns, rows, identityColumns: 2 });
  return doc;
}

export function analyticsExportFilename(doc: AnalyticsExportDocument, format: 'xlsx' | 'pdf'): string {
  return `Seat-of-Wisdom_${doc.kind}_${doc.exportedAt.replace(/[^0-9]/g, '').slice(0, 14)}.${format}`;
}
