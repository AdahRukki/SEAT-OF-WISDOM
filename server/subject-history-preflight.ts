import { connectSubjectDb } from "./subject-db-client";
export async function inspectSubjectHistory(classIds:string[]) {
 const client=await connectSubjectDb();
 try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const periods=(await client.query(`SELECT class_id,session,term FROM assessments WHERE class_id=ANY($1::varchar[])
 UNION SELECT class_id,session,term FROM published_scores WHERE class_id=ANY($1::varchar[])
 UNION SELECT class_id,session,term FROM generated_report_cards WHERE class_id=ANY($1::varchar[])
 ORDER BY class_id,session,term`,[classIds])).rows;
  const available=(await client.query("SELECT to_regclass('class_subject_period_snapshots') IS NOT NULL AS present")).rows[0].present;
  const snapshots=available?(await client.query("SELECT class_id,session,term,subjects,provenance FROM class_subject_period_snapshots WHERE class_id=ANY($1::varchar[])",[classIds])).rows:[];
  const missing=periods.filter(p=>!snapshots.some(s=>s.class_id===p.class_id&&s.session===p.session&&s.term===p.term));
  await client.query("COMMIT");
  return {periods,missing,snapshots,blocked:!available||missing.length>0};
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export async function captureVerifiedSubjectHistory(input:{classId:string;session:string;term:string;actorId:string;subjects:{id:string;name:string}[];confirmed:boolean}) {
 if(!input.confirmed||!input.actorId||!input.classId||!input.session||!input.term||!input.subjects.length||input.subjects.some(s=>!s.id||!s.name.trim())||new Set(input.subjects.map(s=>s.id)).size!==input.subjects.length)throw new Error("Verified historical subject list required");
 const client=await connectSubjectDb();
 try{
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  const cls=(await client.query("SELECT id FROM classes WHERE id=$1 FOR SHARE",[input.classId])).rows[0];
  if(!cls)throw new Error("Unknown class");
  const known=(await client.query("SELECT id FROM subjects WHERE id=ANY($1::uuid[]) FOR SHARE",[input.subjects.map(s=>s.id)])).rows;
  if(known.length!==input.subjects.length)throw new Error("Unknown historical subject");
  await client.query("INSERT INTO class_subject_period_snapshots(class_id,session,term,captured_by,provenance,subjects) VALUES($1,$2,$3,$4,'verified_historical',$5::jsonb)",[input.classId,input.session,input.term,input.actorId,JSON.stringify(input.subjects)]);
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
