import { pool } from "./db";
type ReportSubject = {id:string;name:string};
export async function loadReportPeriodSubjects(classId:string,session:string,term:string):Promise<ReportSubject[]|null> {
 const client=await pool.connect();
 try {
  const available=await client.query("SELECT to_regclass('class_subject_period_snapshots') IS NOT NULL AS present");
  if(!available.rows[0].present)return null;
  const result=await client.query("SELECT subjects FROM class_subject_period_snapshots WHERE class_id=$1 AND session=$2 AND term=$3",[classId,session,term]);
  if(!result.rows.length)return null;
  const rows:unknown=result.rows[0].subjects;
  if(!Array.isArray(rows)||rows.some(s=>!s||typeof s.id!=="string"||typeof s.name!=="string"||!s.id||!s.name)||new Set(rows.map(s=>s.id)).size!==rows.length)throw new Error("Invalid historical subject snapshot");
  return rows.map(s=>({id:s.id,name:s.name}));
 }finally{client.release();}
}
