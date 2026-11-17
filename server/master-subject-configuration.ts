import { pool } from "./db";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalize = (name:string) => name.trim().replace(/\s+/g," ").toUpperCase();

/** Proposed master lists are explicitly selected by the admin. No writes. */
export async function previewMasterClassConfiguration(referenceSchoolId:string, referenceClassId:string, selectedSubjectIds:string[]) {
  if (!referenceSchoolId.trim() || !referenceClassId.trim() || !selectedSubjectIds.length ||
      selectedSubjectIds.some(id=>!uuid.test(id))) throw new Error("Invalid class configuration");
  const ids=Array.from(new Set(selectedSubjectIds.map(id=>id.toLowerCase())));
  const client=await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const classes=await client.query(`SELECT c.id,c.name,c.school_id,sc.name AS school
      FROM classes c JOIN schools sc ON sc.id=c.school_id ORDER BY sc.name,c.name`);
    const reference=classes.rows.find(c=>c.id===referenceClassId && c.school_id===referenceSchoolId);
    if (!reference) throw new Error("Reference class not found in selected school");
    const matched=classes.rows.filter(c=>normalize(c.name)===normalize(reference.name));
    const subjects=await client.query("SELECT id,name FROM subjects ORDER BY name");
    const chosen=subjects.rows.filter(s=>ids.includes(s.id));
    if (chosen.length!==ids.length) throw new Error("Unknown subject selected");
    const duplicateNames=chosen.filter((s,i)=>chosen.some((t,j)=>j!==i && normalize(s.name)===normalize(t.name)));
    if (duplicateNames.length) throw new Error("Resolve duplicate master subject names first");
    const archiveTable=await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AS exists");
    if (archiveTable.rows[0].exists) {
      const archived=await client.query("SELECT source_id FROM subject_merge_snapshots");
      if (archived.rows.some(r=>ids.includes(r.source_id))) throw new Error("Archived subject selected");
    }
    const assignments=await client.query(`SELECT cs.class_id,cs.subject_id,cs.custom_name,s.name
      FROM class_subjects cs JOIN subjects s ON s.id=cs.subject_id`);
    const schoolCounts=new Map<string,number>();
    for (const c of matched) schoolCounts.set(c.school_id,(schoolCounts.get(c.school_id)??0)+1);
    const changes=matched.map(c=>{
      const existing=assignments.rows.filter(a=>a.class_id===c.id);
      const missing=chosen.filter(s=>!existing.some(a=>a.subject_id===s.id));
      const conflicts=missing.filter(s=>existing.some(a=>normalize(a.name)===normalize(s.name)|| (a.custom_name && normalize(a.custom_name)===normalize(s.name))));
      return {classId:c.id,className:c.name,schoolId:c.school_id,school:c.school,
        ambiguousClassMatch:(schoolCounts.get(c.school_id)??0)>1,
        add:missing.filter(s=>!conflicts.some(x=>x.id===s.id)),
        conflicts,retainExisting:existing.filter(a=>!ids.includes(a.subject_id)),
        alreadyAssigned:chosen.filter(s=>existing.some(a=>a.subject_id===s.id))};
    });
    const unmatchedSchools=Array.from(new Map(classes.rows.map(c=>[c.school_id,c.school])).entries())
      .filter(([id])=>!schoolCounts.has(id)).map(([schoolId,school])=>({schoolId,school}));
    await client.query("COMMIT");
    return {reference,masterSubjects:chosen,changes,unmatchedSchools,mode:"add-only",executionEnabled:false,
      warnings:["Class names are matched exactly after case and whitespace normalization.",
        "Existing assignments and assessments are never removed by this preview.",
        "Resolve ambiguous class matches and subject-name conflicts before synchronisation."]};
  } catch(e) {await client.query("ROLLBACK");throw e;} finally {client.release();}
}
