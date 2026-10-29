// Pure, shared tuition decisions. Callers supply recorded facts; this module
// never writes history, infers admission from registration timestamps or reads
// mutable current settings for a past academic period.
export type TuitionPeriod = { term: string; session: string };
export function tuitionPeriodOrder(period: { term?: string | null; session?: string | null }) {
  const term = ['First Term', 'Second Term', 'Third Term'].indexOf(period.term || '');
  if (term < 0 || !/^\d{4}\/\d{4}$/.test(period.session || '')) return null;
  return Number(period.session!.slice(0, 4)) * 3 + term;
}
export type FinanceHistoryEvent = {
  studentId: string; schoolId: string | null; classId?: string | null; className?: string | null;
  eventType: string; term?: string | null; session?: string | null; periodVerified?: boolean;
  classVerified?: boolean; admissionCategory?: string | null; sequence?: number | string;
  previousData?: Record<string, any> | null; newData?: Record<string, any> | null;
};
export type FinanceSnapshot = TuitionPeriod & {
  snapshotKind: string; students: Array<{ studentId: string; classId: string | null; className: string | null;
    historicalClassVerified: boolean; status?: string | null; studentType?: string | null; discount?: number | string | null }>;
};
export type TuitionRate = { classId: string; amount: string | number; term?: string | null; session?: string | null;
  studentType?: string | null; feeTypeId?: string; active?: boolean };
export type FinanceStudent = {
  studentDbId: string; classId: string | null; className?: string | null; schoolId: string | null;
  studentType: string | null; discount: string | number | null; status?: string | null;
  flippedTerm?: string | null; flippedSession?: string | null; paymentCount: number;
  savedTuition: string | number | null;
  legacyClasses?: Array<{ classId: string; className?: string; kind: string }>;
};
export type StudentTuitionFacts = {
  included: boolean; membershipKnown: boolean; classId: string; className: string;
  studentType: string; studentTypeKnown: boolean; discount: number; discountKnown: boolean;
  tuitionKnown: boolean; tuitionAssigned: number; tuitionSource: string;
  tuitionReason: string | null; historicalDiscountNote: string | null;
};

