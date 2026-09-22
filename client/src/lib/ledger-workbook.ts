import * as XLSX from 'xlsx';
import type { LedgerPayment } from '@shared/ledger-payments';

interface ExportStudent {
  studentDbId: string; studentId: string; firstName: string; lastName: string;
  className: string; studentType: string; totalPaid: number; tuitionAssigned: number;
  totalAssigned: number; discount: number; balance: number;
}
export function buildLedgerWorkbook(entries: ExportStudent[], records: LedgerPayment[], filters: Record<string, string>, dateFiltered: boolean) {
  const names = new Map(entries.map(entry => [entry.studentDbId, entry]));
  const selectedRecords = records.filter(record => names.has(record.studentDbId));
  const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat('en-GB', {timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(value)) : 'Not available';
  const paymentDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-GB', {timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric'}).format(new Date(value)) : 'Not available';
  const paidColumn = dateFiltered ? 'Confirmed in range (NGN)' : 'Total confirmed (NGN)';
  const summaries = entries.map(entry => ({
    'Student ID': entry.studentId, 'Student name': `${entry.lastName} ${entry.firstName}`.trim(), 'Class': entry.className,
    'Student type': entry.studentType === 'new' ? 'New' : 'Returning',
    ...(!dateFiltered ? {'Assigned fees (NGN)': entry.totalAssigned, 'Tuition after discount (NGN)': entry.tuitionAssigned, 'Discount (NGN)': entry.discount} : {}),
    [paidColumn]: entry.totalPaid,
    ...(!dateFiltered ? {'Outstanding fees (NGN)': entry.balance} : {}),
  }));
  const details = selectedRecords.map(record => {
    const student = names.get(record.studentDbId)!;
    return {'Student ID': student.studentId, 'Student name': `${student.lastName} ${student.firstName}`.trim(), 'Class': student.className,
      'Student amount (NGN)': Number(record.amount), 'Purpose': record.purpose || '', 'Payment date': paymentDate(record.paymentDate),
      'Recorded at (WAT)': formatTime(record.createdAt), 'Confirmed at (WAT)': formatTime(record.confirmedAt),
      'Method': record.paymentMethod || '', 'Reference': record.reference || '', 'Status': record.status,
      'Allocation': record.isSplit ? 'Student share of split payment' : 'Direct payment',
      'Term': record.term, 'Session': record.session, 'Payment record ID': record.paymentRecordId, 'Allocation ID': record.id};
  });
  const workbook = XLSX.utils.book_new();
  const addSheet = (name: string, rows: Record<string, string | number>[], headers?: string[]) => {
    const sheet = XLSX.utils.json_to_sheet(rows, headers ? {header: headers} : undefined);
    const keys = headers || Object.keys(rows[0] || {});
    sheet['!cols'] = keys.map(key => ({wch: /name|purpose|reference|allocation/i.test(key) ? 32 : /date| at |ID/.test(key) ? 25 : 22}));
    if (rows.length && sheet['!ref']) sheet['!autofilter'] = {ref: sheet['!ref']};
    for (const key of Object.keys(sheet)) if (sheet[key]?.t === 'n') sheet[key].z = '#,##0.00';
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };
  addSheet('Ledger summary', summaries);
  addSheet('Payment records', details, ['Student ID','Student name','Class','Student amount (NGN)','Purpose','Payment date','Recorded at (WAT)','Confirmed at (WAT)','Method','Reference','Status','Allocation','Term','Session','Payment record ID','Allocation ID']);
  addSheet('Filters and totals', [
    ...Object.entries(filters).map(([Filter, Value]) => ({Filter, Value})),
    {Filter: 'Included records', Value: 'Confirmed only; pending and reversed payments excluded'},
    {Filter: 'Split payments', Value: 'Each row contains only the amount allocated to that student'},
    {Filter: 'First-payment definition', Value: 'Earliest confirmed payment in the selected term and session, across all purposes; missing historical confirmation times cannot qualify'},
    {Filter: 'Summary total (NGN)', Value: entries.reduce((sum, entry) => sum + Math.round(entry.totalPaid * 100), 0) / 100},
    {Filter: 'Records total (NGN)', Value: selectedRecords.reduce((sum, record) => sum + Math.round(Number(record.amount) * 100), 0) / 100},
  ]);
  return workbook;
}
