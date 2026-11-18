import { assessmentRevision, mergeRevision } from "./subject-merge-decisions";
import { connectSubjectDb, readMergeInputs } from "./subject-db-client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Preview the records and separate conflicting marks from identical records. */
export async function previewSubjectMerge(sourceId: string, targetId: string) {
  if (!uuid.test(sourceId) || !uuid.test(targetId) || sourceId.toLowerCase() === targetId.toLowerCase()) {
    throw new Error("Select two different valid subject IDs");
  }
  const client = await connectSubjectDb();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const params: [string, string] = [sourceId.toLowerCase(), targetId.toLowerCase()];
    const original = await readMergeInputs(client, params);
    const subjects = original.subjects.map(({id,name}) => ({id,name}));
    if (subjects.length !== 2) throw new Error("Subject not found or already merged");
    const counts = await client.query(`
      SELECT a.subject_id, a.session, a.term, c.school_id,
        count(*)::int AS assessment_count, count(DISTINCT a.student_id)::int AS student_count
      FROM assessments a JOIN classes c ON c.id=a.class_id
      WHERE a.subject_id IN ($1::uuid,$2::uuid)
      GROUP BY a.subject_id,a.session,a.term,c.school_id
      ORDER BY a.session,a.term,c.school_id,a.subject_id
    `, params);
    const overlaps = await client.query(`
      SELECT a.student_id,a.class_id,a.session,a.term,s.student_id AS student_number,
        concat_ws(' ', u.first_name,u.middle_name,u.last_name) AS student_name,
        count(*)::int AS record_count,
        count(DISTINCT jsonb_build_array(first_ca,second_ca,exam))::int AS distinct_score_sets,
        jsonb_agg(jsonb_build_object('id',a.id,'subjectId',a.subject_id,
          'firstCA',first_ca,'secondCA',second_ca,'exam',exam) ORDER BY a.id) AS records
      FROM assessments a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id
      WHERE a.subject_id IN ($1::uuid,$2::uuid)
      GROUP BY a.student_id,a.class_id,a.session,a.term,s.student_id,u.first_name,u.middle_name,u.last_name HAVING count(*)>1
      ORDER BY a.session,a.term,a.class_id,a.student_id
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
    const fullRows = original.assessments;
    const revision = mergeRevision(original);
    const reviewedOverlaps=overlaps.rows.map(o=>({...o,distinct_score_sets:o.distinct_score_sets,revision:assessmentRevision(fullRows.filter(a=>a.student_id===o.student_id&&a.class_id===o.class_id&&a.session===o.session&&a.term===o.term))}));
    const blockers:string[]=[];
    if(new Set(subjects.map(s=>s.name.trim().replace(/\s+/g," ").toUpperCase())).size!==1)blockers.push("Only duplicate subject names can be merged.");

    if(overlaps.rows.length && (await client.query("SELECT 1 FROM pg_constraint WHERE contype='f' AND confrelid='assessments'::regclass LIMIT 1")).rows.length)blockers.push("Assessment dependencies prevent conflict archival.");
    await client.query("COMMIT");
    return {
      sourceId,targetId,revision,subjects,counts:counts.rows,
      overlaps:reviewedOverlaps.filter(o=>Number(o.distinct_score_sets)>1),assignments:assignments.rows,dependencies:dependencies.rows,
      requiresAssessmentReview:overlaps.rows.some(o => Number(o.distinct_score_sets)>1),
      requiresAssignmentReview:false,
      executionEnabled:blockers.length===0,blockers,
      warnings:["Historical zero marks cannot be inferred as missing.",
        "The executor revalidates the preview under database locks."]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
