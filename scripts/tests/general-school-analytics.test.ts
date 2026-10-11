import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { AnalyticsError } from '../../server/analytics-repository';
import { analyticsFiltersSchema, analyticsComparisonSchema, metricChange, previousPeriod } from '../../shared/general-school-analytics';
import { setHistoryContext, historyContextSchema } from '../../server/student-history';

import { ids, actor, createAnalyticsFixture as fixture } from './analytics-database-fixture';

test('whole-session population and admission growth use the previous complete session; date slices have no full-period admission growth', async () => {
  const f = await fixture(); try {
    // Place the observation baseline before the two sessions being compared.
    await f.pg.exec('ALTER TABLE student_population_snapshots DISABLE TRIGGER population_snapshot_immutable');
    await f.pg.query("UPDATE student_population_snapshots SET session='2023/2024',term='Third Term',captured_at='2024-07-01' WHERE school_id=$1 AND snapshot_kind='baseline'", [ids[0]]);
    await f.pg.exec('ALTER TABLE student_population_snapshots ENABLE TRIGGER population_snapshot_immutable');
    const census = (await f.pg.query('SELECT students FROM student_population_snapshots WHERE school_id=$1 AND snapshot_kind=\'baseline\'', [ids[0]])).rows[0] as any;
    for (const [term, session, population] of [['Third Term', '2025/2026', census.students], ['Second Term', '2026/2027', []], ['Third Term', '2026/2027', [...census.students, { ...census.students[0], studentId: 'second-historical-student' }]]] as const) {
      await f.pg.query('INSERT INTO student_population_snapshots(school_id,school_name,term,session,snapshot_kind,students) VALUES ($1,$2,$3,$4,$5,$6)', [ids[0], 'Ikpoto', term, session, 'term_end', JSON.stringify(population)]);
    }
    await f.pg.query("UPDATE schools SET current_session='2025/2026',current_term='Third Term' WHERE id=$1", [ids[0]]);
    await f.create(0, '2025-09-10');
    await f.pg.query("UPDATE schools SET current_session='2026/2027',current_term='First Term' WHERE id=$1", [ids[0]]);
    await f.create(0, '2026-09-10'); await f.create(0, '2026-09-11');
    const annual = await f.reporting.report({ schoolId: ids[0], session: '2026/2027' });
    assert.equal(annual.population.growth.original, 1);
    assert.equal(annual.population.growth.comparison, 2);
    assert.equal(annual.population.growth.percentageChange, 100);
    assert.equal(annual.admissions.previousRecordedAdmissions, 1);
    assert.equal(annual.admissions.growth.percentageChange, 100);
    const dated = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'First Term', dateFrom: '2026-09-10', dateTo: '2026-09-10' });
    assert.equal(dated.admissions.originalNewAdmissions, 1);
    assert.equal(dated.admissions.growth.percentageChange, null);
  } finally { await f.pg.close(); }
});

test('reports cannot certify historical event coverage when recording triggers are disabled', async () => {
  const f = await fixture(); try {
    await f.pg.exec('ALTER TABLE students DISABLE TRIGGER record_student_history');
    await assert.rejects(f.reporting.report({}), (error: any) => error instanceof AnalyticsError && error.status === 503);
    await assert.rejects(f.reporting.availablePeriods({}), (error: any) => error instanceof AnalyticsError && error.status === 503);
    await f.pg.exec('ALTER TABLE students ENABLE TRIGGER record_student_history');
    assert.equal((await f.reporting.report({})).population.combined.activeEnrolled, 4);
  } finally { await f.pg.close(); }
});

test('invalid legacy school sessions do not become selectable reporting periods or verified current populations', async () => {
  const f = await fixture(); try {
    await f.pg.query("UPDATE schools SET current_session='2026/2028' WHERE id=$1", [ids[0]]);
    const metadata = await f.reporting.availablePeriods({ schoolId: ids[0] });
    assert.equal(metadata.periods.some(period => period.session === '2026/2028'), false);
    assert.equal(metadata.periods.some(period => period.session === '2026/2027'), true);
    const report = await f.reporting.report({ schoolId: ids[0] });
    assert.equal(report.population.combined.activeEnrolled, null);
    assert.equal(report.population.coverage, 'unavailable');
    assert.equal(report.finance.combined.confirmedRevenue, null);
  } finally { await f.pg.close(); }
});

