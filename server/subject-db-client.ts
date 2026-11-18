import { pool } from "./db";

type SubjectQueryResult = { rows: Record<string, any>[]; rowCount: number | null };
type SubjectDbClient = {
 query(sql: string, values?: unknown[]): Promise<SubjectQueryResult>;
 release(): void;
};

// Both configured drivers implement the promise-based text query API.
// Narrow only this boundary, not the application's global pool type.
export async function connectSubjectDb(): Promise<SubjectDbClient> {
 const client = await pool.connect();
 const query = client.query.bind(client) as unknown as SubjectDbClient["query"];
 return { query, release: () => client.release() };
}

// Freeze the inputs used to render existing reports before changing class or
// assessment data. Later operations leave the earliest report copy intact.
export async function preserveSubjectReports(client: SubjectDbClient, classIds: string[]) {
  await client.query(`
    WITH active AS (
      SELECT s.session_year AS session,t.term_name AS term
      FROM academic_sessions s JOIN academic_terms t ON t.session_id=s.id
      WHERE s.is_active AND t.is_active
    ), periods AS (
      SELECT class_id,session,term FROM published_scores WHERE class_id=ANY($1::varchar[])
      UNION SELECT class_id,session,term FROM generated_report_cards WHERE class_id=ANY($1::varchar[])
      UNION SELECT a.class_id,a.session,a.term FROM assessments a
        JOIN classes c ON c.id=a.class_id LEFT JOIN schools school ON school.id=c.school_id
        WHERE a.class_id=ANY($1::varchar[])
        AND NOT COALESCE((a.session,a.term)=(school.current_session,school.current_term),
          EXISTS (SELECT 1 FROM active t WHERE t.session=a.session AND t.term=a.term))
    )
    INSERT INTO subject_report_snapshots(class_id,session,term,subjects,scores)
    SELECT p.class_id,p.session,p.term,
      COALESCE((SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('custom_name',cs.custom_name) ORDER BY cs.id)
        FROM class_subjects cs JOIN subjects s ON s.id=cs.subject_id WHERE cs.class_id=p.class_id),'[]'),
      COALESCE((SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('subject',to_jsonb(s)) ORDER BY a.id)
        FROM assessments a JOIN subjects s ON s.id=a.subject_id
        WHERE (a.class_id,a.session,a.term)=(p.class_id,p.session,p.term)),'[]')
    FROM periods p ON CONFLICT DO NOTHING
  `, [classIds]);
}

export async function logSubjectActivity(
  client: SubjectDbClient, actorId: string, action: string, operationId: string, details: unknown,
) {
  await client.query(`
    INSERT INTO payment_audit_logs(action,entity_type,entity_id,user_id,actor_role,actor_name,new_data)
    SELECT $2,'subject_management',$3,u.id,u.role,
      concat_ws(' ',u.first_name,u.middle_name,u.last_name),$4::jsonb
    FROM users u WHERE u.id=$1::uuid
  `, [actorId,action,operationId,JSON.stringify(details)]);
}

export async function readMergeInputs(client: SubjectDbClient, ids: [string, string]) {
  const {rows: [input]} = await client.query(`
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id)
        FROM active_subjects s WHERE s.id IN ($1,$2)), '[]') AS subjects,
      COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
        FROM assessments a WHERE a.subject_id IN ($1,$2)), '[]') AS assessments,
      COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id)
        FROM class_subjects c WHERE c.subject_id IN ($1,$2)), '[]') AS assignments
  `, ids);
  return input as {subjects: {id:string; name:string}[]; assessments: any[]; assignments: any[]};
}
