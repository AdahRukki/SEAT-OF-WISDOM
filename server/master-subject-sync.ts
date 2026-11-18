import { connectSubjectDb, preserveSubjectReports, logSubjectActivity } from "./subject-db-client";
import { createHash } from "crypto";
const norm=(s:string)=>s.trim().replace(/\s+/g," ").toUpperCase();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function synchroniseMasterSubjects(input:{versionId:string;actorId:string;requestKey:string;expectedRevision?:string;apply:boolean}) {
 if(!uuid.test(input.versionId)||!uuid.test(input.requestKey)||!input.actorId)throw new Error("Invalid sync request");
 const client=await connectSubjectDb();
 try {
  await client.query(input.apply?"BEGIN":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL lock_timeout = '5s'");
  if(input.apply){
   await client.query("LOCK TABLE subjects, classes, class_subjects, assessments, schools, academic_sessions, academic_terms, published_scores, generated_report_cards, class_subject_period_snapshots IN SHARE ROW EXCLUSIVE MODE");
   await client.query("LOCK TABLE master_subject_configurations, master_subject_configuration_versions, master_subject_configuration_items, master_subject_sync_operations IN SHARE ROW EXCLUSIVE MODE");
   const previous=(await client.query("SELECT * FROM master_subject_sync_operations WHERE request_key=$1",[input.requestKey])).rows[0];
   if(previous){
    if(previous.version_id!==input.versionId||previous.actor_id!==input.actorId||previous.preview_revision!==input.expectedRevision)throw new Error("Request key reused");
    await client.query("COMMIT");return previous.result;
   }
  }
  const version=(await client.query(`SELECT v.*,c.class_key,c.session FROM master_subject_configuration_versions v JOIN master_subject_configurations c ON c.id=v.configuration_id WHERE v.id=$1 AND v.version=(SELECT MAX(x.version) FROM master_subject_configuration_versions x WHERE x.configuration_id=c.id)`,[input.versionId])).rows[0];
  if(!version)throw new Error("Configuration not found or superseded");
  const subjects=(await client.query(`SELECT DISTINCT s.id,s.name
    FROM master_subject_configuration_items i
    JOIN canonical_subject_ids c ON c.original_id=i.subject_id
    JOIN subjects s ON s.id=c.subject_id WHERE i.version_id=$1 ORDER BY s.id`,[input.versionId])).rows;
  if(!subjects.length||new Set(subjects.map(s=>norm(s.name))).size!==subjects.length)throw new Error("Subject list changed; save a new configuration");
  const classes=(await client.query("SELECT c.id,c.name,c.school_id,s.name AS school FROM classes c JOIN schools s ON s.id=c.school_id ORDER BY c.id")).rows.filter(c=>norm(c.name)===version.class_key);
  if(!classes.length||new Set(classes.map(c=>c.school_id)).size!==classes.length)throw new Error("Missing or ambiguous class matches");
  const allSchools=(await client.query("SELECT id,name FROM schools ORDER BY id")).rows;
  const unmatched=allSchools.filter(s=>!classes.some(c=>c.school_id===s.id));
  const existing=(await client.query(`SELECT cs.id,cs.class_id,cs.subject_id,cs.custom_name,s.name FROM class_subjects cs JOIN subjects s ON s.id=cs.subject_id WHERE cs.class_id=ANY($1::varchar[]) ORDER BY cs.id`,[classes.map(c=>c.id)])).rows;
  const changes=classes.map(c=>{
   const rows=existing.filter(r=>r.class_id===c.id);
   const missing=subjects.filter(s=>!rows.some(r=>r.subject_id===s.id));
   const conflicts=missing.filter(s=>rows.some(r=>norm(r.name)===norm(s.name)||(r.custom_name&&norm(r.custom_name)===norm(s.name))));
   return {classId:c.id,school:c.school,add:missing.filter(s=>!conflicts.some(x=>x.id===s.id)),conflicts};
  });
  const active=(await client.query("SELECT s.session_year,t.term_name FROM academic_sessions s JOIN academic_terms t ON t.session_id=s.id WHERE s.is_active=true AND t.is_active=true ORDER BY s.id,t.id")).rows;
  const affected=changes.filter(c=>c.add.length>0).map(c=>c.classId);
  const protectedPeriods=(await client.query(`SELECT class_id,session,term FROM assessments WHERE class_id=ANY($1::varchar[]) UNION SELECT class_id,session,term FROM published_scores WHERE class_id=ANY($1::varchar[]) UNION SELECT class_id,session,term FROM generated_report_cards WHERE class_id=ANY($1::varchar[]) ORDER BY class_id,session,term`,[affected])).rows;
  const historyBlocked=false;
  const sessionBlocked=active.length!==1||active[0].session_year!==version.session;
  const revision=createHash("sha256").update(JSON.stringify({version,subjects,classes,existing,unmatched,active,protectedPeriods})).digest("hex");
  const blocked=historyBlocked||sessionBlocked||unmatched.length>0||changes.some(c=>c.conflicts.length>0);
  const result={versionId:input.versionId,session:version.session,revision,changes,unmatched,blocked,historyBlocked,sessionBlocked,protectedPeriods,active,applied:input.apply};
  if(input.apply){
   if(blocked||revision!==input.expectedRevision)throw new Error("Sync blocked or preview changed; review again");
   await preserveSubjectReports(client, affected);
   for(const change of changes)for(const subject of change.add){
    await client.query("INSERT INTO class_subjects(class_id,subject_id) VALUES($1,$2)",[change.classId,subject.id]);
   }
   const op = await client.query("INSERT INTO master_subject_sync_operations(version_id,actor_id,request_key,preview_revision,result) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id",[input.versionId,input.actorId,input.requestKey,revision,JSON.stringify(result)]);
   await logSubjectActivity(client, input.actorId, "sync_master_subjects", op.rows[0].id, result);
  }
  await client.query("COMMIT");return result;
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