test('report filters reject fake schools, duplicate branches, malformed dates and incomplete comparison periods', () => {
  assert.equal(historyContextSchema.safeParse({ admissionTerm: 'First Term', admissionSession: '2026/2028' }).success, false);
  assert.equal(historyContextSchema.safeParse({ admissionTerm: 'First Term', admissionSession: '2026/2027' }).success, true);
  for (const input of [{ schoolId: 'general-school-view' }, { schoolId: ids[0], schoolIds: ids }, { schoolIds: [ids[0], ids[0]] }, { term: 'First Term' }, { session: '2025/2028' }, { dateFrom: '2026-02-30' }, { dateFrom: '2026-10-11', dateTo: '2026-10-10' }, { passThreshold: '101' }, { unexpected: 'anything' }]) assert.equal(analyticsFiltersSchema.safeParse(input).success, false);
  assert.equal(analyticsFiltersSchema.parse({ schoolIds: ids.join(',') }).schoolIds?.length, 4);
  assert.equal(analyticsComparisonSchema.safeParse({ mode: 'term', originalSession: '2025/2026', comparisonSession: '2026/2027' }).success, false);
  assert.deepEqual(previousPeriod({ session: '2026/2027', term: 'First Term' }), { session: '2025/2026', term: 'Third Term' });
  assert.deepEqual(metricChange(0, 3), { original: 0, comparison: 3, difference: 3, percentageChange: null });
  assert.equal(metricChange(null, 3).difference, null);
});

test('current all-school population uses every school own period and historical unknowns never become zero', async () => {
  const f = await fixture(); try {
    const report = await f.reporting.report({});
    assert.equal(report.population.combined.activeEnrolled, 4);
    assert.equal(report.population.combined.nurseryPrimary, 4);
    assert.equal(report.population.combined.newEnrolments, 0);
    assert.equal(report.population.combined.admissionClassificationUnknown, 4);
    assert.equal(report.population.bySchool[3].period?.session, '2025/2026');
    const historical = await f.reporting.report({ session: '2024/2025', term: 'First Term' });
    assert.equal(historical.population.combined.activeEnrolled, null);
    assert.equal(historical.finance.combined.expectedTuition, null);
    assert.equal(historical.academics.averageScore, null);
    assert.equal(historical.attendance.percentage, null);
    assert.equal(historical.admissions.growth.percentageChange, null);
    await assert.rejects(f.reporting.report({ schoolId: '00000000-0000-4000-8000-000000000088' }), /do not exist/);
    await assert.rejects(f.reporting.report({ schoolId: ids[0], classId: 'p1' }), /does not belong/);
  } finally { await f.pg.close(); }
});

test('original new admissions and full names survive payment classification; transfers are not fresh admissions', async () => {
  const f = await fixture(); try {
    const student = await f.create(0, '2026-09-01');
    await f.payment('20', student.id);
    await f.pg.query("UPDATE students SET student_type='returning',student_type_flipped_term='First Term',student_type_flipped_session='2026/2027' WHERE id=$1", [student.id]);
    let report = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'First Term', dateFrom: '2026-09-01', dateTo: '2026-09-01' });
    assert.equal(report.admissions.originalNewAdmissions, 1);
    assert.equal(report.admissions.newWithConfirmedPayments, 1);
    assert.equal(report.admissions.register[0].studentName, 'Admission New Full');
    assert.equal(report.admissions.buckets.months[0].period, '2026-09');
    assert.equal(report.admissions.buckets.weeks[0].period, '2026-08-31');
    await f.db.transaction(async tx => { await setHistoryContext(tx, { actorId: actor, actorRole: 'admin' }); await tx.execute(sql`UPDATE students SET class_id='p1' WHERE id=${student.id}`); });
    report = await f.reporting.report({ session: '2026/2027', term: 'First Term' });
    assert.equal(report.admissions.originalNewAdmissions, 1);
    assert.equal(report.population.combined.newEnrolments, 1);
    assert.equal(report.admissions.readmissionEvents, 0);
    const other = await f.reporting.report({ schoolId: ids[1], session: '2026/2027', term: 'First Term' });
    assert.equal(other.admissions.originalNewAdmissions, 0);
  } finally { await f.pg.close(); }
});

