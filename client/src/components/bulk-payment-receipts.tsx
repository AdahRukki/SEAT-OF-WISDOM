import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {receiptKey,sortReceipts,type StudentReceipt} from '@shared/payment-receipts';
import type {LedgerPayment} from '@shared/ledger-payments';
export interface ReceiptCandidate {
  paymentId:string;studentId:string;studentCode:string;firstName:string;lastName:string;className:string;paymentDate:string;amount:number;
}
export function receiptCandidates(entries:{studentDbId:string;studentId:string;firstName:string;lastName:string;className:string}[],payments:LedgerPayment[]):ReceiptCandidate[] {
  const students=new Map(entries.map(e=>[e.studentDbId,e]));const groups=new Map<string,ReceiptCandidate>();
  for(const payment of payments){
    const student=students.get(payment.studentDbId);if(!student||payment.status!=='confirmed')continue;
    const key=receiptKey(payment.paymentRecordId,payment.studentDbId);
    const group=groups.get(key)||{paymentId:payment.paymentRecordId,studentId:student.studentDbId,studentCode:student.studentId,firstName:student.firstName,lastName:student.lastName,className:student.className,paymentDate:payment.paymentDate||'',amount:0};
    group.amount=(Math.round(group.amount*100)+Math.round(Number(payment.amount)*100))/100;groups.set(key,group);
  }
  return sortReceipts(Array.from(groups.values()));
}
export function BulkPaymentReceipts({schoolId,candidates,onClose}:{schoolId:string;candidates:ReceiptCandidate[];onClose:()=>void}) {
  const [selected,setSelected]=useState(()=>new Set(candidates.map(c=>receiptKey(c.paymentId,c.studentId))));
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function generate(print:boolean){
    if(busy||!selected.size)return;
    const popup=print?window.open('about:blank','_blank'):null;
    if(print&&!popup){setError('Allow pop-ups to print, or choose Download PDF.');return;}
    if(popup)popup.document.body.textContent='Preparing receipts…';
    setBusy(true);setError('');
    try{
      const token=localStorage.getItem('auth_token');
      const response=await fetch('/api/payments/receipts',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({schoolId,selections:candidates.filter(c=>selected.has(receiptKey(c.paymentId,c.studentId))).map(c=>({paymentId:c.paymentId,studentId:c.studentId}))})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not prepare receipts');
      const receipts:StudentReceipt[]=data.receipts;
      const {buildReceiptPdf,loadReceiptLogos}=await import('@/lib/receipt-pdf');
      const pdf=buildReceiptPdf(receipts,await loadReceiptLogos(receipts));
      if(popup){pdf.autoPrint();const url=URL.createObjectURL(pdf.output('blob'));popup.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000);}
      else pdf.save('student-payment-receipts.pdf');
    }catch(e){popup?.close();setError(e instanceof Error?e.message:'Could not prepare receipts');}
    finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
    <DialogHeader><DialogTitle>Print student receipts</DialogTitle><DialogDescription>One receipt per student per confirmed payment. Three slips per A4 page, sorted by class, surname and payment date.</DialogDescription></DialogHeader>
    <p className="text-xs text-muted-foreground">Uses your ledger filters. Receipt details and class are saved when first issued; reprints retain them. Long breakdowns continue on another slip.</p>
    <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={selected.size===candidates.length&&!!candidates.length} disabled={busy} onChange={e=>setSelected(e.target.checked?new Set(candidates.map(c=>receiptKey(c.paymentId,c.studentId))):new Set())}/>Select all filtered payments ({candidates.length})</label>
    <div className="overflow-y-auto min-h-0 divide-y border rounded-md">
      {candidates.map(c=>{const key=receiptKey(c.paymentId,c.studentId);return <label key={key} className="flex items-start gap-3 p-3 text-sm cursor-pointer"><input className="mt-1" type="checkbox" checked={selected.has(key)} disabled={busy} onChange={e=>setSelected(prev=>{const next=new Set(prev);e.target.checked?next.add(key):next.delete(key);return next;})}/><span className="flex-1 min-w-0"><strong>{c.lastName} {c.firstName}</strong><span className="block text-xs text-muted-foreground">{c.className||'Unassigned'} · {c.studentCode} · {c.paymentDate.slice(0,10)}</span></span><span>₦{c.amount.toLocaleString()}</span></label>;})}
    </div>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-sm">{selected.size} receipts selected{selected.size>2000?' — select up to 2,000 at a time':''}</p>
    <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="outline" disabled={busy||!selected.size||selected.size>2000} onClick={()=>generate(true)}>Print</Button><Button disabled={busy||!selected.size||selected.size>2000} onClick={()=>generate(false)}>{busy?'Preparing…':'Download PDF'}</Button></div>
  </DialogContent></Dialog>;
}
