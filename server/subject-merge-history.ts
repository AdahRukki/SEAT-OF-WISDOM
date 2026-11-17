import { pool } from "./db";
export async function listSubjectMergeHistory(){
 const client=await pool.connect();
 try{
  if(!(await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AS present")).rows[0].present)return [];
  return (await client.query(`SELECT operation_id,actor_id,source_id,target_id,created_at,
  (SELECT s->>'name' FROM jsonb_array_elements(snapshot->'subjects') s WHERE s->>'id'=source_id::text LIMIT 1) AS source_name,
  (SELECT s->>'name' FROM jsonb_array_elements(snapshot->'subjects') s WHERE s->>'id'=target_id::text LIMIT 1) AS target_name,
  jsonb_array_length(snapshot->'assessments') AS assessment_count,
  jsonb_array_length(snapshot->'assignments') AS assignment_count
  FROM subject_merge_snapshots ORDER BY created_at DESC LIMIT 200`)).rows;
 }finally{client.release();}
}
