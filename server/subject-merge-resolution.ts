import { pool } from "./db";
import { createHash } from "crypto";

export interface AssessmentChoice {
  student_id: string;
  class_id: string;
  session: string;
  term: string;
  revision: string;
  retainId: string;
}

type Assessment = { id: string; student_id: string; class_id: string; session: string; term: string; subject_id: string; [key: string]: unknown };
const key = (r: Assessment) => JSON.stringify([r.student_id,r.class_id,r.session,r.term]);
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string,unknown>;
    return "{" + Object.keys(o).sort().map(k => JSON.stringify(k)+":"+stable(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
};
export function assessmentRevision(rows: Assessment[]) {
  return createHash("sha256").update(stable([...rows].sort((a,b)=>a.id.localeCompare(b.id)))).digest("hex");
}

/** Pure validation, called again on locked rows by a future executor.
 * Whole-record selection avoids interpreting zero as missing.
 * Every rejected row must be retained in the durable merge snapshot.
 */
export function validateAssessmentChoices(rows: Assessment[], choices: AssessmentChoice[]) {
  const groups = new Map<string,Assessment[]>();
  for (const row of rows) {
    const k = key(row);
    groups.set(k,[...(groups.get(k) ?? []),row]);
  }
  const selections = new Map<string,AssessmentChoice>();
  for (const choice of choices) {
    const k = JSON.stringify([choice.student_id,choice.class_id,choice.session,choice.term]);
    if (selections.has(k)) throw new Error("Duplicate conflict decision");
    selections.set(k,choice);
  }
  const retain: string[] = [], archive: string[] = [];
  for (const [k,group] of groups) {
    if (group.length===1) {
      retain.push(group[0].id);
      continue;
    }
    const choice = selections.get(k);
    if (!choice || choice.revision!==assessmentRevision(group)) throw new Error("Missing or stale conflict decision");
    if (!group.some(r=>r.id===choice.retainId)) throw new Error("Selected assessment is not in conflict group");
    retain.push(choice.retainId);
    archive.push(...group.filter(r=>r.id!==choice.retainId).map(r=>r.id));
    selections.delete(k);
  }
  if (selections.size) throw new Error("Unexpected conflict decision");
  return {retain,archive};
}

/** Read-only recovery gate for the existing no-overlap merge engine.
 * Even an eligible result is not authorization to restore: a future recovery
 * transaction must repeat all checks under locks and review report dependencies.
 */
export async function checkSubjectMergeRecovery(operationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) throw new Error("Invalid operation ID");
  const client = await pool.connect();
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
    if (!unchanged(r.snapshot.assessments,r.current_assessments,true)) reasons.push("Assessments changed since merge");
    if (!unchanged(r.snapshot.assignments,r.current_assignments,true)) reasons.push("Class assignments changed since merge");
    if (!unchanged(r.snapshot.subjects,r.current_subjects,false)) reasons.push("Subject records changed since merge");
    await client.query("COMMIT");
    return {operationId,eligibleForReview:reasons.length===0,reasons,executionEnabled:false};
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
