import { connectSubjectDb } from "./subject-db-client";
export async function listSubjectMergeHistory(){
 const client=await connectSubjectDb();
 try{
  if(!(await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AS present")).rows[0].present)return [];
  return (await client.query(`WITH history AS (
    SELECT operation_id, actor_id, source_id, target_id, created_at, snapshot,
      NULL::timestamptz AS recovered_at, NULL::text AS recovered_by FROM subject_merge_snapshots
    UNION ALL
    SELECT r.operation_id, r.merge_record->>'actor_id', (r.merge_record->>'source_id')::uuid,
      (r.merge_record->>'target_id')::uuid,(r.merge_record->>'created_at')::timestamptz,
      r.merge_record->'snapshot',r.recovered_at,r.actor_id FROM subject_merge_recoveries r
  )
  SELECT operation_id,actor_id,source_id,target_id,created_at,recovered_at,recovered_by,
  (SELECT s->>'name' FROM jsonb_array_elements(snapshot->'subjects') s WHERE s->>'id'=source_id::text LIMIT 1) AS source_name,
  (SELECT s->>'name' FROM jsonb_array_elements(snapshot->'subjects') s WHERE s->>'id'=target_id::text LIMIT 1) AS target_name,
  jsonb_array_length(snapshot->'assessments') AS assessment_count,
  jsonb_array_length(snapshot->'assignments') AS assignment_count
  FROM history ORDER BY created_at DESC,operation_id`)).rows;
 }finally{client.release();}
}
