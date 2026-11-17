import { assessmentRevision } from "./subject-merge-resolution";
import { connectSubjectDb } from "./subject-db-client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read-only preview. All overlaps require explicit review; zero is never treated as missing. */
export async function previewSubjectMerge(sourceId: string, targetId: string) {
  if (!uuid.test(sourceId) || !uuid.test(targetId) || sourceId.toLowerCase() === targetId.toLowerCase()) {
    throw new Error("Select two different valid subject IDs");
  }
  const client = await connectSubjectDb();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const params = [sourceId, targetId];
    const subjects = await client.query(`
      SELECT id,name FROM subjects WHERE id IN ($1::uuid,$2::uuid)
    `, params);
    if (subjects.rows.length !== 2) throw new Error("Subject not found");
    const counts = await client.query(`
      SELECT a.subject_id, a.session, a.term, c.school_id,
        count(*)::int AS assessment_count, count(DISTINCT a.student_id)::int AS student_count
      FROM assessments a JOIN classes c ON c.id=a.class_id
      WHERE a.subject_id IN ($1::uuid,$2::uuid)
      GROUP BY a.subject_id,a.session,a.term,c.school_id
      ORDER BY a.session,a.term,c.school_id,a.subject_id
    `, params);
    const overlaps = await client.query(`
      SELECT student_id,class_id,session,term,
        count(*)::int AS record_count,
        count(DISTINCT jsonb_build_array(first_ca,second_ca,exam))::int AS distinct_score_sets,
        jsonb_agg(jsonb_build_object('id',id,'subjectId',subject_id,
          'firstCA',first_ca,'secondCA',second_ca,'exam',exam) ORDER BY id) AS records
      FROM assessments WHERE subject_id IN ($1::uuid,$2::uuid)
      GROUP BY student_id,class_id,session,term HAVING count(*)>1
      ORDER BY session,term,class_id,student_id
    `, params);
    const assignments = await client.query(`
      SELECT cs.class_id,c.name AS class_name,sc.name AS school,
        jsonb_agg(jsonb_build_object('id',cs.id,'subjectId',cs.subject_id,
          'customName',cs.custom_name) ORDER BY cs.id) AS assignments
      FROM class_subjects cs JOIN classes c ON c.id=cs.class_id
      JOIN schools sc ON sc.id=c.school_id
      WHERE cs.subject_id IN ($1::uuid,$2::uuid)
      GROUP BY cs.class_id,c.name,sc.name ORDER BY sc.name,c.name
    `, params);
    const dependencies = await client.query(`
      SELECT conrelid::regclass::text AS linked_table,pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE confrelid='subjects'::regclass AND contype='f'
    `);
    const full=await client.query("SELECT to_jsonb(a) AS row FROM assessments a WHERE subject_id IN ($1::uuid,$2::uuid)",params);
    const fullRows=full.rows.map(r=>r.row);
    const revision=assessmentRevision(fullRows);
    const reviewedOverlaps=overlaps.rows.map(o=>({...o,revision:assessmentRevision(fullRows.filter(a=>a.student_id===o.student_id&&a.class_id===o.class_id&&a.session===o.session&&a.term===o.term))}));
    await client.query("COMMIT");
    return {
      sourceId,targetId,revision,subjects:subjects.rows,counts:counts.rows,
      overlaps:reviewedOverlaps,assignments:assignments.rows,dependencies:dependencies.rows,
      requiresAssessmentReview:overlaps.rows.length>0,
      requiresAssignmentReview:assignments.rows.some(row => row.assignments.length>1),
      executionEnabled:false,
      warnings:["Historical zero marks cannot be inferred as missing.",
        "Published report impact and live dependencies must be verified before execution.",
        "Preview is informational; a future executor must revalidate under locks."]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
