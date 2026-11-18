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
export const stable = (v: unknown): string => {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string,unknown>;
    return "{" + Object.keys(o).sort().map(k => JSON.stringify(k)+":"+stable(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
};
export function mergeRevision(input: unknown) {
  return createHash("sha256").update(stable(input)).digest("hex");
}
export function assessmentRevision(rows: Assessment[]) {
  return mergeRevision([...rows].sort((a,b)=>a.id.localeCompare(b.id)));
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
  for (const [k,group] of Array.from(groups)) {
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

