import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { feePaymentRecords, feePaymentStudentSplits, paymentAuditLogs } from '../shared/schema';
export class PurposeCorrectionError extends Error { constructor(message:string,public status=400){super(message);} }
const cents=(value:unknown)=>Math.round(Number(value)*100);
const money=(value:number)=>(value/100).toFixed(2);
const schema=z.object({allocationId:z.string().uuid(),tuitionFeeTypeId:z.string().uuid(),amount:z.number().positive().finite().max(9999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.0001,'Use at most two decimal places'),reason:z.string().trim().min(5).max(1000),expectedUpdatedAt:z.string(),expectedAmount:z.string(),expectedPurpose:z.string().nullable()}).strict();
type Ledger=(schoolId:string,term:string,session:string)=>Promise<any>;
async function context(tx:any,id:string,getLedger:Ledger){
 const [payment]=await tx.select().from(feePaymentRecords).where(eq(feePaymentRecords.id,id));
 if(!payment||payment.status!=='confirmed')throw new PurposeCorrectionError('Only a confirmed payment can be corrected. Refresh the payment list.',409);
 if(!payment.schoolId||!payment.term||!payment.session)throw new PurposeCorrectionError('This payment needs a verified school, term and session before correction.');
 const splits=await tx.select().from(feePaymentStudentSplits).where(eq(feePaymentStudentSplits.paymentRecordId,id));
 if(payment.studentId&&splits.length)throw new PurposeCorrectionError('This payment has conflicting student allocations. Review it before correction.');
 const allocations=payment.studentId?[{id:payment.id,studentId:payment.studentId,amount:payment.amount,purpose:payment.purpose}]:splits.map((s:any)=>({...s,purpose:s.purpose??payment.purpose}));
 if(!allocations.length||allocations.reduce((n:number,a:any)=>n+cents(a.amount),0)!==cents(payment.amount))throw new PurposeCorrectionError('Payment allocations do not match the transfer total. Review before correction.');
 const feeResult=await tx.execute(sql`SELECT id,name FROM fee_types WHERE school_id=${payment.schoolId} AND is_tuition=true AND is_active=true`);
 const tuitionTypes=feeResult.rows;
 const ledger=await getLedger(payment.schoolId,payment.term,payment.session);
 for(const allocation of allocations){
  const entry=ledger.entries.find((e:any)=>e.studentDbId===allocation.studentId);
  const used=await tx.execute(sql`SELECT COALESCE(SUM(amount),0)::text AS amount FROM (
    SELECT p.amount FROM fee_payment_records p WHERE p.student_id=${allocation.studentId} AND p.school_id=${payment.schoolId} AND p.term=${payment.term} AND p.session=${payment.session} AND p.status IN ('recorded','confirmed') AND EXISTS(SELECT 1 FROM fee_types ft WHERE ft.school_id=p.school_id AND ft.is_tuition=true AND ft.name=p.purpose)
    UNION ALL SELECT s.amount FROM fee_payment_student_splits s JOIN fee_payment_records p ON p.id=s.payment_record_id WHERE s.student_id=${allocation.studentId} AND p.school_id=${payment.schoolId} AND p.term=${payment.term} AND p.session=${payment.session} AND p.status IN ('recorded','confirmed') AND EXISTS(SELECT 1 FROM fee_types ft WHERE ft.school_id=p.school_id AND ft.is_tuition=true AND ft.name=COALESCE(s.purpose,p.purpose))
  ) amounts`);
  const identity=await tx.execute(sql`SELECT s.student_id,u.first_name,u.middle_name,u.last_name FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=${allocation.studentId}`);
  allocation.studentName=identity.rows[0]?[identity.rows[0].first_name,identity.rows[0].middle_name,identity.rows[0].last_name].filter(Boolean).join(' '):'Student';
  allocation.studentCode=identity.rows[0]?.student_id;
  allocation.availableTuition=entry?.tuitionKnown?money(Math.max(0,cents(entry.tuitionAssigned)-cents(used.rows[0].amount))):null;
  const tuition=await tx.execute(sql`SELECT id FROM fee_types WHERE school_id=${payment.schoolId} AND is_tuition=true AND name=${allocation.purpose??''} LIMIT 1`);
  allocation.isTuition=tuition.rows.length>0;
 }
 return {payment,allocations,tuitionTypes};
}
export async function previewPurposeCorrection(db:any,id:string,actor:any,getLedger:Ledger){
 if(actor.role!=='admin')throw new PurposeCorrectionError('Only the main admin can correct payment purposes',403);
 z.string().uuid().parse(id);return context(db,id,getLedger);
}
export async function correctPaymentPurpose(db:any,id:string,input:unknown,actor:any,getLedger:Ledger){
 if(actor.role!=='admin')throw new PurposeCorrectionError('Only the main admin can correct payment purposes',403);
 z.string().uuid().parse(id);const data=schema.parse(input);
 return db.transaction(async(tx:any)=>{
  const locked=await tx.execute(sql`SELECT id FROM fee_payment_records WHERE id=${id} FOR UPDATE`);
  if(!locked.rows.length)throw new PurposeCorrectionError('Payment not found',404);
  // Serialize with the recording form for the affected student(s).
  await tx.execute(sql`SELECT id FROM students WHERE id IN (SELECT student_id FROM fee_payment_records WHERE id=${id} UNION SELECT student_id FROM fee_payment_student_splits WHERE payment_record_id=${id}) ORDER BY id FOR UPDATE`);
  const before=await context(tx,id,getLedger);const p=before.payment;
  const selected=before.allocations.find((a:any)=>a.id===data.allocationId),tuition=before.tuitionTypes.find((f:any)=>f.id===data.tuitionFeeTypeId);
  if(!selected||!tuition)throw new PurposeCorrectionError('Select a valid allocation and tuition fee type');
  if(new Date(p.updatedAt).toISOString()!==data.expectedUpdatedAt||selected.amount!==data.expectedAmount||selected.purpose!==data.expectedPurpose)throw new PurposeCorrectionError('Payment details changed. Close and reopen this form before correcting.',409);
  if(selected.isTuition)throw new PurposeCorrectionError('This allocation is already tuition',409);
  const move=cents(data.amount),original=cents(selected.amount);
  if(move>original)throw new PurposeCorrectionError('The tuition amount cannot exceed the selected allocation');
  if(selected.availableTuition===null)throw new PurposeCorrectionError('Tuition is not verified for this student and period. Set the charge first.');
  if(move>cents(selected.availableTuition))throw new PurposeCorrectionError(`Only ₦${Number(selected.availableTuition).toLocaleString()} is available for tuition, including pending payments. Reduce the correction amount; the remainder stays under its original purpose.`);
  const receipt=await tx.execute(sql`SELECT id::text,snapshot FROM payment_student_receipts WHERE payment_record_id=${id} AND student_id=${selected.studentId} FOR UPDATE`);
  const items=(rows:any[])=>rows.filter(a=>a.studentId===selected.studentId).map(a=>({purpose:a.purpose??'Payment',amount:a.amount}));
  const signature=(rows:any[])=>JSON.stringify(rows.map(a=>[a.purpose,cents(a.amount)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(receipt.rows[0]&&signature(receipt.rows[0].snapshot.items)!==signature(items(before.allocations)))throw new PurposeCorrectionError('The issued receipt does not match the existing allocation. Review it before correction.',409);
  const afterRows=before.allocations.map((a:any)=>({...a,purpose:a.purpose??'Payment'}));const index=afterRows.findIndex((a:any)=>a.id===selected.id);
  if(p.studentId){
   if(move===original){await tx.update(feePaymentRecords).set({purpose:tuition.name,updatedAt:new Date()}).where(eq(feePaymentRecords.id,id));afterRows[index].purpose=tuition.name;}
   else{
    await tx.update(feePaymentRecords).set({studentId:null,purpose:'Multiple purposes',updatedAt:new Date()}).where(eq(feePaymentRecords.id,id));
    await tx.insert(feePaymentStudentSplits).values([{paymentRecordId:id,studentId:selected.studentId,purpose:selected.purpose??'Payment',amount:money(original-move)},{paymentRecordId:id,studentId:selected.studentId,purpose:tuition.name,amount:money(move)}]);
    afterRows[index].amount=money(original-move);afterRows.push({...selected,purpose:tuition.name,amount:money(move)});
   }
  }else{
   // Materialize legacy inherited purposes before changing the parent's summary.
   await tx.execute(sql`UPDATE fee_payment_student_splits SET purpose=${p.purpose??'Payment'} WHERE payment_record_id=${id} AND purpose IS NULL`);
   if(move===original){await tx.update(feePaymentStudentSplits).set({purpose:tuition.name}).where(eq(feePaymentStudentSplits.id,selected.id));afterRows[index].purpose=tuition.name;}
   else{await tx.update(feePaymentStudentSplits).set({amount:money(original-move)}).where(eq(feePaymentStudentSplits.id,selected.id));await tx.insert(feePaymentStudentSplits).values({paymentRecordId:id,studentId:selected.studentId,purpose:tuition.name,amount:money(move)});afterRows[index].amount=money(original-move);afterRows.push({...selected,purpose:tuition.name,amount:money(move)});}
   const purposes=Array.from(new Set(afterRows.map((a:any)=>a.purpose)));
   await tx.update(feePaymentRecords).set({purpose:purposes.length===1?purposes[0]:'Multiple purposes',updatedAt:new Date()}).where(eq(feePaymentRecords.id,id));
  }
  const correctedAt=new Date().toISOString();
  if(receipt.rows[0]){
   const old=receipt.rows[0].snapshot,next={...old,items:items(afterRows),correctedAt,correctionReason:data.reason};
   await tx.execute(sql`UPDATE payment_student_receipts SET snapshot=${JSON.stringify(next)}::jsonb WHERE id=${receipt.rows[0].id}::bigint`);
   await tx.insert(paymentAuditLogs).values({action:'correct_receipt_purpose',entityType:'payment_record',entityId:id,userId:actor.id,actorRole:actor.role,schoolId:p.schoolId,previousData:{receiptId:receipt.rows[0].id,snapshot:old},newData:{receiptId:receipt.rows[0].id,snapshot:next,reason:data.reason}});
  }
  await tx.insert(paymentAuditLogs).values({action:'correct_payment_purpose',entityType:'payment_record',entityId:id,userId:actor.id,actorRole:actor.role,schoolId:p.schoolId,previousData:{studentId:selected.studentId,allocationId:selected.id,items:items(before.allocations)},newData:{studentId:selected.studentId,items:items(afterRows),amountMoved:money(move),reason:data.reason,term:p.term,session:p.session,correctedAt}});
  return {paymentId:id,studentId:selected.studentId,amountMoved:money(move),remainder:money(original-move)};
 });
}
