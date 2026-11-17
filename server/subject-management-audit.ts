import { pool } from "./db";

/** Read-only audit. No mutation or automatic score reconciliation. */
export async function auditSubjectManagement() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const archived=(await client.query("SELECT to_regclass('subject_merge_snapshots') IS NOT NULL AS present")).rows[0].present;
    const activeFilter=archived?"WHERE NOT EXISTS (SELECT 1 FROM subject_merge_snapshots m WHERE m.source_id=s.id)":"";
    const subjects = await client.query(`
      SELECT s.id, s.name,
        (SELECT count(*)::int FROM class_subjects cs WHERE cs.subject_id=s.id) AS assignments,
        (SELECT count(*)::int FROM assessments a WHERE a.subject_id=s.id) AS assessments
      FROM subjects s ${activeFilter} ORDER BY upper(trim(s.name)), s.id
    `);
    const duplicates = await client.query(`
      SELECT upper(trim(name)) AS normalized_name,
        array_agg(id ORDER BY id) AS subject_ids,
        array_agg(name ORDER BY id) AS names
      FROM subjects s ${activeFilter} GROUP BY upper(trim(name)) HAVING count(*) > 1
      ORDER BY normalized_name
    `);
    const classes = await client.query(`
      SELECT c.id, c.name, sc.id AS school_id, sc.name AS school,
        count(DISTINCT cs.subject_id)::int AS subject_count,
        coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',s.id,'name',s.name))
          FILTER (WHERE s.id IS NOT NULL),'[]'::jsonb) AS subjects
      FROM classes c JOIN schools sc ON sc.id=c.school_id
      LEFT JOIN class_subjects cs ON cs.class_id=c.id
      LEFT JOIN subjects s ON s.id=cs.subject_id
      GROUP BY c.id,c.name,sc.id,sc.name ORDER BY sc.name,c.name
    `);
    const dependencies = await client.query(`
      SELECT conrelid::regclass::text AS linked_table, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE confrelid='subjects'::regclass AND contype='f'
      ORDER BY linked_table
    `);
    const duplicateAssignments = await client.query(`
      SELECT class_id, subject_id, count(*)::int AS records
      FROM class_subjects GROUP BY class_id,subject_id HAVING count(*)>1
    `);
    const overlappingAssessments = await client.query(`
      SELECT upper(trim(s.name)) AS normalized_name, count(*)::int AS affected_groups
      FROM (
        SELECT a.student_id,a.class_id,a.term,a.session,upper(trim(s.name)) AS name,
          count(*) AS records
        FROM assessments a JOIN subjects s ON s.id=a.subject_id
        GROUP BY a.student_id,a.class_id,a.term,a.session,upper(trim(s.name))
        HAVING count(*)>1
      ) overlaps JOIN (SELECT DISTINCT upper(trim(name)) AS name FROM subjects) s
      ON s.name=overlaps.name GROUP BY upper(trim(s.name))
    `);
    await client.query("COMMIT");
    return { subjects: subjects.rows, duplicates: duplicates.rows, classes: classes.rows,
      dependencies: dependencies.rows, duplicateAssignments: duplicateAssignments.rows,
      overlappingAssessments: overlappingAssessments.rows };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