test('official withdrawal remains in its school period after readmission and repeated events count unique students separately', async () => {
  const f = await fixture(); try {
    const student = f.students[0];
    async function status(value: string) { await f.db.transaction(async tx => { await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', reason: 'Relocated' }); await tx.execute(sql`UPDATE students SET status=${value} WHERE id=${student.id}`); await tx.execute(sql`UPDATE users SET is_active=${value === 'active'} WHERE id=${student.userId}`); }); }
    await status('withdrawn'); await status('withdrawn');
    await f.pg.query("UPDATE schools SET current_term='Third Term' WHERE id=$1", [ids[0]]);
    await status('active');
    let report = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'First Term' });
    assert.equal(report.withdrawals.uniqueStudentsWithdrawn, 1);
    assert.equal(report.withdrawals.withdrawalEvents, 1);
    assert.equal(report.withdrawals.stillWithdrawnFromSelectedPeriod, 0);
    assert.equal(report.withdrawals.register[0].term, 'First Term');
    assert.equal(report.withdrawals.register[0].reason, 'Relocated');
    await status('withdrawn');
    report = await f.reporting.report({ schoolId: ids[0], session: '2026/2027' });
    assert.equal(report.withdrawals.uniqueStudentsWithdrawn, 1);
    assert.equal(report.withdrawals.withdrawalEvents, 2);
    assert.equal(report.withdrawals.readmissionEvents, 1);
    assert.equal(report.withdrawals.readmissionRegister[0].className, 'Primary 1');
    assert.equal(report.withdrawals.readmissionRegister[0].studentNumber, 'SOWA/1');
    assert.equal(report.withdrawals.withdrawalRate, null);
    await f.pg.query('UPDATE users SET is_active=false WHERE id=$1', [f.students[1].userId]);
    const untouched = await f.reporting.report({ schoolId: ids[1] });
    assert.equal(untouched.withdrawals.withdrawalEvents, 0);
  } finally { await f.pg.close(); }
});

test('historical population/class counts survive promotion; a whole session uses its closing census rather than summed terms', async () => {
  const f = await fixture(); try {
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1", [ids[0]]);
    await f.pg.query("UPDATE students SET class_id='s0' WHERE id=$1", [f.students[0].id]);
    const first = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'First Term' });
    assert.equal(first.population.combined.activeEnrolled, 1);
    assert.equal(first.population.bySchool[0].classes[0].classId, 'p0');
    assert.equal(first.population.bySchool[0].source, 'term_end');
    await f.pg.query("UPDATE schools SET current_term='Third Term' WHERE id=$1", [ids[0]]);
    await f.pg.query("UPDATE schools SET current_term='First Term',current_session='2027/2028' WHERE id=$1", [ids[0]]);
    const whole = await f.reporting.report({ schoolId: ids[0], session: '2026/2027' });
    assert.equal(whole.population.combined.activeEnrolled, 1);
    assert.equal(whole.population.bySchool[0].period?.term, 'Third Term');
    assert.equal(whole.population.bySchool[0].sessionComplete, true);
    const current = await f.reporting.report({ schoolId: ids[0] });
    assert.equal(current.population.growth.percentageChange, 0);
  } finally { await f.pg.close(); }
});

test('finance counts one split receipt, preserves allocation purposes, excludes pending/reversed payments and uses weighted collection rates', async () => {
  const f = await fixture(); try {
    const extra = await f.create();
    const split = await f.payment('100', null);
    await f.db.insert(schema.feePaymentStudentSplits).values([{ paymentRecordId: split.id, studentId: f.students[0].id, amount: '60' }, { paymentRecordId: split.id, studentId: extra.id, amount: '40' }]);
    await f.payment('20', f.students[0].id, 'Books');
    await f.payment('900', f.students[0].id, 'Tuition', undefined, undefined, undefined, 'recorded');
    await f.payment('800', f.students[0].id, 'Tuition', undefined, undefined, undefined, 'reversed');
    const report = await f.reporting.report({});
    assert.equal(report.finance.combined.confirmedRevenue, 120);
    assert.equal(report.finance.combined.tuitionReceived, 100);
    assert.equal(report.finance.combined.expectedTuition, 500);
    assert.equal(report.finance.combined.outstandingTuition, 400);
    assert.equal(report.finance.combined.collectionRate, 20);
    assert.equal(report.finance.bySchool[0].confirmedPaymentRecords, 2);
    assert.equal(report.finance.bySchool[0].unallocatedConfirmedAmount, 0);
    assert.equal(report.finance.bySchool[0].collectionRate, 50);
  } finally { await f.pg.close(); }
});

