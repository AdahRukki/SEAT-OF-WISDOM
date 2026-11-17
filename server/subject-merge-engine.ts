import { pool } from "./db";
import { randomUUID } from "crypto";
import { validateAssessmentChoices, assessmentRevision, type AssessmentChoice } from "./subject-merge-resolution";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Internal engine only. Do not expose until authorization, published-result
 * preservation, preview revision checks and integration tests are implemented.
 * Refuses all overlapping assessments and custom-name conflicts.
 */
export async function executeSubjectMerge(sourceId: string, targetId: string, actorId: string, choices: AssessmentChoice[] = [], expectedRevision?: string) {
  if (!uuid.test(sourceId) || !uuid.test(targetId) || sourceId.toLowerCase() === targetId.toLowerCase() || !actorId.trim()) {
    throw new Error("Invalid merge request");
  }
  const client = await pool.connect();
  const operationId = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("LOCK TABLE subjects, class_subjects, assessments, published_scores, generated_report_cards IN SHARE ROW EXCLUSIVE MODE");
    const p = [sourceId, targetId];
    const selected = await client.query("SELECT * FROM subjects WHERE id IN ($1::uuid,$2::uuid)", p);
    if (selected.rows.length !== 2) throw new Error("Subject not found or already merged");
    if(new Set(selected.rows.map(s=>s.name.trim().replace(/\s+/g," ").toUpperCase())).size!==1)throw new Error("Only exact-name duplicates may be merged");
    const ready=await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AND to_regclass('active_subjects') IS NOT NULL AS ready");
    if(!ready.rows[0].ready)throw new Error("Archive migration required");
    const history=await client.query(`WITH affected AS (SELECT class_id FROM class_subjects WHERE subject_id IN ($1::uuid,$2::uuid) UNION SELECT class_id FROM assessments WHERE subject_id IN ($1::uuid,$2::uuid)) SELECT 1 FROM affected c WHERE EXISTS(SELECT 1 FROM published_scores p WHERE p.class_id=c.class_id) OR EXISTS(SELECT 1 FROM generated_report_cards r WHERE r.class_id=c.class_id) LIMIT 1`,p);
    if(history.rows.length)throw new Error("Class result history requires review");
    const deps = await client.query(`
      SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE confrelid='subjects'::regclass AND contype='f'
    `);
    if (deps.rows.some(row => !["class_subjects","assessments","master_subject_configuration_items"].includes(row.table_name)
      || !/^FOREIGN KEY \\(subject_id\\) REFERENCES subjects\\(id\\)/.test(row.definition))) {
      throw new Error("Unverified subject dependency; merge blocked");
    }
    if((await client.query("SELECT to_regclass('master_subject_configuration_items') IS NOT NULL AS present")).rows[0].present && (await client.query("SELECT 1 FROM master_subject_configuration_items WHERE subject_id=$1 LIMIT 1",[sourceId])).rows.length)throw new Error("Source is referenced by a saved configuration");
    const original = await client.query(
      "SELECT to_jsonb(a) AS row FROM assessments a WHERE subject_id IN ($1::uuid,$2::uuid)",p);
    const rows = original.rows.map(r=>r.row);
    if (!expectedRevision || expectedRevision !== assessmentRevision(rows)) throw new Error("Missing or stale assessment preview");
    if(rows.length && process.env.ENABLE_UNPUBLISHED_SCORE_MERGES!=="true")throw new Error("Unpublished score merges disabled pending verification");
    const decisions = validateAssessmentChoices(rows,choices);
    // Do not remove active assessment records until all inbound references and
    // published report preservation have been verified.
    if (decisions.archive.length) throw new Error("Conflict decisions validated; archival execution not yet enabled");
    const assignments = await client.query(`
      SELECT class_id FROM class_subjects WHERE subject_id IN ($1::uuid,$2::uuid)
      GROUP BY class_id HAVING count(*)>1 LIMIT 1
    `, p);
    const duplicateAssignments=await client.query(`SELECT s.id FROM class_subjects s JOIN class_subjects t ON s.class_id=t.class_id AND t.subject_id=$2::uuid WHERE s.subject_id=$1::uuid AND s.custom_name IS NOT DISTINCT FROM t.custom_name AND (SELECT count(*) FROM class_subjects x WHERE x.class_id=s.class_id AND x.subject_id IN ($1::uuid,$2::uuid))=2`,p);
    const overlapCount=await client.query(`SELECT count(*)::int AS n FROM (SELECT class_id FROM class_subjects WHERE subject_id IN ($1::uuid,$2::uuid) GROUP BY class_id HAVING count(*)>1) x`,p);
    if(Number(overlapCount.rows[0].n)!==duplicateAssignments.rows.length)throw new Error("Overlapping class assignments require explicit resolution");
    if(duplicateAssignments.rows.length){
      if(process.env.ENABLE_SUBJECT_ASSIGNMENT_DEDUP!=="true")throw new Error("Assignment consolidation disabled pending verification");
      const inbound=await client.query("SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='class_subjects'::regclass LIMIT 1");
      if(inbound.rows.length)throw new Error("Class assignment dependencies require review");
    }
    // The audit table is created transactionally; original rows are retained in full.
    await client.query(`
      CREATE TABLE IF NOT EXISTS subject_merge_snapshots (
        operation_id uuid PRIMARY KEY, actor_id text NOT NULL,
        source_id uuid NOT NULL UNIQUE, target_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL
      )
    `);
    const prior = await client.query("SELECT 1 FROM subject_merge_snapshots WHERE source_id IN ($1::uuid,$2::uuid)", p);
    if (prior.rows.length) throw new Error("Previously merged subject cannot be reused");
    await client.query(`
      INSERT INTO subject_merge_snapshots(operation_id,actor_id,source_id,target_id,snapshot)
      SELECT $3::uuid,$4,$1::uuid,$2::uuid,jsonb_build_object(
        'subjects',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM subjects s WHERE id IN ($1::uuid,$2::uuid)),
        'assessments',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM assessments a WHERE subject_id IN ($1::uuid,$2::uuid)),
        'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM class_subjects c WHERE subject_id IN ($1::uuid,$2::uuid)))
    `, [sourceId,targetId,operationId,actorId]);
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
      WHERE a.id IS NULL OR a.subject_id<>$2::uuid
        OR (to_jsonb(a)-'subject_id') IS DISTINCT FROM (o.row-'subject_id')
    `, [operationId,targetId]);
    if (Number(verification.rows[0].mismatches)!==0) throw new Error("Assessment verification failed");
    const remaining = await client.query(`
      SELECT (SELECT count(*) FROM assessments WHERE subject_id=$1::uuid)
        +(SELECT count(*) FROM class_subjects WHERE subject_id=$1::uuid) AS remaining
    `, [sourceId]);
    if (Number(remaining.rows[0].remaining)!==0) throw new Error("Source references remain");
    // Do not delete source. UI and write-path archive enforcement are separate work.
    await client.query("COMMIT");
    return { operationId, assessmentsMoved:a.rowCount, assignmentsMoved:c.rowCount,assignmentsConsolidated:duplicateAssignments.rows.length, sourceRetained:true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
