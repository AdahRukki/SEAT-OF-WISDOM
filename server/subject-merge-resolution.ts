import { connectSubjectDb } from "./subject-db-client";
import { stable } from "./subject-merge-decisions";
export { assessmentRevision, validateAssessmentChoices, type AssessmentChoice } from "./subject-merge-decisions";
/** Read-only recovery gate for the existing no-overlap merge engine.
 * Even an eligible result is not authorization to restore: a future recovery
 * transaction must repeat all checks under locks and review report dependencies.
 */
export async function checkSubjectMergeRecovery(operationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) throw new Error("Invalid operation ID");
  const client = await connectSubjectDb();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await client.query(`
      SELECT operation_id,source_id,target_id,created_at,
      (SELECT count(*) FROM subject_merge_snapshots later
       WHERE later.operation_id<>m.operation_id AND later.created_at>=m.created_at
       AND (later.source_id IN (m.source_id,m.target_id)
         OR later.target_id IN (m.source_id,m.target_id)))::int AS later_merges,
      (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb)
       FROM assessments a WHERE a.subject_id IN (m.source_id,m.target_id)) AS current_assessments,
      (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb)
       FROM class_subjects c WHERE c.subject_id IN (m.source_id,m.target_id)) AS current_assignments,
      (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)
       FROM subjects s WHERE s.id IN (m.source_id,m.target_id)) AS current_subjects,
      snapshot FROM subject_merge_snapshots m WHERE operation_id=$1::uuid
    `,[operationId]);
    if (!result.rows.length) throw new Error("Merge operation not found");
    const r = result.rows[0];
    const unchanged = (original: any[], current: any[], remap: boolean) =>
      stable(original.map(o=>remap?{...o,subject_id:r.target_id}:o).sort((a,b)=>a.id.localeCompare(b.id))) ===
      stable([...current].sort((a,b)=>a.id.localeCompare(b.id)));
    const reasons: string[] = [];
    if (r.later_merges) reasons.push("A subsequent merge affects these subjects");
    if (!unchanged(r.snapshot.assessments.filter((v:any)=>!(r.snapshot.archivedAssessmentIds??[]).includes(v.id)),r.current_assessments,true)) reasons.push("Assessments changed since merge");
    if (!unchanged(r.snapshot.assignments.filter((v:any)=>!(r.snapshot.consolidatedAssignmentIds??[]).includes(v.id)),r.current_assignments,true)) reasons.push("Class assignments changed since merge");
    if (!unchanged(r.snapshot.subjects,r.current_subjects,false)) reasons.push("Subject records changed since merge");
    await client.query("COMMIT");
    return {operationId,eligibleForReview:reasons.length===0,reasons,executionEnabled:false};
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
