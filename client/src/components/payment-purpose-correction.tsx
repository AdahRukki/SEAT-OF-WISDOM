import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/hooks/use-auth';
import {apiRequest} from '@/lib/queryClient';
import {useToast} from '@/hooks/use-toast';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
const naira=(v:any)=>`₦${Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2})}`;
export function PaymentPurposeCorrection({paymentId,status}:{paymentId:string;status:string}){
 const {user}=useAuth();const qc=useQueryClient();const {toast}=useToast();
 const [open,setOpen]=useState(false),[allocationId,setAllocationId]=useState(''),[feeId,setFeeId]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState('');
 const query=useQuery<any>({queryKey:['/api/admin/payments',paymentId,'purpose-correction'],queryFn:()=>apiRequest(`/api/admin/payments/${paymentId}/purpose-correction`),enabled:open&&user?.role==='admin',staleTime:0,gcTime:0});
 const data=query.data;const choices=data?.allocations.filter((a:any)=>!a.isTuition)||[];
 const selected=choices.find((a:any)=>a.id===allocationId)||choices[0];
 const selectedFee=feeId||data?.tuitionTypes[0]?.id;
 const value=amount===''?Math.min(Number(selected?.amount||0),Number(selected?.availableTuition||0)):Number(amount);
 const valid=selected&&selectedFee&&selected.availableTuition!==null&&value>0&&value<=Number(selected.amount)&&value<=Number(selected.availableTuition)&&reason.trim().length>=5;
 const save=useMutation({mutationFn:()=>apiRequest(`/api/admin/payments/${paymentId}/purpose-correction`,{method:'PATCH',body:{allocationId:selected.id,tuitionFeeTypeId:selectedFee,amount:value,reason:reason.trim(),expectedAmount:selected.amount,expectedPurpose:selected.purpose,expectedUpdatedAt:new Date(data.payment.updatedAt).toISOString()}}),onSuccess:()=>{
  qc.invalidateQueries();setOpen(false);toast({title:'Payment purpose corrected',description:'Tuition balances and receipt details have been updated. The bank match is unchanged.'});
 },onError:(e:Error)=>toast({title:'Correction not saved',description:e.message,variant:'destructive'})});
 if(user?.role!=='admin'||status!=='confirmed')return null;
 return <><Button type="button" variant="outline" size="sm" className="min-h-11 whitespace-normal" onClick={()=>{setAllocationId('');setFeeId('');setAmount('');setReason('');setOpen(true);}}>Correct purpose</Button>
 <Dialog open={open} onOpenChange={v=>{if(!save.isPending)setOpen(v);}}><DialogContent className="w-[95vw] max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Move other payment to tuition</DialogTitle><DialogDescription>Correct a confirmed allocation. The transfer total, bank match and confirmation date stay unchanged.</DialogDescription></DialogHeader>
 {query.isLoading?<p role="status">Loading payment and tuition balance…</p>:query.isError?<div role="alert">Could not load payment: {(query.error as Error).message}<Button variant="outline" onClick={()=>query.refetch()}>Retry</Button></div>:data&&<>
 <p className="text-sm font-medium">{data.payment.term} · {data.payment.session}</p>
 {!choices.length?<p>This payment has no non-tuition allocation to correct.</p>:!data.tuitionTypes.length?<p>Set up an active tuition fee type for this school first.</p>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();if(valid)save.mutate();}}><fieldset disabled={save.isPending} className="space-y-4">
 <div><Label htmlFor={`allocation-${paymentId}`}>Student and payment to correct</Label><select id={`allocation-${paymentId}`} className="w-full min-h-11 border rounded-md bg-background px-2" value={selected?.id||''} onChange={e=>{setAllocationId(e.target.value);setAmount('');}}>{choices.map((a:any)=><option key={a.id} value={a.id}>{a.studentName} ({a.studentCode}) — {a.purpose||'Other'} — {naira(a.amount)}</option>)}</select></div>
 <div><Label htmlFor={`fee-${paymentId}`}>Tuition purpose</Label><select id={`fee-${paymentId}`} className="w-full min-h-11 border rounded-md bg-background px-2" value={selectedFee||''} onChange={e=>setFeeId(e.target.value)}>{data.tuitionTypes.map((f:any)=><option value={f.id} key={f.id}>{f.name}</option>)}</select></div>
 <div className="rounded-md bg-muted p-3 text-sm space-y-1"><p>Selected payment: <strong>{naira(selected?.amount)}</strong></p><p>Available tuition balance: <strong>{selected?.availableTuition===null?'Not verified':naira(selected?.availableTuition)}</strong></p><p className="text-muted-foreground">The balance includes tuition already recorded and awaiting confirmation.</p></div>
 <div><Label htmlFor={`amount-${paymentId}`}>Amount to move to tuition</Label><Input id={`amount-${paymentId}`} type="number" inputMode="decimal" step="0.01" min="0.01" max={Math.min(Number(selected?.amount),Number(selected?.availableTuition))} value={amount===''?value:amount} onChange={e=>setAmount(e.target.value)}/><p className="text-sm mt-2">Remaining under {selected?.purpose||'Other'}: <strong>{naira(Math.max(0,Number(selected?.amount||0)-value))}</strong></p></div>
 <div><Label htmlFor={`reason-${paymentId}`}>Reason for correction</Label><Textarea id={`reason-${paymentId}`} required minLength={5} maxLength={1000} placeholder="For example: tuition was mistakenly recorded as Books" value={reason} onChange={e=>setReason(e.target.value)}/></div>
 <p className="text-xs text-muted-foreground">Any issued receipt keeps its number and receives corrected purpose details. The previous details and your reason remain in the audit trail. Other students’ allocations are unchanged.</p>
 </fieldset><div className="sticky bottom-0 bg-background py-2 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={!valid||save.isPending||query.isFetching}>{save.isPending?'Saving…':'Save correction'}</Button></div></form>}
 </>}
 </DialogContent></Dialog></>;
}
