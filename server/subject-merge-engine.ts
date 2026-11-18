import { connectSubjectDb, preserveSubjectReports, logSubjectActivity, readMergeInputs } from "./subject-db-client";

import { randomUUID } from "crypto";
import { validateAssessmentChoices, assessmentRevision, mergeRevision, type AssessmentChoice } from "./subject-merge-decisions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function executeSubjectMerge(sourceId: string, targetId: string, actorId: string, choices: AssessmentChoice[] = [], expectedRevision?: string) {
  if (!uuid.test(sourceId) || !uuid.test(targetId) || sourceId.toLowerCase() === targetId.toLowerCase() || !actorId.trim()) {
    throw new Error("Invalid merge request");
  }
  sourceId = sourceId.toLowerCase();
  targetId = targetId.toLowerCase();
  const client = await connectSubjectDb();
  const operationId = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("LOCK TABLE subjects, class_subjects, assessments, published_scores, generated_report_cards, academic_sessions, academic_terms, subject_merge_snapshots IN SHARE ROW EXCLUSIVE MODE");
    const p: [string, string] = [sourceId, targetId];
    const original = await readMergeInputs(client, p);
    if (original.subjects.length !== 2) throw new Error("Subject not found or already merged");
    if (new Set(original.subjects.map(s => s.name.trim().replace(/\s+/g," ").toUpperCase())).size !== 1) {
      throw new Error("Only exact-name duplicates may be merged");
    }
    const unknownDependency = await client.query(`
      SELECT 1 FROM pg_constraint fk
      LEFT JOIN pg_attribute source_column ON source_column.attrelid=fk.conrelid
        AND ARRAY[source_column.attnum]=fk.conkey
      LEFT JOIN pg_attribute target_column ON target_column.attrelid=fk.confrelid
        AND ARRAY[target_column.attnum]=fk.confkey
      WHERE fk.confrelid='subjects'::regclass AND fk.contype='f'
      AND (fk.conrelid NOT IN ('class_subjects'::regclass,'assessments'::regclass,
        'master_subject_configuration_items'::regclass)
        OR source_column.attname IS DISTINCT FROM 'subject_id'
        OR target_column.attname IS DISTINCT FROM 'id')
      LIMIT 1
    `);
    if (unknownDependency.rows.length) throw new Error("Unverified subject dependency; merge blocked");
    const rows = original.assessments;
    if (expectedRevision !== mergeRevision(original)) throw new Error("Missing or stale merge preview");

    const groups=new Map<string,typeof rows>();
    for(const row of rows){const k=JSON.stringify([row.student_id,row.class_id,row.session,row.term]);groups.set(k,[...(groups.get(k)||[]),row]);}
    const resolved=[...choices];
    for(const group of Array.from(groups.values())){
      if(group.length<2)continue;
      const g=group[0];
      if(resolved.some(c=>c.student_id===g.student_id&&c.class_id===g.class_id&&c.session===g.session&&c.term===g.term))continue;
      if(new Set(group.map(r=>JSON.stringify([r.first_ca,r.second_ca,r.exam]))).size===1){
        const keep=group.find(r=>r.subject_id===targetId)||g;
        resolved.push({student_id:g.student_id,class_id:g.class_id,session:g.session,term:g.term,revision:assessmentRevision(group),retainId:keep.id});
      }
    }
    const decisions = validateAssessmentChoices(rows,resolved);
    // Do not remove active assessment records until all inbound references and
    // published report preservation have been verified.
    if(decisions.archive.length){
      const inbound=await client.query("SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='assessments'::regclass LIMIT 1");
      if(inbound.rows.length)throw new Error("Assessment dependencies prevent conflict archival");
    }
    const duplicateAssignments = await client.query(`
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY class_id ORDER BY (subject_id=$2::uuid) DESC,
          (custom_name IS NOT NULL) DESC, id
        ) AS position
        FROM class_subjects WHERE subject_id IN ($1::uuid,$2::uuid)
      ) ranked WHERE position>1
    `, p);
    if(duplicateAssignments.rows.length){
      const inbound=await client.query("SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='class_subjects'::regclass LIMIT 1");
      if(inbound.rows.length)throw new Error("Class assignment dependencies require review");
    }
    const affected = await client.query(`
      SELECT class_id FROM class_subjects WHERE subject_id IN ($1,$2)
      UNION SELECT class_id FROM assessments WHERE subject_id IN ($1,$2)
    `, p);
    await preserveSubjectReports(client, affected.rows.map(row => row.class_id));
    await client.query(`
      INSERT INTO subject_merge_snapshots(operation_id,actor_id,source_id,target_id,created_at,snapshot)
      SELECT $3::uuid,$4,$1::uuid,$2::uuid,clock_timestamp(),jsonb_build_object(
        'subjects',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM subjects s WHERE id IN ($1::uuid,$2::uuid)),
        'assessments',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM assessments a WHERE subject_id IN ($1::uuid,$2::uuid)),
        'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM class_subjects c WHERE subject_id IN ($1::uuid,$2::uuid)))
    `, [sourceId,targetId,operationId,actorId]);
    if(decisions.archive.length)await client.query("DELETE FROM assessments WHERE id=ANY($1::uuid[])",[decisions.archive]);
    const a = await client.query("UPDATE assessments SET subject_id=$2::uuid WHERE subject_id=$1::uuid",p);
    if(duplicateAssignments.rows.length)await client.query("DELETE FROM class_subjects WHERE id=ANY($1::uuid[])",[duplicateAssignments.rows.map(r=>r.id)]);
    const c = await client.query("UPDATE class_subjects SET subject_id=$2::uuid WHERE subject_id=$1::uuid",p);
    const verification = await client.query(`
      WITH original AS (
        SELECT jsonb_array_elements(snapshot->'assessments') AS row
        FROM subject_merge_snapshots WHERE operation_id=$1::uuid
      )
      SELECT count(*)::int AS mismatches FROM original o
      LEFT JOIN assessments a ON a.id=(o.row->>'id')::uuid
      WHERE NOT ((o.row->>'id')::uuid=ANY($3::uuid[])) AND (a.id IS NULL OR a.subject_id<>$2::uuid
        OR (to_jsonb(a)-'subject_id') IS DISTINCT FROM (o.row-'subject_id'))
    `, [operationId,targetId,decisions.archive]);
    if (Number(verification.rows[0].mismatches)!==0) throw new Error("Assessment verification failed");
    const assignmentsValid = await client.query(`
      WITH expected AS (
        SELECT item || jsonb_build_object('subject_id',$2::uuid) AS row
        FROM jsonb_array_elements($3::jsonb) item
        WHERE NOT ((item->>'id')::uuid=ANY($4::uuid[]))
      ), actual AS (
        SELECT to_jsonb(c) AS row FROM class_subjects c WHERE subject_id IN ($1,$2)
      )
      SELECT NOT EXISTS (
        (SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
        UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)
      ) AND NOT EXISTS (SELECT 1 FROM assessments WHERE subject_id=$1) AS valid
    `, [sourceId,targetId,JSON.stringify(original.assignments),duplicateAssignments.rows.map(r=>r.id)]);
    if (!assignmentsValid.rows[0].valid) throw new Error("Class assignment verification failed");
    await client.query("UPDATE subject_merge_snapshots SET snapshot=snapshot || jsonb_build_object('archivedAssessmentIds',$2::jsonb,'consolidatedAssignmentIds',$3::jsonb) WHERE operation_id=$1::uuid",[operationId,JSON.stringify(decisions.archive),JSON.stringify(duplicateAssignments.rows.map(r=>r.id))]);
    const result = { operationId, assessmentsMoved:a.rowCount, assignmentsMoved:c.rowCount,assignmentsConsolidated:duplicateAssignments.rows.length, assessmentsArchived:decisions.archive.length,sourceRetained:true };
    await logSubjectActivity(client, actorId, "merge_subjects", operationId, {
      sourceId, targetId,
      sourceName: original.subjects.find(subject => subject.id === sourceId)?.name,
      targetName: original.subjects.find(subject => subject.id === targetId)?.name,
      ...result,
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