test('receipt dates and assigned periods are distinct; date range does not change full-period balances', async () => {
  const f = await fixture(); try {
    await f.payment('25', f.students[0].id, 'Tuition', 'First Term', '2026/2027', '2026-08-31');
    await f.payment('10', f.students[0].id, 'Tuition', 'First Term', '2026/2027', '2026-09-01');
    await f.payment('5', f.students[0].id, 'Tuition', 'Second Term', '2026/2027', '2026-09-01');
    const report = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'First Term', dateFrom: '2026-09-01', dateTo: '2026-09-01' });
    assert.equal(report.finance.combined.confirmedRevenue, 10);
    assert.equal(report.finance.combined.tuitionReceived, 10);
    assert.equal(report.finance.combined.appliedTuition, 35);
    assert.equal(report.finance.combined.outstandingTuition, 65);
    assert.equal(report.finance.bySchool[0].receiptMonths[0].month, '2026-09');
  } finally { await f.pg.close(); }
});

test('class-scoped split payments retain other known class allocations without treating them as unknown', async () => {
  const f = await fixture(); try {
    const extra = await f.create();
    await f.pg.query("UPDATE students SET class_id='s0' WHERE id=$1", [extra.id]);
    const parent = await f.payment('100', null);
    await f.db.insert(schema.feePaymentStudentSplits).values([{ paymentRecordId: parent.id, studentId: f.students[0].id, amount: '60' }, { paymentRecordId: parent.id, studentId: extra.id, amount: '40' }]);
    const primary = await f.reporting.report({ schoolId: ids[0], classId: 'p0' });
    const secondary = await f.reporting.report({ schoolId: ids[0], classId: 's0' });
    assert.equal(primary.finance.combined.confirmedRevenue, 60);
    assert.equal(primary.finance.combined.expectedTuition, 100);
    assert.equal(secondary.finance.combined.confirmedRevenue, 40);
    assert.equal(secondary.finance.combined.expectedTuition, 200);
    assert.equal(primary.finance.bySchool[0].paymentClassUnknown, 0);
    assert.equal(secondary.population.combined.secondary, 1);
  } finally { await f.pg.close(); }
});

test('promotion before period advance keeps existing tuition and assessment class attribution; saved historical debt survives withdrawal', async () => {
  const f = await fixture(); try {
    await f.db.transaction(async tx => {
      await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', action: 'promotion' });
      await tx.insert(schema.promotionRecords).values({ schoolId: ids[0], studentId: f.students[0].id, session: '2026/2027', fromClassId: 'p0', toClassId: 's0', isBulk: true, promotedBy: actor });
      await tx.execute(sql`UPDATE students SET class_id='s0' WHERE id=${f.students[0].id}`);
    });
    const [subject] = await f.db.insert(schema.subjects).values({ name: 'English', code: 'ENG' }).returning();
    await f.db.insert(schema.assessments).values({ studentId: f.students[0].id, classId: 's0', subjectId: subject.id, term: 'First Term', session: '2026/2027', firstCA: 10, secondCA: 10, exam: 40 });
    const current = await f.reporting.report({ schoolId: ids[0], classId: 'p0' });
    assert.equal(current.finance.combined.expectedTuition, 100);
    assert.equal(current.academics.averageScore, 60);
    const fee = (await f.pg.query('SELECT id FROM fee_types WHERE school_id=$1', [ids[0]])).rows[0] as any;
    await f.db.insert(schema.studentFees).values({ studentId: f.students[0].id, feeTypeId: fee.id, term: 'First Term', session: '2026/2027', amount: '100' });
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1", [ids[0]]);
    await f.db.transaction(async tx => {
      await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', action: 'withdrawal' });
      await tx.execute(sql`UPDATE students SET status='withdrawn' WHERE id=${f.students[0].id}`);
      await tx.execute(sql`UPDATE users SET is_active=false WHERE id=${f.students[0].userId}`);
    });
    const historical = await f.reporting.report({ schoolId: ids[0], classId: 'p0', session: '2026/2027', term: 'First Term' });
    assert.equal(historical.population.combined.activeEnrolled, 1);
    assert.equal(historical.finance.combined.expectedTuition, 100);
    assert.equal(historical.finance.combined.outstandingTuition, 100);
    assert.equal(historical.finance.combined.studentsOwing, 1);
    assert.equal(historical.withdrawals.uniqueStudentsWithdrawn, 0);
  } finally { await f.pg.close(); }
});

