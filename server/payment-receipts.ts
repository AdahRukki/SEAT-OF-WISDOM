import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {paymentAuditLogs} from '../shared/schema';
import {receiptKey,sortReceipts,type StudentReceipt} from '../shared/payment-receipts';
export const receiptRequestSchema=z.object({schoolId:z.string().uuid(), selections:z.array(z.object({paymentId:z.string().uuid(),studentId:z.string().uuid()})).min(1).max(2000)});
export class ReceiptError extends Error { constructor(message:string,public status=400){super(message);} }
export async function issueStudentReceipts(database:any,input:unknown,actor:{id:string;role:string;schoolId?:string|null}) {
  const data=receiptRequestSchema.parse(input);
  if(!['admin','sub-admin','bursar'].includes(actor.role)||(actor.role!=='admin'&&actor.schoolId!==data.schoolId))throw new ReceiptError('You can only issue receipts for your school',403);
  const selections=Array.from(new Map(data.selections.map(s=>[receiptKey(s.paymentId,s.studentId),s])).values());
  const ids=Array.from(new Set(selections.map(s=>s.paymentId))).sort();
  return database.transaction(async(tx:any)=>{
    // Lock parents against confirmation reversal while checking and issuing.
    const parents=await tx.execute(sql`SELECT id FROM fee_payment_records WHERE school_id=${data.schoolId} AND status='confirmed' AND id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)}) ORDER BY id FOR UPDATE`);
    if(parents.rows.length!==ids.length)throw new ReceiptError('A selected payment is no longer confirmed or does not belong to this school. Refresh the ledger.',409);
    const rows=await tx.execute(sql`
      WITH allocations AS (
        SELECT id AS payment_id,student_id,amount,purpose FROM fee_payment_records WHERE student_id IS NOT NULL
        UNION ALL
        SELECT ss.payment_record_id,ss.student_id,ss.amount,COALESCE(ss.purpose,p.purpose) FROM fee_payment_student_splits ss JOIN fee_payment_records p ON p.id=ss.payment_record_id
      )
      SELECT p.id AS "paymentId",s.id AS "studentId",s.student_id AS "studentCode",u.first_name AS "firstName",u.last_name AS "lastName",
        COALESCE(c.name,'Unassigned') AS "className",sch.name AS "schoolName",COALESCE(sch.address,'') AS "schoolAddress",sch.logo_url AS "logoUrl",
        p.term,p.session,COALESCE(p.depositor_name,'') AS depositor,p.payment_method AS method,COALESCE(p.reference,'') AS reference,
        p.payment_date::date::text AS "paymentDate",(p.confirmed_at AT TIME ZONE 'UTC') AS "confirmedAt",
        jsonb_agg(jsonb_build_object('purpose',COALESCE(a.purpose,'Payment'),'amount',a.amount::text) ORDER BY a.purpose) AS items,SUM(a.amount)::text AS total
      FROM allocations a JOIN fee_payment_records p ON p.id=a.payment_id JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id
      LEFT JOIN classes c ON c.id=s.class_id JOIN schools sch ON sch.id=p.school_id
      WHERE p.school_id=${data.schoolId} AND p.status='confirmed' AND p.id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)})
      GROUP BY p.id,s.id,u.id,c.name,sch.id`);
    const available=new Map(rows.rows.map((r:any)=>[receiptKey(r.paymentId,r.studentId),r]));
    if(selections.some(s=>!available.has(receiptKey(s.paymentId,s.studentId))))throw new ReceiptError('A selected student has no allocation in this payment',409);
    const receipts:StudentReceipt[]=[];
    for(const selection of selections.sort((a,b)=>receiptKey(a.paymentId,a.studentId).localeCompare(receiptKey(b.paymentId,b.studentId)))) {
      const snapshot:any=available.get(receiptKey(selection.paymentId,selection.studentId));
      const inserted=await tx.execute(sql`INSERT INTO payment_student_receipts(payment_record_id,student_id,school_id,snapshot,issued_by) VALUES (${selection.paymentId},${selection.studentId},${data.schoolId},${JSON.stringify(snapshot)}::jsonb,${actor.id}) ON CONFLICT(payment_record_id,student_id) DO NOTHING RETURNING id`);
      const saved=await tx.execute(sql`SELECT id::text,snapshot FROM payment_student_receipts WHERE payment_record_id=${selection.paymentId} AND student_id=${selection.studentId} AND school_id=${data.schoolId}`);
      if(!saved.rows[0])throw new ReceiptError('Receipt could not be issued',409);
      const financialSignature=(r:any)=>JSON.stringify({total:Math.round(Number(r.total)*100),items:r.items.map((item:any)=>[item.purpose,Math.round(Number(item.amount)*100)]).sort(),term:r.term,session:r.session,paymentDate:r.paymentDate,confirmedAt:r.confirmedAt?new Date(r.confirmedAt).toISOString():null,method:r.method,reference:r.reference,depositor:r.depositor});
      if(financialSignature(saved.rows[0].snapshot)!==financialSignature(snapshot))throw new ReceiptError('Payment details changed after this receipt was issued. Review the original receipt before reissuing.',409);
      const receipt={...saved.rows[0].snapshot,number:`SOW-${saved.rows[0].id.padStart(8,'0')}`} as StudentReceipt;
      receipts.push(receipt);
      await tx.insert(paymentAuditLogs).values({action:inserted.rows.length?'issue_receipt':'reprint_receipt',entityType:'payment_record',entityId:selection.paymentId,userId:actor.id,schoolId:data.schoolId,newData:{receiptNumber:receipt.number,studentId:selection.studentId}});
    }
    return sortReceipts(receipts);
  });
}
