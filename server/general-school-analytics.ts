import { resolveHistoricalTuition } from '../shared/historical-tuition';
import { summarizeTuition } from '../shared/tuition-summary';
import { ANALYTICS_TERMS, previousPeriod, metricChange, analyticsFiltersSchema, analyticsComparisonSchema, analyticsSessionSchema, type AnalyticsFilters, type AnalyticsComparisonFilters, type AcademicPeriod } from '../shared/general-school-analytics';
import { AnalyticsError, loadAnalyticsData, loadAvailablePeriods, type AnalyticsData, type ReportingDatabase, type ReportingSchool, type ReportingEvent, type ReportingRate } from './analytics-repository';
import type { PopulationSnapshotStudent } from '../shared/schema';

export type TuitionResolver = (rows: ReportingRate[], term?: string | null, session?: string | null) => (classId: string, studentType: string | null) => number;
const round = (value: number) => Math.round(value * 100) / 100;
const ratio = (numerator: number, denominator: number | null) => denominator !== null && denominator > 0 ? round(numerator / denominator * 100) : null;
const key = (period: AcademicPeriod) => `${period.session}:${period.term}`;
const active = (student: PopulationSnapshotStudent) => student.status === 'active' && student.accountActive === true;
const inDates = (value: string | null, filters: AnalyticsFilters) => !!value && (!filters.dateFrom || value.slice(0, 10) >= filters.dateFrom) && (!filters.dateTo || value.slice(0, 10) <= filters.dateTo);
const datesRequested = (filters: AnalyticsFilters) => !!(filters.dateFrom || filters.dateTo);

function cents(value: string | number): number | null {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const result = Math.round(Number(text) * 100);
  return Number.isSafeInteger(result) ? result : null;
}
function sumCents(values: number[]): number {
  const result = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(result)) throw new AnalyticsError('Money total exceeds the supported reporting range', 503);
  return result;
}

function periods(school: ReportingSchool, filters: AnalyticsFilters): AcademicPeriod[] {
  if (filters.session) return (filters.term ? [filters.term] : ANALYTICS_TERMS).map(term => ({ session: filters.session!, term }));
  return school.currentSession && analyticsSessionSchema.safeParse(school.currentSession).success && ANALYTICS_TERMS.includes(school.currentTerm as typeof ANALYTICS_TERMS[number])
    ? [{ session: school.currentSession, term: school.currentTerm! }] : [];
}
function inPeriod(row: { session: string | null; term: string | null }, school: ReportingSchool, filters: AnalyticsFilters) {
  return periods(school, filters).some(period => row.session === period.session && row.term === period.term);
}
function scopedSchools(data: AnalyticsData, filters: AnalyticsFilters) {
  return data.schools.filter(school => !filters.classId || data.classes.some(cls => cls.id === filters.classId && cls.schoolId === school.id));
}
type Roster = { school: ReportingSchool; period: AcademicPeriod | null; students: PopulationSnapshotStudent[]; source: 'live' | 'term_end' | 'unavailable'; capturedAt: string | null; classUnknown: number; sessionComplete: boolean };