test('missing tuition rates and invalid splits are unavailable, while an explicit zero charge is a verified zero', async () => {
  const f = await fixture(); try {
    await f.pg.exec("DELETE FROM tuition_class_amounts WHERE class_id='p0'");
    let report = await f.reporting.report({ schoolId: ids[0] });
    assert.equal(report.finance.combined.expectedTuition, null);
    assert.equal(report.finance.bySchool[0].tuitionUnverifiedStudents, 1);
    const fee = (await f.pg.query('SELECT id FROM fee_types WHERE school_id=$1', [ids[0]])).rows[0] as any;
    await f.db.insert(schema.studentFees).values({ studentId: f.students[0].id, feeTypeId: fee.id, term: 'First Term', session: '2026/2027', amount: '0' });
    report = await f.reporting.report({ schoolId: ids[0] });
    assert.equal(report.finance.combined.expectedTuition, 0);
    assert.equal(report.finance.combined.collectionRate, null);
    const split = await f.payment('10', null);
    await f.db.insert(schema.feePaymentStudentSplits).values({ paymentRecordId: split.id, studentId: f.students[0].id, amount: '20' });
    report = await f.reporting.report({ schoolId: ids[0] });
    assert.equal(report.finance.combined.confirmedRevenue, 10);
    assert.equal(report.finance.combined.outstandingTuition, null);
    assert.equal(report.finance.bySchool[0].invalidPaymentAllocations, 1);
  } finally { await f.pg.close(); }
});

test('academics are student weighted, incomplete zeros are excluded, and attendance uses combined student-day denominators', async () => {
  const f = await fixture(); try {
    const [a, b, c] = await f.db.insert(schema.subjects).values([{ name: 'English', code: 'ENG' }, { name: 'Maths', code: 'MAT' }, { name: 'Science', code: 'SCI' }]).returning();
    const score = (index: number, subjectId: string, firstCA: number, secondCA: number, exam: number) => ({ studentId: f.students[index].id, classId: `p${index}`, term: 'First Term', session: '2026/2027', subjectId, firstCA, secondCA, exam });
    await f.db.insert(schema.assessments).values([score(0, a.id, 20, 20, 60), score(0, b.id, 20, 20, 60), score(1, a.id, 5, 5, 10), score(2, c.id, 0, 0, 0)]);
    await f.db.insert(schema.attendance).values([{ studentId: f.students[0].id, classId: 'p0', term: 'First Term', session: '2026/2027', totalDays: 10, presentDays: 10, absentDays: 0 }, { studentId: f.students[1].id, classId: 'p1', term: 'First Term', session: '2026/2027', totalDays: 90, presentDays: 0, absentDays: 90 }, { studentId: f.students[2].id, classId: 'p2', term: 'First Term', session: '2026/2027', totalDays: 0, presentDays: 0, absentDays: 0 }]);
    const report = await f.reporting.report({ session: '2026/2027', term: 'First Term', passThreshold: '40' });
    assert.equal(report.academics.averageScore, 60);
    assert.equal(report.academics.passRate, 50);
    assert.equal(report.academics.excludedIncompleteOrAmbiguousResults, 1);
    assert.equal(report.academics.approvedSubjectSelectionVerified, false);
    assert.equal(report.attendance.percentage, 10);
    assert.equal(report.attendance.bySchool[1].percentage, 0);
    assert.equal(report.attendance.excludedMissingOrInvalidRecords, 1);
    assert.equal(report.attendance.expectedStudentTermRecords, null); // school 4 has no census for this period
    assert.equal(report.attendance.coverage, 'partial');
  } finally { await f.pg.close(); }
});

