import { connectSubjectDb } from "./subject-db-client";
const normalize=(s:string)=>s.trim().replace(/\s+/g," ").toUpperCase();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveMasterConfiguration(input:{referenceClassId:string;session:string;subjectIds:string[];actorId:string;expectedVersion:number}) {
 const session=input.session.trim();
 if(!/^\d{4}\/\d{4}$/.test(session)||Number(session.slice(5))!==Number(session.slice(0,4))+1||
 !input.actorId||!input.referenceClassId||!Number.isInteger(input.expectedVersion)||input.expectedVersion<0||
 !input.subjectIds.length||input.subjectIds.length>200||input.subjectIds.some(id=>!uuid.test(id)))throw new Error("Invalid configuration");
 const ids=Array.from(new Set(input.subjectIds.map(id=>id.toLowerCase()))).sort();
 const client=await connectSubjectDb();
 try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("LOCK TABLE subjects IN SHARE MODE");
  const cls=(await client.query("SELECT id,name FROM classes WHERE id=$1 FOR SHARE",[input.referenceClassId])).rows[0];
  if(!cls)throw new Error("Reference class not found");
  const subjects=(await client.query("SELECT id,name FROM subjects WHERE id=ANY($1::uuid[]) ORDER BY id",[ids])).rows;
  if(subjects.length!==ids.length||new Set(subjects.map(s=>normalize(s.name))).size!==ids.length)throw new Error("Unknown or duplicate subjects");
  const exists=(await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AS present")).rows[0].present;
  if(exists&&(await client.query("SELECT 1 FROM subject_merge_snapshots WHERE source_id=ANY($1::uuid[])",[ids])).rows.length)throw new Error("Archived subject selected");
  const key=normalize(cls.name);
  await client.query("INSERT INTO master_subject_configurations(class_key,session) VALUES($1,$2) ON CONFLICT(class_key,session) DO NOTHING",[key,session]);
  const config=(await client.query("SELECT id FROM master_subject_configurations WHERE class_key=$1 AND session=$2 FOR UPDATE",[key,session])).rows[0];
  const current=Number((await client.query("SELECT COALESCE(MAX(version),0) AS version FROM master_subject_configuration_versions WHERE configuration_id=$1",[config.id])).rows[0].version);
  if(current!==input.expectedVersion)throw new Error("Configuration changed; reload before saving");
  const version=(await client.query("INSERT INTO master_subject_configuration_versions(configuration_id,version,reference_class_id,actor_id) VALUES($1,$2,$3,$4) RETURNING *",[config.id,current+1,cls.id,input.actorId])).rows[0];
  for(const subject of subjects)await client.query("INSERT INTO master_subject_configuration_items(version_id,subject_id,subject_name) VALUES($1,$2,$3)",[version.id,subject.id,subject.name]);
  await client.query("COMMIT");
  return {configurationId:config.id,versionId:version.id,version:current+1,classKey:key,session,subjects};
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}

export async function loadMasterConfigurations(session:string) {
 const client=await connectSubjectDb();
 try {
  const result=await client.query(`SELECT c.id AS configuration_id,c.class_key,c.session,v.id AS version_id,v.version,v.reference_class_id,v.actor_id,v.created_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.subject_id,'name',i.subject_name) ORDER BY i.subject_name,i.subject_id) FROM master_subject_configuration_items i WHERE i.version_id=v.id),'[]'::jsonb) AS subjects
  FROM master_subject_configurations c JOIN LATERAL (SELECT * FROM master_subject_configuration_versions WHERE configuration_id=c.id ORDER BY version DESC LIMIT 1) v ON true
  WHERE c.session=$1 ORDER BY c.class_key`,[session.trim()]);
  return result.rows;
 }finally{client.release();}
}
