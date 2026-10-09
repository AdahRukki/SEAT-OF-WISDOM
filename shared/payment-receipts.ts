export interface StudentReceipt {
  number: string;
  paymentId: string;
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  className: string;
  schoolName: string;
  schoolAddress: string;
  logoUrl: string | null;
  term: string;
  session: string;
  depositor: string;
  method: string;
  reference: string;
  paymentDate: string;
  confirmedAt: string | null;
  items: {purpose:string; amount:string}[];
  total: string;
}
export function receiptKey(paymentId:string, studentId:string) { return `${paymentId}:${studentId}`; }
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
function classRank(name:string) {
  const n=name.toLowerCase().replace(/[-_]/g,' ');
  if(/pre.?nursery|play/.test(n))return 0;
  if(/\bkg|kindergarten/.test(n))return 1;
  if(/nursery/.test(n))return 2;
  if(/basic|primary/.test(n))return 3;
  if(/jss|junior/.test(n))return 4;
  if(/sss?|senior/.test(n))return 5;
  return 6;
}
export function sortReceipts<T extends Pick<StudentReceipt,'className'|'lastName'|'firstName'|'studentId'|'paymentDate'|'paymentId'>>(receipts:T[]):T[] {
  return [...receipts].sort((a,b)=>classRank(a.className)-classRank(b.className)||collator.compare(a.className,b.className)||collator.compare(a.lastName,b.lastName)||collator.compare(a.firstName,b.firstName)||collator.compare(a.studentId,b.studentId)||a.paymentDate.localeCompare(b.paymentDate)||a.paymentId.localeCompare(b.paymentId));
}