export function resolveHistoricalTuition(input: {
  student: FinanceStudent; schoolId: string; period?: TuitionPeriod; currentPeriod?: TuitionPeriod;
  rates: TuitionRate[]; events?: FinanceHistoryEvent[]; snapshots?: FinanceSnapshot[]; classNames?: Record<string, string>;
}): StudentTuitionFacts {
  const { student: s, schoolId, period, currentPeriod, rates } = input;
  const target = period ? tuitionPeriodOrder(period) : null;
  const current = !!period && !!currentPeriod && period.term === currentPeriod.term && period.session === currentPeriod.session;
  const events = (input.events || []).filter(e => e.studentId === s.studentDbId && e.schoolId === schoolId && e.periodVerified && tuitionPeriodOrder(e) !== null)
    .sort((a, b) => tuitionPeriodOrder(a)! - tuitionPeriodOrder(b)! || Number(a.sequence || 0) - Number(b.sequence || 0));
  const snapshots = (input.snapshots || []).flatMap(snapshot => snapshot.students.filter(row => row.studentId === s.studentDbId).map(row => ({ ...snapshot, row })))
    .filter(snapshot => tuitionPeriodOrder(snapshot) !== null);
  const exact = events.filter(e => tuitionPeriodOrder(e) === target);
  const exactSnapshots = snapshots.filter(snapshot => tuitionPeriodOrder(snapshot) === target)
    .sort((a, b) => Number(b.snapshotKind === 'term_end') - Number(a.snapshotKind === 'term_end'));
  const admission = events.find(e => e.eventType === 'admission' || e.eventType === 'transfer_in');
  const saved = !!period && s.savedTuition !== null && s.savedTuition !== undefined;
  const paid = s.paymentCount > 0;
  // A verified later admission cannot create an earlier debt. Contradictory
  // payment evidence stays visible, but its charge remains unresolved.
  const laterAdmission = target !== null && !!admission && tuitionPeriodOrder(admission)! > target;
  const prior = target === null ? [] : events.filter(e => tuitionPeriodOrder(e)! < target);
  const lastExit = [...prior].reverse().find(e => ['withdrawal', 'graduation', 'transfer_out', 'readmission', 'reactivation', 'admission', 'transfer_in'].includes(e.eventType));
  const exited = !!lastExit && ['withdrawal', 'graduation', 'transfer_out'].includes(lastExit.eventType);
  const positiveExact = exact.some(e => ['admission', 'readmission', 'reactivation', 'transfer_in', 'withdrawal', 'graduation', 'promotion', 'class_change'].includes(e.eventType));
  const snapshotMember = exactSnapshots.some(snapshot => snapshot.row.status !== 'withdrawn' && snapshot.row.status !== 'graduated');
  const currentMember = current && s.schoolId === schoolId && (!s.status || s.status === 'active') && !exited;
  const priorSnapshot = snapshots.filter(snapshot => target !== null && tuitionPeriodOrder(snapshot)! < target)
    .sort((a, b) => tuitionPeriodOrder(b)! - tuitionPeriodOrder(a)!)[0];
  const undatedExit = ['withdrawn', 'graduated'].includes(s.status || '') && !events.some(event => ['withdrawal', 'graduation', 'transfer_out'].includes(event.eventType));
  const continuing = target !== null && !undatedExit && !exited && (!!admission && tuitionPeriodOrder(admission)! <= target
    || !!priorSnapshot && !['withdrawn', 'graduated'].includes(priorSnapshot.row.status || ''));
  const legacyClassProof = (s.legacyClasses || []).some(proof => proof.kind === 'assessment' || proof.kind === 'promotion' && period?.term === 'Third Term');
  const membershipKnown = !laterAdmission && (saved || paid || positiveExact || snapshotMember || currentMember || continuing || legacyClassProof);
  const included = laterAdmission ? paid : exited && !positiveExact && !saved && !paid && !snapshotMember ? false
    : s.schoolId === schoolId || membershipKnown || paid;

  let classId = '', className = 'Historical class not verified';
  const candidates = new Map<string, string>();
  const addClass = (id?: string | null, name?: string | null) => { if (id && id !== 'graduated' && !candidates.has(id)) candidates.set(id, name || input.classNames?.[id] || id); };
  // Non-promotion moves during a term do not identify which class rate should
  // be charged. A saved individual charge can still establish the net amount.
  const ambiguousMove = exact.some(e => (e.eventType === 'class_change' || e.eventType === 'transfer_in' && e.previousData?.schoolId === schoolId)
    && e.previousData?.classId && e.newData?.classId && e.previousData.classId !== e.newData.classId)
    || !current && (input.events || []).some(e => e.studentId===s.studentDbId && e.schoolId===schoolId && tuitionPeriodOrder(e)===target
      && e.eventType==='class_change' && !e.periodVerified && e.previousData?.classId && e.newData?.classId && e.previousData.classId!==e.newData.classId);
  for (const snapshot of exactSnapshots) if (snapshot.row.historicalClassVerified) addClass(snapshot.row.classId, snapshot.row.className);
  for (const event of exact) {
    if (!event.classVerified) continue;
    if (event.eventType === 'promotion') addClass(event.previousData?.classId || event.classId, event.previousData?.className);
    else if (event.eventType !== 'transfer_out') addClass(event.classId, event.className);
  }
  if (current && !ambiguousMove && !exactSnapshots.some(snapshot => snapshot.snapshotKind === 'term_end')
    && !exact.some(event => event.eventType === 'promotion' && event.classVerified)) {
    const promotions = (s.legacyClasses || []).filter(proof => proof.kind === 'promotion');
    candidates.clear();
    if (promotions.length) for (const proof of promotions) addClass(proof.classId, proof.className);
    else addClass(s.classId, s.className);
  }
  if (!candidates.size && !ambiguousMove) {
    const preceding = [...prior].reverse().find(e => e.classVerified && e.eventType !== 'transfer_out');
    const previousSnapshot = [...snapshots].filter(snapshot => target !== null && tuitionPeriodOrder(snapshot)! < target && snapshot.row.historicalClassVerified)
      .sort((a, b) => tuitionPeriodOrder(b)! - tuitionPeriodOrder(a)!)[0];
    if (preceding && (!previousSnapshot || tuitionPeriodOrder(preceding)! >= tuitionPeriodOrder(previousSnapshot)!)) {
      addClass(preceding.newData?.classId || preceding.classId, preceding.newData?.className || preceding.className);
    } else if (previousSnapshot) addClass(previousSnapshot.row.classId, previousSnapshot.row.className);
    else for (const proof of s.legacyClasses || []) addClass(proof.classId, proof.className);
  }
  // Current class is permitted only for the school's current period. A recorded
  // Third Term promotion keeps its pre-promotion class for that closing term.
  if (current && !candidates.size && !ambiguousMove) addClass(s.classId, s.className);
  if (!ambiguousMove && candidates.size === 1) [classId, className] = Array.from(candidates)[0];

  let studentType = '', studentTypeKnown = false;
  const flip = tuitionPeriodOrder({ term: s.flippedTerm, session: s.flippedSession });
  const recordedType = exactSnapshots.map(snapshot => snapshot.row.studentType).find(type => type === 'new' || type === 'returning')
    || [...events].reverse().find(e => target !== null && tuitionPeriodOrder(e)! <= target && ['new', 'returning'].includes(e.newData?.studentType))?.newData?.studentType;
  if (recordedType) { studentType = recordedType; studentTypeKnown = true; }
  else if (target !== null && flip !== null && target >= flip) { studentType = target === flip ? 'new' : 'returning'; studentTypeKnown = true; }
  else if (admission && target !== null && tuitionPeriodOrder(admission)! <= target && admission.admissionCategory === 'returning') { studentType = 'returning'; studentTypeKnown = true; }
  else if (admission?.admissionCategory === 'new' && target !== null && tuitionPeriodOrder(admission)! <= target
    && (tuitionPeriodOrder(admission) === target || flip !== null && target < flip)) { studentType = 'new'; studentTypeKnown = true; }
  else if (current && ['new', 'returning'].includes(s.studentType || '')) { studentType = s.studentType!; studentTypeKnown = true; }
  if (current && !exactSnapshots.some(snapshot => snapshot.snapshotKind === 'term_end') && ['new', 'returning'].includes(s.studentType || '')) {
    studentType = s.studentType === 'returning' && flip === target ? 'new' : s.studentType!;
    studentTypeKnown = true;
  }

  let discount = 0, discountKnown = false;
  const snapshotDiscount = exactSnapshots.find(snapshot => (!current || snapshot.snapshotKind === 'term_end') && snapshot.row.discount !== null && snapshot.row.discount !== undefined)?.row.discount;
  const discountEvent = !current ? [...events].reverse().find(e => target !== null && tuitionPeriodOrder(e)! <= target && e.newData?.discount !== null && e.newData?.discount !== undefined) : undefined;
  const recordedDiscount = snapshotDiscount ?? discountEvent?.newData?.discount;
  const invalidRecordedDiscount = !saved && recordedDiscount !== undefined && (!Number.isFinite(Number(recordedDiscount)) || Number(recordedDiscount) < 0);
  if (!saved && recordedDiscount !== undefined && Number.isFinite(Number(recordedDiscount)) && Number(recordedDiscount) >= 0) { discount = Number(recordedDiscount); discountKnown = true; }
  else if (!saved && current) { discount = Math.max(0, Number(s.discount) || 0); discountKnown = true; }
  const result: StudentTuitionFacts = { included, membershipKnown, classId, className, studentType: studentType || 'unknown', studentTypeKnown,
    discount, discountKnown, tuitionKnown: false, tuitionAssigned: 0, tuitionSource: 'Not verified', tuitionReason: null,
    historicalDiscountNote: !current && !saved && !discountKnown ? 'No historical discount is recorded; today’s discount has not been deducted from the saved class rate.' : null };
  const unknown = (reason: string) => ({ ...result, tuitionReason: reason });
  if (!period || target === null) return unknown('Select one academic term and session to verify tuition.');
  if (!membershipKnown || laterAdmission) return unknown('Membership in this school during the selected period is not verified.');
  if (saved) {
    const amount = Number(s.savedTuition);
    if (!Number.isFinite(amount) || amount < 0) return unknown('The saved individual charge is invalid.');
    return { ...result, tuitionKnown: true, tuitionAssigned: amount, tuitionSource: 'Saved term charge', discount: 0, discountKnown: false };
  }
  if (invalidRecordedDiscount) return unknown('The recorded historical discount is invalid and requires review.');
  if (!classId) return unknown(ambiguousMove || candidates.size > 1 ? 'Conflicting historical classes; an individual charge or reviewed history is required.' : 'Historical class is not verified.');
  const classRates = rates.filter(rate => rate.classId === classId);
  const scoped = classRates.filter(rate => rate.term === period.term && rate.session === period.session);
  const global = current ? classRates.filter(rate => !rate.term && !rate.session && rate.active !== false) : [];
  let selected: TuitionRate[] = [];
  for (const level of [scoped, global]) {
    if (!level.length) continue;
    if (!studentTypeKnown && level.some(rate => !!rate.studentType)) return unknown('Historical student type is not verified for the saved new/returning rates.');
    const typed = level.filter(rate => rate.studentType === studentType);
    selected = typed.length ? typed : level.filter(rate => !rate.studentType);
    if (selected.length) break;
  }
  if (!selected.length) return unknown(current ? 'No applicable class tuition rate is saved.' : 'No class tuition rate is saved for this exact term and session. General defaults cannot verify historical tuition.');
  const amounts = Array.from(new Set(selected.map(rate => Number(rate.amount))));
  if (amounts.length !== 1 || !Number.isFinite(amounts[0]) || amounts[0] < 0) return unknown('Conflicting or invalid tuition rates exist for this class and period.');
  return { ...result, tuitionKnown: true, tuitionAssigned: Math.max(0, Math.round((amounts[0] - discount) * 100) / 100),
    tuitionSource: selected[0].term ? 'Period-specific class rate' : 'Current fee settings' };
}