function rosterFor(data: AnalyticsData, school: ReportingSchool, period: AcademicPeriod | null, filters: AnalyticsFilters): Roster {
  const snapshot = period ? data.snapshots.find(row => row.schoolId === school.id && row.session === period.session && row.term === period.term && row.snapshotKind === 'term_end') : undefined;
  const isCurrent = period?.session === school.currentSession && period?.term === school.currentTerm;
  const source = snapshot ? 'term_end' : isCurrent ? 'live' : 'unavailable';
  const all = snapshot?.students || (isCurrent ? data.students.filter(student => student.schoolId === school.id) : []);
  const deduplicated = Array.from(new Map(all.map(student => [student.studentId, student])).values());
  const classUnknown = deduplicated.filter(student => active(student) && (!student.classId || !student.historicalClassVerified)).length;
  return { school, period, source, capturedAt: snapshot?.capturedAt || null,
    students: deduplicated.filter(student => !filters.classId || student.historicalClassVerified && student.classId === filters.classId),
    classUnknown, sessionComplete: !filters.session || !!filters.term || period?.term === 'Third Term' };
}
function closingRoster(data: AnalyticsData, school: ReportingSchool, filters: AnalyticsFilters): Roster {
  let period: AcademicPeriod | null = null;
  if (filters.term && filters.session) period = { session: filters.session, term: filters.term };
  else if (filters.session) {
    const third = data.snapshots.some(row => row.schoolId === school.id && row.session === filters.session && row.term === 'Third Term' && row.snapshotKind === 'term_end');
    if (third) period = { session: filters.session, term: 'Third Term' };
    else if (school.currentSession === filters.session && ANALYTICS_TERMS.includes(school.currentTerm as typeof ANALYTICS_TERMS[number])) period = { session: filters.session, term: school.currentTerm! };
    // A past session needs its closing census, not a sum of its term populations.
  } else period = periods(school, filters)[0] || null;
  return rosterFor(data, school, period, filters);
}
function uniqueRoster(rosters: Roster[]) {
  const students = new Map<string, PopulationSnapshotStudent>();
  let overlap = 0;
  for (const roster of [...rosters].sort((a, b) => (a.capturedAt || '9999').localeCompare(b.capturedAt || '9999'))) {
    for (const student of roster.students) { if (students.has(student.studentId)) overlap++; students.set(student.studentId, student); }
  }
  return { students: Array.from(students.values()), overlap };
}
function level(name: string | null) {
  if (/\b(j\.?s\.?s|s\.?s\.?s?)(?=\s*[1-3]|\b)|\bsecondary\b/i.test(name || '')) return 'secondary';
  if (/\b(primary|pry|nursery|creche|crèche|reception|kindergarten|kg|basic)(?=\s*\d|\b)/i.test(name || '')) return 'nurseryPrimary';
  return 'unclassified';
}
function populationCounts(students: PopulationSnapshotStudent[], available: boolean, events: ReportingEvent[], selected: (event: ReportingEvent) => boolean) {
  const enrolled = students.filter(active);
  const admissions = new Map(events.filter(event => event.eventType === 'admission' && event.periodVerified).map(event => [event.studentId, event]));
  const newAdmissions = enrolled.filter(student => { const admission = admissions.get(student.studentId); return !!admission && admission.admissionCategory === 'new' && selected(admission); }).length;
  const knownAdmission = enrolled.filter(student => admissions.has(student.studentId)).length;
  const levels = { nurseryPrimary: 0, secondary: 0, unclassified: 0 };
  for (const student of enrolled) levels[level(student.className)]++;
  return { activeEnrolled: available ? enrolled.length : null, observedActiveEnrolled: enrolled.length, ...levels,
    newEnrolments: newAdmissions, returningEnrolments: knownAdmission - newAdmissions, admissionClassificationUnknown: enrolled.length - knownAdmission,
    withdrawn: available ? students.filter(student => student.status === 'withdrawn').length : null,
    graduated: available ? students.filter(student => student.status === 'graduated').length : null,
    inactiveAccounts: students.filter(student => student.status === 'active' && student.accountActive !== true).length };
}
function eventMatches(event: ReportingEvent, schools: ReportingSchool[], filters: AnalyticsFilters, applyDates = true) {
  const school = schools.find(row => row.id === event.schoolId);
  return !!school && event.periodVerified && inPeriod(event, school, filters)
    && (!filters.classId || event.classVerified && event.classId === filters.classId)
    && (!applyDates || !datesRequested(filters) || event.dateVerified && inDates(event.occurredAt, filters));
}
function eventCoverage(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters) {
  const order = (period: AcademicPeriod) => Number(period.session.slice(0, 4)) * 3 + ANALYTICS_TERMS.indexOf(period.term as typeof ANALYTICS_TERMS[number]);
  return schools.length > 0 && schools.every(school => {
    const baseline = data.snapshots.find(row => row.schoolId === school.id && row.snapshotKind === 'baseline');
    if (!baseline || !periods(school, filters).length) return false;
    const current = periods(school, { passThreshold: filters.passThreshold })[0];
    if (!current || periods(school, filters).some(period => order(period) > order(current)
      && !data.snapshots.some(snapshot => snapshot.schoolId === school.id && key(snapshot) === key(period) && snapshot.snapshotKind === 'term_end'))) return false;
    if (filters.dateFrom && filters.dateFrom > new Date().toISOString().slice(0, 10)) return false;
    const covered = datesRequested(filters) && filters.dateFrom ? filters.dateFrom > baseline.capturedAt.slice(0, 10)
      : periods(school, filters).every(period => order(period) > order(baseline));
    const uncertain = data.events.some(event => event.schoolId === school.id && ['admission', 'withdrawal', 'readmission'].includes(event.eventType)
      && inPeriod(event, school, filters) && (!event.periodVerified || datesRequested(filters) && !event.dateVerified));
    return covered && !uncertain;
  });
}
function timeBuckets(events: ReportingEvent[]) {
  const week = new Map<string, number>(), month = new Map<string, number>(), term = new Map<string, number>(), session = new Map<string, number>();
  const add = (map: Map<string, number>, value: string) => map.set(value, (map.get(value) || 0) + 1);
  for (const event of events) {
    if (event.session) add(session, event.session);
    if (event.session && event.term) add(term, `${event.session}:${event.term}`);
    if (!event.dateVerified || !event.occurredAt) continue;
    add(month, event.occurredAt.slice(0, 7));
    const date = new Date(`${event.occurredAt.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) continue;
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    add(week, date.toISOString().slice(0, 10));
  }
  const entries = (map: Map<string, number>) => Array.from(map, ([period, count]) => ({ period, count })).sort((a, b) => a.period.localeCompare(b.period));
  return { weeks: entries(week), months: entries(month), terms: entries(term), sessions: entries(session) };
}

type Allocation = { paymentId: string; studentId: string; schoolId: string; amount: number; purpose: string | null; isTuition: boolean; term: string | null; session: string | null; receivedAt: string };
function paymentAllocations(data: AnalyticsData) {
  const allocations: Allocation[] = [];
  const invalidPayments = new Set<string>();
  const unallocated = new Map<string, number>();
  const splits = new Map<string, typeof data.allocations>();
  for (const split of data.allocations) { const bucket = splits.get(split.paymentId) || []; bucket.push(split); splits.set(split.paymentId, bucket); }
  for (const payment of data.payments) {
    const parent = cents(payment.amount);
    if (parent === null) { invalidPayments.add(payment.id); continue; }
    const parts = splits.get(payment.id);
    const shares = parts?.length ? parts : payment.studentId ? [{ id: payment.id, paymentId: payment.id, studentId: payment.studentId, amount: payment.amount, purpose: payment.purpose }] : [];
    const amounts = shares.map(share => cents(share.amount));
    if (amounts.some(amount => amount === null) || sumCents(amounts as number[]) > parent) { invalidPayments.add(payment.id); continue; }
    unallocated.set(payment.id, parent - sumCents(amounts as number[]));
    shares.forEach((share, index) => allocations.push({ ...payment, paymentId: payment.id, studentId: share.studentId, amount: amounts[index]!, purpose: share.purpose,
      isTuition: data.tuitionFees.some(fee => fee.schoolId === payment.schoolId && fee.name === share.purpose) }));
  }
  return { allocations, invalidPayments, unallocated };
}

function buildPopulation(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters) {
  const rosters = schools.map(school => closingRoster(data, school, filters));
  const available = rosters.length > 0 && rosters.every(roster => roster.source !== 'unavailable' && (!filters.classId || roster.classUnknown === 0));
  const combined = uniqueRoster(rosters);
  const counts = populationCounts(combined.students, available, data.events, event => eventMatches(event, schools, filters, false));
  const opening = rosters.map(roster => rosterFor(data, roster.school, filters.session && !filters.term
    ? previousPeriod({ session: filters.session, term: 'First Term' })
    : roster.period ? previousPeriod(roster.period) : null, filters));
  // Live data is never a substitute for the previous period's closing census.
  const previousAvailable = opening.length > 0 && opening.every(roster => roster.source === 'term_end' && (!filters.classId || roster.classUnknown === 0));
  const previous = uniqueRoster(opening).students.filter(active).length;
  return { coverage: !available ? 'unavailable' as const : combined.overlap || rosters.some(roster => !roster.sessionComplete || roster.classUnknown > 0) ? 'partial' as const : 'available' as const,
    combined: counts, growth: metricChange(previousAvailable ? previous : null, counts.activeEnrolled), duplicateSchoolMemberships: combined.overlap,
    bySchool: rosters.map(roster => ({ schoolId: roster.school.id, schoolName: roster.school.name, period: roster.period, source: roster.source, capturedAt: roster.capturedAt,
      sessionComplete: roster.sessionComplete, historicalClassUnknown: roster.classUnknown,
      ...populationCounts(roster.students, roster.source !== 'unavailable' && (!filters.classId || roster.classUnknown === 0), data.events, event => event.schoolId === roster.school.id && eventMatches(event, [roster.school], filters, false)),
      classes: Array.from(new Set(roster.students.map(student => student.classId))).map(classId => ({ classId,
        className: roster.students.find(student => student.classId === classId)?.className || 'Historical class not verified',
        ...populationCounts(roster.students.filter(student => student.classId === classId), roster.source !== 'unavailable', data.events, event => eventMatches(event, [roster.school], filters, false)) })),
    })),
    missingSchoolIds: rosters.filter(roster => roster.source === 'unavailable').map(roster => roster.school.id),
    dateRangeApplies: false,
  };
}

function buildAdmissions(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters, allocations: Allocation[]) {
  const relevant = data.events.filter(event => ['admission', 'readmission'].includes(event.eventType) && eventMatches(event, schools, filters));
  const newEvents = relevant.filter(event => event.eventType === 'admission' && event.admissionCategory === 'new');
  const register = relevant.map(event => ({ eventId: event.id, studentId: event.studentId, studentNumber: event.studentNumber, studentName: event.studentName,
    schoolId: event.schoolId, schoolName: schools.find(school => school.id === event.schoolId)!.name,
    originalClassId: event.classId, originalClassName: event.className, category: event.eventType === 'readmission' ? 'readmitted' : event.admissionCategory,
    admissionDate: event.dateVerified ? event.occurredAt?.slice(0, 10) || null : null, term: event.term, session: event.session,
    dateVerified: event.dateVerified, classVerified: event.classVerified,
    hasConfirmedPayment: allocations.some(allocation => allocation.studentId === event.studentId && allocation.schoolId === event.schoolId && allocation.term === event.term && allocation.session === event.session && allocation.amount > 0),
  }));
  const newRegister = register.filter(row => row.category === 'new');
  const verifiedDates = newEvents.filter(event => event.dateVerified && event.occurredAt).length;
  const unknown = data.events.filter(event => schools.some(school => school.id === event.schoolId) && ['admission', 'legacy_observation'].includes(event.eventType)
    && (!event.periodVerified || !event.dateVerified || !event.classVerified)).length;
  // A date slice cannot be compared with the entire previous academic period.
  const previousFilters = filters.session && !datesRequested(filters) ? analyticsFiltersSchema.parse({ ...filters,
    ...(filters.term ? previousPeriod({ term: filters.term, session: filters.session })
      : { session: `${Number(filters.session.slice(0, 4)) - 1}/${Number(filters.session.slice(5)) - 1}`, term: undefined }),
    dateFrom: undefined, dateTo: undefined }) : undefined;
  const previousCount = previousFilters ? data.events.filter(event => event.eventType === 'admission' && event.admissionCategory === 'new' && eventMatches(event, schools, previousFilters)).length : null;
  // Event history establishes recorded admissions, not a complete historical
  // admission census. Do not produce a growth claim from an unknown baseline.
  const complete = eventCoverage(data, schools, filters);
  const previousComplete = previousFilters ? eventCoverage(data, schools, previousFilters) : false;
  return { coverage: complete ? 'available' as const : 'partial' as const, recordedOnly: !complete, originalNewAdmissions: new Set(newEvents.map(event => event.studentId)).size,
    returningRegistrations: relevant.filter(event => event.eventType === 'admission' && event.admissionCategory === 'returning').length,
    readmissionEvents: relevant.filter(event => event.eventType === 'readmission' || event.admissionCategory === 'readmitted').length,
    uniqueReadmittedStudents: new Set(relevant.filter(event => event.eventType === 'readmission' || event.admissionCategory === 'readmitted').map(event => event.studentId)).size,
    newWithConfirmedPayments: newRegister.filter(row => row.hasConfirmedPayment).length, newWithoutConfirmedPayments: newRegister.filter(row => !row.hasConfirmedPayment).length,
    admissionRecordsWithUnverifiedHistory: unknown, newAdmissionsWithoutVerifiedDate: newEvents.length - verifiedDates,
    growth: metricChange(complete && previousComplete ? previousCount : null, complete ? newEvents.length : null), previousRecordedAdmissions: previousCount,
    historicalGrowthVerified: complete && previousComplete, buckets: timeBuckets(newEvents), register,
    bySchool: schools.map(school => ({ schoolId: school.id, schoolName: school.name, originalNewAdmissions: newEvents.filter(event => event.schoolId === school.id).length,
      byClass: data.classes.filter(cls => cls.schoolId === school.id && (!filters.classId || cls.id === filters.classId)).map(cls => ({ classId: cls.id, className: cls.name,
        originalNewAdmissions: newEvents.filter(event => event.classVerified && event.classId === cls.id).length })) })),
  };
}

function buildWithdrawals(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters) {
  const events = data.events.filter(event => event.eventType === 'withdrawal' && eventMatches(event, schools, filters));
  const unique = new Set(events.map(event => event.studentId));
  const now = new Map(data.students.map(student => [student.studentId, student]));
  const rosters = schools.map(school => closingRoster(data, school, filters));
  const opening = rosters.map(roster => rosterFor(data, roster.school, roster.period ? previousPeriod(filters.session && !filters.term ? { session: filters.session, term: 'First Term' } : roster.period) : null, filters));
  const openingAvailable = !datesRequested(filters) && opening.length > 0 && opening.every(roster => roster.source === 'term_end' && (!filters.classId || roster.classUnknown === 0));
  const start = uniqueRoster(opening).students.filter(active);
  const startIds = new Set(start.map(student => student.studentId));
  const cohortWithdrawn = Array.from(unique).filter(id => startIds.has(id)).length;
  const closingAvailable = rosters.every(roster => roster.source !== 'unavailable' && (!filters.classId || roster.classUnknown === 0));
  const endIds = new Set(uniqueRoster(rosters).students.filter(active).map(student => student.studentId));
  const graduated = new Set(data.events.filter(event => event.eventType === 'graduation' && eventMatches(event, schools, filters)).map(event => event.studentId));
  const eligible = start.filter(student => !graduated.has(student.studentId));
  const retained = eligible.filter(student => endIds.has(student.studentId)).length;
  const reasons = new Map<string, Set<string>>();
  for (const event of events) { const reason = event.reason || 'Not recorded'; const bucket = reasons.get(reason) || new Set<string>(); bucket.add(event.studentId); reasons.set(reason, bucket); }
  const complete = eventCoverage(data, schools, filters);
  return { coverage: complete ? 'available' as const : 'partial' as const, recordedOnly: !complete, uniqueStudentsWithdrawn: unique.size, withdrawalEvents: events.length,
    lifetimeRecordedWithdrawalEvents: data.events.filter(event => event.eventType === 'withdrawal' && schools.some(school => school.id === event.schoolId) && (!filters.classId || event.classVerified && event.classId === filters.classId)).length,
    unverifiedWithdrawalEvents: data.events.filter(event => event.eventType === 'withdrawal' && !event.periodVerified && schools.some(school => school.id === event.schoolId)).length,
    currentlyWithdrawn: data.students.filter(student => schools.some(school => school.id === student.schoolId) && student.status === 'withdrawn' && (!filters.classId || student.classId === filters.classId)).length,
    stillWithdrawnFromSelectedPeriod: Array.from(unique).filter(id => now.get(id)?.status === 'withdrawn').length,
    currentStatusUnknown: Array.from(unique).filter(id => !now.has(id)).length,
    readmissionEvents: data.events.filter(event => event.eventType === 'readmission' && eventMatches(event, schools, filters)).length,
    readmissionRegister: data.events.filter(event => event.eventType === 'readmission' && eventMatches(event, schools, filters)).map(event => ({
      eventId: event.id, studentId: event.studentId, studentNumber: event.studentNumber, studentName: event.studentName, schoolId: event.schoolId, classId: event.classId,
      className: event.classVerified ? event.className : null,
      term: event.term, session: event.session, readmittedDate: event.dateVerified ? event.occurredAt?.slice(0, 10) || null : null, actorId: event.actorId,
    })),
    graduatedDuringPeriod: new Set(data.events.filter(event => event.eventType === 'graduation' && eventMatches(event, schools, filters)).map(event => event.studentId)).size,
    openingActivePopulation: openingAvailable ? start.length : null, openingCohortWithdrawn: cohortWithdrawn,
    withdrawalRate: openingAvailable && complete ? ratio(cohortWithdrawn, start.length) : null,
    retentionRate: openingAvailable && closingAvailable ? ratio(retained, eligible.length) : null,
    retentionEligibleStudents: openingAvailable ? eligible.length : null,
    byReason: Array.from(reasons, ([reason, ids]) => ({ reason, uniqueStudents: ids.size })),
    register: events.map(event => ({ eventId: event.id, studentId: event.studentId, studentNumber: event.studentNumber, studentName: event.studentName,
      schoolId: event.schoolId, classId: event.classId, className: event.className, term: event.term, session: event.session,
      withdrawnDate: event.dateVerified ? event.occurredAt?.slice(0, 10) || null : null, reason: event.reason, actorId: event.actorId,
      currentlyWithdrawn: now.has(event.studentId) ? now.get(event.studentId)!.status === 'withdrawn' : null })),
    bySchool: schools.map(school => {
      const schoolStart = opening.find(roster => roster.school.id === school.id);
      const schoolStartIds = new Set(schoolStart?.students.filter(active).map(student => student.studentId));
      const schoolWithdrawn = new Set(events.filter(event => event.schoolId === school.id).map(event => event.studentId));
      const verified = schoolStart?.source === 'term_end' && (!filters.classId || schoolStart.classUnknown === 0) && !datesRequested(filters) && eventCoverage(data, [school], filters);
      return { schoolId: school.id, schoolName: school.name,
      openingActivePopulation: verified ? schoolStartIds.size : null,
      withdrawalRate: verified ? ratio(Array.from(schoolWithdrawn).filter(id => schoolStartIds.has(id)).length, schoolStartIds.size) : null,
      uniqueStudentsWithdrawn: new Set(events.filter(event => event.schoolId === school.id).map(event => event.studentId)).size,
      withdrawalEvents: events.filter(event => event.schoolId === school.id).length,
      byClass: data.classes.filter(cls => cls.schoolId === school.id && (!filters.classId || cls.id === filters.classId)).map(cls => ({ classId: cls.id, className: cls.name,
        uniqueStudentsWithdrawn: new Set(events.filter(event => event.classVerified && event.classId === cls.id).map(event => event.studentId)).size })) };
    }),
  };
}

function buildFinance(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters, payments: ReturnType<typeof paymentAllocations>, resolveTuition: TuitionResolver) {
  const bySchool = schools.map(school => {
    const selectedPeriods = periods(school, filters);
    const allocations = payments.allocations.filter(allocation => allocation.schoolId === school.id && inPeriod(allocation, school, filters));
    const rosters = selectedPeriods.map(period => rosterFor(data, school, period, { ...filters, classId: undefined }));
    const entries: { studentId: string; tuitionAssigned: number; tuitionPaid: number; tuitionKnown: boolean; studentType: string }[] = [];
    const classFor = (studentId: string, period: AcademicPeriod) => {
      const roster = rosters.find(roster => key(roster.period!) === key(period));
      const student = roster?.students.find(student => student.studentId === studentId);
      if (roster?.source === 'live') return data.students.find(student => student.studentId === studentId)?.financeClassId;
      return student?.historicalClassVerified ? student.classId : undefined;
    };
    for (const roster of rosters) {
      const period = roster.period!;
      const fees = data.tuitionFees.filter(fee => fee.schoolId === school.id);
      const rates = data.rates.filter(rate => fees.some(fee => fee.id === rate.feeTypeId)).map(rate => ({...rate,active:fees.find(fee => fee.id === rate.feeTypeId)?.isActive}));
      const ids = new Set(roster.students.filter(student => !filters.classId || classFor(student.studentId, period) === filters.classId).map(student => student.studentId));
      data.charges.filter(charge => charge.schoolId === school.id && key(charge) === key(period) && (!filters.classId || classFor(charge.studentId, period) === filters.classId)).forEach(charge => ids.add(charge.studentId));
      allocations.filter(allocation => key(allocation as AcademicPeriod)===key(period) && (!filters.classId || classFor(allocation.studentId,period)===filters.classId)).forEach(allocation => ids.add(allocation.studentId));
      for (const studentId of Array.from(ids)) {
        const saved = data.charges.filter(charge => charge.schoolId === school.id && charge.studentId === studentId && key(charge) === key(period));
        const student = data.students.find(row => row.studentId === studentId);
        const classId = classFor(studentId, period);
        const tuitionPaid = sumCents(allocations.filter(allocation => allocation.studentId === studentId && key(allocation as AcademicPeriod) === key(period) && allocation.isTuition).map(allocation => allocation.amount)) / 100;
        const savedAmount = saved.length ? saved.every(charge => cents(charge.amount) !== null) ? sumCents(saved.map(charge => cents(charge.amount)!)) / 100 : NaN : null;
        const facts = resolveHistoricalTuition({schoolId:school.id,period,
          currentPeriod:school.currentTerm && school.currentSession ? {term:school.currentTerm,session:school.currentSession} : undefined,
          student:{studentDbId:studentId,classId:classId || null,className:student?.className,schoolId:student?.schoolId || school.id,
            status:student?.status,studentType:student?.studentType || null,discount:student?.discount || null,
            flippedTerm:student?.flippedTerm,flippedSession:student?.flippedSession,savedTuition:savedAmount,
            paymentCount:allocations.filter(allocation => allocation.studentId===studentId && key(allocation as AcademicPeriod)===key(period)).length},
          events:data.events,snapshots:data.snapshots.filter(snapshot => snapshot.schoolId===school.id),rates,
          classNames:Object.fromEntries(data.classes.filter(cls => cls.schoolId===school.id).map(cls => [cls.id,cls.name]))});
        if (facts.included) entries.push({ studentId,tuitionAssigned:facts.tuitionAssigned,tuitionPaid,tuitionKnown:facts.tuitionKnown,studentType:facts.studentType });
      }
    }
    const summary = summarizeTuition(entries);
    const rosterComplete = rosters.length > 0 && rosters.every(roster => roster.source !== 'unavailable' && (!filters.classId || roster.classUnknown === 0));
    const known = rosterComplete && summary.tuitionUnverifiedCount === 0;
    const received = allocations.filter(allocation => !datesRequested(filters) || inDates(allocation.receivedAt, filters));
    const classReceived = filters.classId ? received.filter(allocation => classFor(allocation.studentId, allocation as AcademicPeriod) === filters.classId) : received;
    const records = data.payments.filter(payment => payment.schoolId === school.id && inPeriod(payment, school, filters) && (!datesRequested(filters) || inDates(payment.receivedAt, filters)));
    const unknownClassAllocations = filters.classId ? received.filter(allocation => !classFor(allocation.studentId, allocation as AcademicPeriod)).length : 0;
    const invalid = records.filter(record => payments.invalidPayments.has(record.id)).length;
    const invalidReceiptAmounts = records.filter(record => cents(record.amount) === null).length;
    const invalidInAssignedPeriod = data.payments.filter(record => record.schoolId === school.id && inPeriod(record, school, filters) && payments.invalidPayments.has(record.id)).length;
    const tuitionDefinitionKnown = data.tuitionFees.some(fee => fee.schoolId === school.id);
    const historicalReceiptClassificationUnknown = data.payments.some(record => record.schoolId === school.id && inPeriod(record, school, filters)
      && (record.session !== school.currentSession || record.term !== school.currentTerm));
    const revenue = filters.classId ? sumCents(classReceived.map(allocation => allocation.amount)) / 100
      : sumCents(records.map(record => cents(record.amount) || 0)) / 100;
    const owing = new Set(entries.filter(entry => entry.tuitionKnown && entry.tuitionAssigned > entry.tuitionPaid).map(entry => entry.studentId)).size;
    const unallocatedConfirmedAmount = sumCents(records.map(record => payments.unallocated.get(record.id) || 0)) / 100;
    return { schoolId: school.id, schoolName: school.name, periods: selectedPeriods,
      confirmedRevenue: !selectedPeriods.length || invalidReceiptAmounts || filters.classId && (invalid || unknownClassAllocations || unallocatedConfirmedAmount > 0) ? null : revenue, observedConfirmedRevenue: revenue,
      tuitionReceived: !selectedPeriods.length || invalid || unknownClassAllocations || !tuitionDefinitionKnown || historicalReceiptClassificationUnknown || unallocatedConfirmedAmount > 0 ? null : sumCents(classReceived.filter(allocation => allocation.isTuition).map(allocation => allocation.amount)) / 100,
      expectedTuition: known ? summary.totalFees : null, observedExpectedTuition: summary.totalFees,
      appliedTuition: known && !invalidInAssignedPeriod && !historicalReceiptClassificationUnknown ? summary.actualTuitionCollected : null, observedAppliedTuition: summary.actualTuitionCollected,
      outstandingTuition: known && !invalidInAssignedPeriod && !historicalReceiptClassificationUnknown ? summary.totalOutstanding : null, observedOutstandingTuition: summary.totalOutstanding,
      studentsOwing: known && !invalidInAssignedPeriod && !historicalReceiptClassificationUnknown ? owing : null, observedStudentsOwing: owing,
      owingStudentIds: Array.from(new Set(entries.filter(entry => entry.tuitionKnown && entry.tuitionAssigned > entry.tuitionPaid).map(entry => entry.studentId))),
      collectionRate: known && !invalidInAssignedPeriod && !historicalReceiptClassificationUnknown ? ratio(summary.actualTuitionCollected, summary.totalFees) : null,
      historicalReceiptClassificationUnknown,
      tuitionUnverifiedStudents: new Set(entries.filter(entry => !entry.tuitionKnown).map(entry => entry.studentId)).size,
      missingPopulationPeriods: rosters.filter(roster => roster.source === 'unavailable').map(roster => roster.period),
      invalidPaymentAllocations: invalid, invalidAllocationsInAssignedPeriod: invalidInAssignedPeriod, paymentClassUnknown: unknownClassAllocations,
      unallocatedConfirmedAmount,
      confirmedPaymentRecords: records.length,
      assignedPeriods: selectedPeriods.map(period => ({ ...period, revenue: filters.classId ? sumCents(classReceived.filter(allocation => key(allocation as AcademicPeriod) === key(period)).map(allocation => allocation.amount)) / 100
        : sumCents(records.filter(record => record.session === period.session && record.term === period.term).map(record => cents(record.amount) || 0)) / 100 })),
      receiptMonths: Array.from(new Set(records.map(record => record.receivedAt.slice(0, 7)))).sort().map(month => ({ month,
        revenue: filters.classId ? sumCents(classReceived.filter(allocation => allocation.receivedAt.startsWith(month)).map(allocation => allocation.amount)) / 100
          : sumCents(records.filter(record => record.receivedAt.startsWith(month)).map(record => cents(record.amount) || 0)) / 100 })),
    };
  });
  const total = (field: 'confirmedRevenue' | 'tuitionReceived' | 'expectedTuition' | 'appliedTuition' | 'outstandingTuition' | 'studentsOwing') => bySchool.length && bySchool.every(row => row[field] !== null) ? round(bySchool.reduce((sum, row) => sum + row[field]!, 0)) : null;
  const expected = total('expectedTuition'), applied = total('appliedTuition');
  return { currency: 'NGN' as const, coverage: bySchool.length && bySchool.every(row => row.expectedTuition !== null && row.confirmedRevenue !== null && row.appliedTuition !== null && row.tuitionReceived !== null) ? 'available' as const : 'partial' as const,
    combined: { confirmedRevenue: total('confirmedRevenue'), tuitionReceived: total('tuitionReceived'), expectedTuition: expected, appliedTuition: applied,
      outstandingTuition: total('outstandingTuition'), studentsOwing: total('studentsOwing') !== null ? new Set(bySchool.flatMap(row => row.owingStudentIds)).size : null, collectionRate: applied !== null ? ratio(applied, expected) : null },
    bySchool, receiptDateRange: { from: filters.dateFrom || null, toInclusive: filters.dateTo || null },
    tuitionClassificationBasis: 'Payment purposes matched to currently recorded tuition fee names; historical receipt classifications require preserved fee-purpose evidence',
    balanceBasis: 'Full assigned academic period using confirmed allocations; receipt date filters apply to revenue and tuitionReceived only',
  };
}

function deduplicate<T extends { id: string; updatedAt: string | null }>(rows: T[], identity: (row: T) => string) {
  const map = new Map<string, T>();
  for (const row of [...rows].sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || '') || a.id.localeCompare(b.id))) map.set(identity(row), row);
  return { rows: Array.from(map.values()), duplicates: rows.length - map.size };
}
function buildPerformance(data: AnalyticsData, schools: ReportingSchool[], filters: AnalyticsFilters) {
  const matches = (row: { schoolId: string; classId: string; term: string; session: string }) => {
    const school = schools.find(school => school.id === row.schoolId);
    return !!school && inPeriod(row, school, filters) && (!filters.classId || row.classId === filters.classId);
  };
  const scores = deduplicate(data.scores.filter(matches), row => `${row.studentId}:${row.subjectId}:${row.session}:${row.term}`);
  const usable = scores.rows.filter(row => row.firstCA !== null && row.secondCA !== null && row.exam !== null
    && row.firstCA > 0 && row.firstCA <= 20 && row.secondCA > 0 && row.secondCA <= 20 && row.exam > 0 && row.exam <= 60);
  function academicSummary(rows: typeof usable) {
    const students = new Map<string, { total: number; exam: number; subjects: number }>();
    for (const row of rows) { const student = students.get(row.studentId) || { total: 0, exam: 0, subjects: 0 };
      student.total += row.firstCA! + row.secondCA! + row.exam!; student.exam += row.exam! / 60 * 100; student.subjects++; students.set(row.studentId, student); }
    const means = Array.from(students.values()).map(student => ({ total: student.total / student.subjects, exam: student.exam / student.subjects }));
    const passing = means.filter(student => student.total >= filters.passThreshold).length;
    return { averageScore: means.length ? round(means.reduce((sum, student) => sum + student.total, 0) / means.length) : null,
      averageExamPercentage: means.length ? round(means.reduce((sum, student) => sum + student.exam, 0) / means.length) : null,
      studentsWithUsableScores: means.length, passingStudents: passing, passRate: ratio(passing, means.length), usableSubjectResults: rows.length };
  }
  const attendance = deduplicate(data.attendance.filter(matches), row => `${row.studentId}:${row.session}:${row.term}`);
  const validAttendance = attendance.rows.filter(row => row.totalDays > 0 && row.presentDays >= 0 && row.absentDays >= 0 && row.presentDays + row.absentDays === row.totalDays);
  function attendanceSummary(rows: typeof validAttendance) {
    const possibleDays = rows.reduce((sum, row) => sum + row.totalDays, 0), presentDays = rows.reduce((sum, row) => sum + row.presentDays, 0);
    return { possibleDays, presentDays, percentage: ratio(presentDays, possibleDays), recordedStudents: new Set(rows.map(row => row.studentId)).size, studentTermRecords: rows.length };
  }
  const termCohorts = schools.flatMap(school => periods(school, filters).map(period => rosterFor(data, school, period, filters)));
  const cohortAvailable = termCohorts.length > 0 && termCohorts.every(roster => roster.source !== 'unavailable' && (!filters.classId || roster.classUnknown === 0));
  const expectedAttendance = new Set(termCohorts.flatMap(roster => roster.students.filter(active).map(student => `${student.studentId}:${key(roster.period!)}`)));
  const recordedAttendance = new Set(validAttendance.map(row => `${row.studentId}:${key(row)}`));
  const matchedAttendance = Array.from(expectedAttendance).filter(value => recordedAttendance.has(value)).length;
  return {
    academics: { coverage: usable.length ? 'partial' as const : 'unavailable' as const, passThreshold: filters.passThreshold,
      weighting: 'Each student contributes one mean of their usable subject results across the selected periods', ...academicSummary(usable),
      recordedSubjectResults: scores.rows.length, excludedIncompleteOrAmbiguousResults: scores.rows.length - usable.length, duplicateSubjectRows: scores.duplicates,
      zeroCompletionVerified: false, approvedSubjectSelectionVerified: false,
      limitation: 'Legacy zero defaults cannot distinguish an unentered component from a real zero. Results with any zero, missing or invalid component are excluded; exact approved subject selections are not stored.',
      bySchool: schools.map(school => ({ schoolId: school.id, schoolName: school.name, ...academicSummary(usable.filter(row => row.schoolId === school.id)),
        classes: data.classes.filter(cls => cls.schoolId === school.id && (!filters.classId || cls.id === filters.classId)).map(cls => ({ classId: cls.id, className: cls.name, ...academicSummary(usable.filter(row => row.classId === cls.id)) })) })),
      bySubject: Array.from(new Set(usable.map(row => row.subjectId))).map(subjectId => ({ subjectId, subjectName: usable.find(row => row.subjectId === subjectId)!.subjectName, ...academicSummary(usable.filter(row => row.subjectId === subjectId)) })),
      byPeriod: Array.from(new Set(scores.rows.map(row => key(row)))).sort().map(period => ({ period, ...academicSummary(usable.filter(row => key(row) === period)) })),
    },
    attendance: { coverage: !validAttendance.length ? 'unavailable' as const : cohortAvailable && matchedAttendance === expectedAttendance.size && attendance.rows.length === validAttendance.length && !attendance.duplicates ? 'available' as const : 'partial' as const,
      ...attendanceSummary(validAttendance), excludedMissingOrInvalidRecords: attendance.rows.length - validAttendance.length, duplicateAttendanceRows: attendance.duplicates,
      expectedStudentTermRecords: cohortAvailable ? expectedAttendance.size : null,
      missingStudentTermRecords: cohortAvailable ? expectedAttendance.size - matchedAttendance : null,
      dataCompletenessPercentage: cohortAvailable ? ratio(matchedAttendance, expectedAttendance.size) : null,
      weighting: 'Present student-days divided by recorded possible student-days; missing records do not contribute zeros',
      byPeriod: Array.from(new Set(attendance.rows.map(row => key(row)))).sort().map(period => ({ period, ...attendanceSummary(validAttendance.filter(row => key(row) === period)) })),
      bySchool: schools.map(school => ({ schoolId: school.id, schoolName: school.name, ...attendanceSummary(validAttendance.filter(row => row.schoolId === school.id)),
        classes: data.classes.filter(cls => cls.schoolId === school.id && (!filters.classId || cls.id === filters.classId)).map(cls => ({ classId: cls.id, className: cls.name, ...attendanceSummary(validAttendance.filter(row => row.classId === cls.id)) })) })),
    },
  };
}

export function buildAnalyticsReport(data: AnalyticsData, filters: AnalyticsFilters, resolveTuition: TuitionResolver) {
  const schools = scopedSchools(data, filters);
  const allocations = paymentAllocations(data);
  const performance = buildPerformance(data, schools, filters);
  return {
    meta: { generatedAt: new Date().toISOString(), filters, selectedSchools: schools, timezone: 'UTC',
      periodBasis: filters.session ? filters.term ? 'selected_term' : 'selected_session' : 'each_school_current_period',
      dateFiltersApplyTo: ['admission dates', 'withdrawal dates', 'payment receipt dates'],
      historicalUnknownsAreNotZero: true, readOnly: true },
    population: buildPopulation(data, schools, filters), admissions: buildAdmissions(data, schools, filters, allocations.allocations),
    withdrawals: buildWithdrawals(data, schools, filters), finance: buildFinance(data, schools, filters, allocations, resolveTuition), ...performance,
  };
}
export type GeneralSchoolReport = ReturnType<typeof buildAnalyticsReport>;

function comparisonMetrics(report: GeneralSchoolReport) {
  return { activePopulation: report.population.combined.activeEnrolled,
    recordedNewAdmissions: report.admissions.coverage === 'available' ? report.admissions.originalNewAdmissions : null,
    recordedWithdrawals: report.withdrawals.coverage === 'available' ? report.withdrawals.uniqueStudentsWithdrawn : null,
    confirmedRevenue: report.finance.combined.confirmedRevenue, expectedTuition: report.finance.combined.expectedTuition,
    outstandingTuition: report.finance.combined.outstandingTuition, collectionRate: report.finance.combined.collectionRate,
    averageScore: report.academics.averageScore, passRate: report.academics.passRate, attendancePercentage: report.attendance.percentage };
}
export class GeneralSchoolAnalytics {
  constructor(private database: ReportingDatabase, private resolveTuition: TuitionResolver) {}
  async report(input: unknown): Promise<GeneralSchoolReport> {
    const filters = analyticsFiltersSchema.parse(input);
    return this.database.transaction(async tx => buildAnalyticsReport(await loadAnalyticsData(tx, filters), filters, this.resolveTuition), { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }
  async availablePeriods(input: unknown) {
    const filters = analyticsFiltersSchema.parse(input);
    return this.database.transaction(async tx => {
      const data = await loadAvailablePeriods(tx, filters);
      const selected = data.schools;
      const rows = new Map<string, { schoolId: string; schoolName: string; session: string; term: string; populationSnapshot: boolean; baselineObservation: boolean; lifecycleEvents: boolean; confirmedPayments: boolean; assessments: boolean; attendance: boolean }>();
      const add = (schoolId: string, period: { session: string | null; term: string | null }, source: 'populationSnapshot' | 'baselineObservation' | 'lifecycleEvents' | 'confirmedPayments' | 'assessments' | 'attendance' | null) => {
        const school = selected.find(row => row.id === schoolId);
        if (!school || !period.session || !analyticsSessionSchema.safeParse(period.session).success || !ANALYTICS_TERMS.includes(period.term as typeof ANALYTICS_TERMS[number])) return;
        if (filters.session && period.session !== filters.session || filters.term && period.term !== filters.term) return;
        const id = `${schoolId}:${period.session}:${period.term}`;
        const row = rows.get(id) || { schoolId, schoolName: school.name, session: period.session, term: period.term!, populationSnapshot: false, baselineObservation: false, lifecycleEvents: false, confirmedPayments: false, assessments: false, attendance: false };
        if (source) row[source] = true;
        rows.set(id, row);
      };
      const sourceNames = { current: null, baseline: 'baselineObservation', term_end: 'populationSnapshot', events: 'lifecycleEvents', payments: 'confirmedPayments', scores: 'assessments', attendance: 'attendance' } as const;
      data.periods.forEach(row => add(row.schoolId, row, sourceNames[row.source as keyof typeof sourceNames]));
      return { schools: selected, classes: data.classes, periods: Array.from(rows.values()).sort((a, b) => a.session.localeCompare(b.session) || ANALYTICS_TERMS.indexOf(a.term as typeof ANALYTICS_TERMS[number]) - ANALYTICS_TERMS.indexOf(b.term as typeof ANALYTICS_TERMS[number]) || a.schoolId.localeCompare(b.schoolId)) };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }
  async compare(input: unknown) {
    const comparison: AnalyticsComparisonFilters = analyticsComparisonSchema.parse(input);
    const common = { schoolId: comparison.schoolId, schoolIds: comparison.schoolIds, classId: comparison.classId, passThreshold: comparison.passThreshold };
    const originalFilters = analyticsFiltersSchema.parse({ ...common, session: comparison.originalSession, term: comparison.originalTerm });
    const comparisonFilters = analyticsFiltersSchema.parse({ ...common, session: comparison.comparisonSession, term: comparison.comparisonTerm });
    return this.database.transaction(async tx => {
      const data = await loadAnalyticsData(tx, originalFilters, comparison.comparisonSession);
      const original = buildAnalyticsReport(data, originalFilters, this.resolveTuition), compared = buildAnalyticsReport(data, comparisonFilters, this.resolveTuition);
      const first = comparisonMetrics(original), second = comparisonMetrics(compared);
      const changes = (one: typeof first, two: typeof second) => Object.fromEntries(Object.keys(one).map(name => [name, metricChange(one[name as keyof typeof one], two[name as keyof typeof two])]));
      return { mode: comparison.mode, original: original.meta, comparison: compared.meta,
        metrics: changes(first, second),
        bySchool: original.meta.selectedSchools.map(school => {
          const scoped = { ...data, schools: [school] };
          return { schoolId: school.id, schoolName: school.name, metrics: changes(comparisonMetrics(buildAnalyticsReport(scoped, originalFilters, this.resolveTuition)), comparisonMetrics(buildAnalyticsReport(scoped, comparisonFilters, this.resolveTuition))) };
        }),
        coverage: { original: { population: original.population.coverage, admissions: original.admissions.coverage, finance: original.finance.coverage, academics: original.academics.coverage, attendance: original.attendance.coverage },
          comparison: { population: compared.population.coverage, admissions: compared.admissions.coverage, finance: compared.finance.coverage, academics: compared.academics.coverage, attendance: compared.attendance.coverage } },
        recordedEventComparisonsAreProvisional: true,
      };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  }
}
