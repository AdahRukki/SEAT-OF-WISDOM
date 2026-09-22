export interface LedgerPayment {
  id: string;
  paymentRecordId: string;
  studentDbId: string;
  amount: string;
  purpose: string | null;
  paymentMethod: string | null;
  reference: string | null;
  status: string;
  paymentDate: string | null;
  createdAt: string | null;
  confirmedAt: string | null;
  term: string;
  session: string;
  isSplit: boolean;
}

export function inConfirmationRange(value: string | null, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && (!from || time >= Date.parse(from)) && (!to || time < Date.parse(to));
}

// Inspect the whole term BEFORE applying dates. Unknown historic confirmation
// times cannot safely establish which payment came first.
export function firstPaymentStudents(records: LedgerPayment[], from?: string, to?: string): Set<string> {
  const first = new Map<string, string>();
  const unknown = new Set<string>();
  for (const record of records) {
    if (record.status !== 'confirmed') continue;
    if (!record.confirmedAt || !Number.isFinite(Date.parse(record.confirmedAt))) {
      unknown.add(record.studentDbId);
      continue;
    }
    const previous = first.get(record.studentDbId);
    if (!previous || Date.parse(record.confirmedAt) < Date.parse(previous)) first.set(record.studentDbId, record.confirmedAt);
  }
  return new Set(Array.from(first.entries()).filter(([id, date]) => !unknown.has(id) && inConfirmationRange(date, from, to)).map(([id]) => id));
}