test('comparison preserves unavailable baselines and handles matching terms and complete sessions', async () => {
  const f = await fixture(); try {
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1", [ids[0]]);
    const compared = await f.reporting.compare({ mode: 'term', schoolId: ids[0], originalSession: '2026/2027', originalTerm: 'First Term', comparisonSession: '2026/2027', comparisonTerm: 'Second Term' });
    assert.equal(compared.metrics.activePopulation.difference, 0);
    assert.equal(compared.metrics.activePopulation.percentageChange, 0);
    assert.equal(compared.metrics.recordedNewAdmissions.original, null);
    const unknown = await f.reporting.compare({ mode: 'session', schoolId: ids[0], originalSession: '2024/2025', comparisonSession: '2026/2027' });
    assert.equal(unknown.metrics.activePopulation.percentageChange, null);
    const periods = await f.reporting.availablePeriods({ schoolId: ids[0] });
    assert.ok(periods.classes.some(cls => cls.id === 'p0' && cls.schoolId === ids[0]));
    assert.ok(periods.classes.every(cls => cls.schoolId === ids[0]));
    assert.equal(periods.periods.find(row => row.term === 'First Term')?.populationSnapshot, true);
    assert.equal(periods.periods.some(row => row.session === '2024/2025'), false);
    await f.payment('12', f.students[0].id, 'Tuition', 'First Term', '2025/2026');
    await f.payment('30', f.students[0].id, 'Tuition', 'First Term', '2026/2027');
    const money = await f.reporting.compare({ mode: 'term', schoolId: ids[0], originalSession: '2025/2026', originalTerm: 'First Term', comparisonSession: '2026/2027', comparisonTerm: 'First Term' });
    assert.equal(money.metrics.confirmedRevenue.original, 12);
    assert.equal(money.metrics.confirmedRevenue.comparison, 30);
    assert.equal(money.bySchool[0].metrics.confirmedRevenue.percentageChange, 150);
    const historicalReceipts = await f.reporting.report({ schoolId: ids[0], session: '2025/2026', term: 'First Term' });
    assert.equal(historicalReceipts.finance.combined.confirmedRevenue, 12);
    assert.equal(historicalReceipts.finance.combined.tuitionReceived, null);
    assert.equal(historicalReceipts.finance.bySchool[0].historicalReceiptClassificationUnknown, true);
  } finally { await f.pg.close(); }
});

test('overlapping frozen school rosters never duplicate the combined population; archived class filters survive removal of the current class record', async () => {
  const f = await fixture(); try {
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1", [ids[0]]);
    await f.db.transaction(async tx => { await setHistoryContext(tx, { actorId: actor, actorRole: 'admin' }); await tx.execute(sql`UPDATE students SET class_id='p1' WHERE id=${f.students[0].id}`); });
    const combined = await f.reporting.report({ schoolIds: [ids[0], ids[1]], session: '2026/2027', term: 'First Term' });
    assert.equal(combined.population.combined.activeEnrolled, 2);
    assert.equal(combined.population.duplicateSchoolMemberships, 1);
    assert.equal(combined.population.coverage, 'partial');
    await f.pg.exec("DELETE FROM classes WHERE id='p0'");
    const archived = await f.reporting.report({ schoolId: ids[0], classId: 'p0', session: '2026/2027', term: 'First Term' });
    assert.equal(archived.population.combined.activeEnrolled, 1);
    assert.equal(archived.population.bySchool[0].classes[0].className, 'Primary 1');
    const archivedPeriods = await f.reporting.availablePeriods({ schoolId: ids[0] });
    assert.ok(archivedPeriods.classes.some(cls => cls.id === 'p0' && cls.name === 'Primary 1'));
    assert.ok(archivedPeriods.classes.every(cls => cls.schoolId === ids[0]));
  } finally { await f.pg.close(); }
});

test('history after the migration baseline supports verified withdrawal rates, while the baseline term remains provisional', async () => {
  const f = await fixture(); try {
    await f.pg.query("UPDATE schools SET current_term='Second Term' WHERE id=$1", [ids[0]]);
    await f.db.transaction(async tx => { await setHistoryContext(tx, { actorId: actor, actorRole: 'admin' }); await tx.execute(sql`UPDATE students SET status='withdrawn' WHERE id=${f.students[0].id}`); await tx.execute(sql`UPDATE users SET is_active=false WHERE id=${f.students[0].userId}`); });
    const report = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'Second Term' });
    assert.equal(report.withdrawals.coverage, 'available');
    assert.equal(report.withdrawals.withdrawalRate, 100);
    assert.equal(report.withdrawals.bySchool[0].withdrawalRate, 100);
    assert.equal(report.withdrawals.retentionRate, 0);
    assert.equal(report.admissions.growth.percentageChange, null);
    const future = await f.reporting.report({ schoolId: ids[0], session: '2026/2027', term: 'Third Term' });
    assert.equal(future.admissions.coverage, 'partial');
    assert.equal(future.withdrawals.coverage, 'partial');
  } finally { await f.pg.close(); }
});

test('an unapplied history migration gives an actionable unavailable error without creating tables', async () => {
  const f = await fixture(false); try {
    await assert.rejects(f.reporting.report({}), error => error instanceof AnalyticsError && error.status === 503);
    assert.equal((await f.pg.query("SELECT to_regclass('student_status_events') AS table")).rows[0].table, null);
  } finally { await f.pg.close(); }
});
