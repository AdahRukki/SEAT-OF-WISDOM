import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { recordFeePaymentSchema, feePaymentRecords, feePaymentStudentSplits, paymentAuditLogs } from '../shared/schema';

export const paymentBatchSchema = recordFeePaymentSchema.omit({studentId:true, amount:true, purpose:true}).extend({
  schoolId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  totalAmount: recordFeePaymentSchema.shape.amount,
  rows: z.array(recordFeePaymentSchema.pick({studentId:true,amount:true,purpose:true}).extend({studentId:z.string().uuid()})).min(1).max(100),
}).superRefine((data, ctx) => {
  const total = data.rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  if (total !== Math.round(data.totalAmount * 100)) ctx.addIssue({code:'custom',path:['totalAmount'],message:'Payment rows must equal the amount received'});
  const seen = new Set<string>();
  for (const row of data.rows) {
    const key = row.studentId + ':' + row.purpose.toLowerCase();
    if (seen.has(key)) ctx.addIssue({code:'custom',path:['rows'],message:'Combine payments with the same student and purpose into one row'});
    seen.add(key);
  }
});
export class PaymentBatchError extends Error {
  constructor(message:string, public status=400){super(message);}
}
// Inject the database and charge lookup so the complete transaction can be tested
// against a disposable database. No writes occur outside this transaction.
export async function recordPaymentBatch(database:any, input:unknown, actor:{id:string;role:string;schoolId?:string|null}, getLedger:(schoolId:string,term:string,session:string)=>Promise<any>, ipAddress?:string) {
  const data = paymentBatchSchema.parse(input);
  if (!['admin','sub-admin','bursar'].includes(actor.role) || (actor.role !== 'admin' && actor.schoolId !== data.schoolId)) throw new PaymentBatchError('You can only record payments for your school',403);
  return database.transaction(async(tx:any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${data.clientRequestId}, 0))`);
    const keys = data.rows.map((_,i)=>`batch:${data.clientRequestId}:${i}`);
    const existing = await tx.select().from(feePaymentRecords).where(sql`${feePaymentRecords.clientRequestId} LIKE ${`batch:${data.clientRequestId}:%`}`);
    const parent = existing.find((r:any)=>r.clientRequestId===`batch:${data.clientRequestId}:parent`);
    if(parent) {
      const splits=await tx.select().from(feePaymentStudentSplits).where(sql`${feePaymentStudentSplits.paymentRecordId}=${parent.id}`);
      const signature=(rows:any[])=>rows.map(r=>`${r.studentId}:${r.purpose}:${Math.round(Number(r.amount)*100)}`).sort().join('|');
      if(parent.schoolId!==data.schoolId || parent.recordedBy!==actor.id || Number(parent.amount)!==data.totalAmount || parent.term!==data.term || parent.session!==data.session || parent.depositorName!==data.depositorName || parent.paymentMethod!==data.paymentMethod || (parent.reference||'')!==(data.reference||'') || new Date(parent.paymentDate).toISOString().slice(0,10)!==data.paymentDate || signature(splits)!==signature(data.rows)) throw new PaymentBatchError('This submission was already saved with different details',409);
      return {records:[parent],idempotent:true};
    }
    // Older queued submissions may already have separate child records. A retry
    // must return those records, never insert a second transfer.
    if(existing.length){
      if(existing.length !== data.rows.length || existing.some((r:any)=>r.schoolId !== data.schoolId || r.recordedBy !== actor.id)) throw new PaymentBatchError('This submission key is already in use',409);
      for(let i=0;i<data.rows.length;i++) {
        const row=data.rows[i], record=existing.find((r:any)=>r.clientRequestId===keys[i]);
        if(!record || record.studentId!==row.studentId || Number(record.amount)!==row.amount || record.purpose!==row.purpose || record.term!==data.term || record.session!==data.session || record.depositorName!==data.depositorName || record.paymentMethod!==data.paymentMethod || (record.reference||'')!==(data.reference||'') || new Date(record.paymentDate).toISOString().slice(0,10)!==data.paymentDate) throw new PaymentBatchError('This submission was already saved with different details',409);
      }
      return {records:existing,idempotent:true};
    }
    const ids=Array.from(new Set(data.rows.map(r=>r.studentId))).sort();
    const roster=await tx.execute(sql`SELECT s.id FROM students s JOIN classes c ON c.id=s.class_id JOIN users u ON u.id=s.user_id WHERE s.id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)}) AND c.school_id=${data.schoolId} AND u.is_active=true ORDER BY s.id FOR UPDATE OF s`);
    if(roster.rows.length !== ids.length) throw new PaymentBatchError('One or more students are inactive or do not belong to this school',403);
    const fees=await tx.execute(sql`SELECT name,is_tuition FROM fee_types WHERE school_id=${data.schoolId}`);
    const tuitionNames = new Set(fees.rows.filter((r:any)=>r.is_tuition).map((r:any)=>r.name));
    const tuitionRows=data.rows.filter(row=>tuitionNames.has(row.purpose));
    if(tuitionRows.length){
      const ledger=await getLedger(data.schoolId,data.term,data.session);
      for(const studentId of Array.from(new Set(tuitionRows.map(r=>r.studentId)))) {
        const charge=ledger.entries.find((e:any)=>e.studentDbId===studentId);
        if(!charge?.tuitionKnown) throw new PaymentBatchError('Tuition is not verified for this student and period. Set the tuition charge before recording it.');
        const pending=await tx.execute(sql`
          SELECT COALESCE(SUM(amount),0) AS amount FROM (
            SELECT p.amount FROM fee_payment_records p WHERE p.student_id=${studentId} AND p.school_id=${data.schoolId} AND p.term=${data.term} AND p.session=${data.session} AND p.status IN ('recorded','confirmed')
              AND EXISTS (SELECT 1 FROM fee_types ft WHERE ft.school_id=p.school_id AND ft.is_tuition=true AND ft.name=p.purpose)
            UNION ALL SELECT ss.amount FROM fee_payment_student_splits ss JOIN fee_payment_records p ON p.id=ss.payment_record_id WHERE ss.student_id=${studentId} AND p.school_id=${data.schoolId} AND p.term=${data.term} AND p.session=${data.session} AND p.status IN ('recorded','confirmed')
              AND EXISTS (SELECT 1 FROM fee_types ft WHERE ft.school_id=p.school_id AND ft.is_tuition=true AND ft.name=COALESCE(ss.purpose,p.purpose))
          ) payments`);
        const due=Math.max(0,Math.round(charge.tuitionAssigned*100)-Math.round(Number(pending.rows[0].amount)*100));
        const requested=tuitionRows.filter(r=>r.studentId===studentId).reduce((sum,r)=>sum+Math.round(r.amount*100),0);
        if(requested>due) throw new PaymentBatchError(`Tuition exceeds the available balance by ₦${((requested-due)/100).toLocaleString()}. Pending payments are included. Reduce tuition and add the correct purpose for any other payment.`);
      }
    }
    let duplicateId:string|null=null;
    for(let i=0;i<data.rows.length;i++){
      const row=data.rows[i];
      const dup=await tx.execute(sql`
        SELECT p.id FROM fee_payment_records p
        WHERE p.school_id=${data.schoolId} AND p.status<>'reversed' AND p.payment_date::date=${data.paymentDate}::date
          AND ((p.student_id=${row.studentId} AND p.amount=${row.amount} AND p.purpose=${row.purpose}) OR EXISTS (SELECT 1 FROM fee_payment_student_splits ss WHERE ss.payment_record_id=p.id AND ss.student_id=${row.studentId} AND ss.amount=${row.amount} AND COALESCE(ss.purpose,p.purpose)=${row.purpose}))
        ORDER BY p.created_at,p.id LIMIT 1`);
      duplicateId ??= dup.rows[0]?.id ?? null;
    }
    const purposes=Array.from(new Set(data.rows.map(row=>row.purpose)));
    const [record]=await tx.insert(feePaymentRecords).values({studentId:null,schoolId:data.schoolId,amount:data.totalAmount.toFixed(2),purpose:purposes.length===1?purposes[0]:'Multiple purposes',paymentMethod:data.paymentMethod,paymentDate:new Date(data.paymentDate+'T00:00:00Z'),depositorName:data.depositorName,reference:data.reference,term:data.term,session:data.session,notes:data.notes,recordedBy:actor.id,status:'recorded',clientRequestId:`batch:${data.clientRequestId}:parent`,possibleDuplicate:!!duplicateId,duplicateOfPaymentId:duplicateId}).returning();
    await tx.insert(feePaymentStudentSplits).values(data.rows.map(row=>({paymentRecordId:record.id,studentId:row.studentId,amount:row.amount.toFixed(2),purpose:row.purpose})));
    await tx.insert(paymentAuditLogs).values({action:'record_payment',entityType:'payment_record',entityId:record.id,userId:actor.id,schoolId:data.schoolId,newData:{...record,batchId:data.clientRequestId,allocations:data.rows},ipAddress});
    return {records:[record],idempotent:false};
  });
}
