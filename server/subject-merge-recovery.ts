import { connectSubjectDb } from "./subject-db-client";

/** Internal only. Requires staging tests, authorization and report-impact approval before exposure. */
export async function recoverSubjectMerge(operationId: string, actorId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId) || !actorId.trim()) throw new Error("Invalid recovery request");
  const client = await connectSubjectDb();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("LOCK TABLE subjects, class_subjects, assessments, subject_merge_snapshots IN SHARE ROW EXCLUSIVE MODE");
    const found = await client.query("SELECT * FROM subject_merge_snapshots WHERE operation_id=$1::uuid",[operationId]);
    if (found.rows.length !== 1) throw new Error("Active merge not found");
    const m = found.rows[0];
    const later = await client.query(`SELECT 1 FROM subject_merge_snapshots
      WHERE operation_id<>$1::uuid AND created_at >= $4::timestamptz
      AND (source_id IN ($2::uuid,$3::uuid) OR target_id IN ($2::uuid,$3::uuid)) LIMIT 1`,
      [operationId,m.source_id,m.target_id,m.created_at]);
    if (later.rows.length) throw new Error("Subsequent merge prevents recovery");
    // Static allowlist; never use user input as a table identifier.
    for (const table of ["assessments","class_subjects","subjects"] as const) {
      const field = table==="class_subjects"?"assignments":table;
      const selector = table==="subjects"?"id":"subject_id";
      const expected = table==="subjects"?"v":"v || jsonb_build_object('subject_id',$2::uuid)";
      const removed=table==="assessments"?m.snapshot.archivedAssessmentIds??[]:table==="class_subjects"?m.snapshot.consolidatedAssignmentIds??[]:[];
      const check = await client.query(`
        WITH expected AS (SELECT ${expected} AS row FROM jsonb_array_elements($3::jsonb) v),
        actual AS (SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${selector} IN ($1::uuid,$2::uuid))
        SELECT EXISTS ((SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
          UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)) AS mismatch
      `,[m.source_id,m.target_id,JSON.stringify(m.snapshot[field].filter((v:any)=>!removed.includes(v.id)))]);
      if (check.rows[0].mismatch) throw new Error(table+" changed since merge; recovery blocked");
    }
    await client.query(`CREATE TABLE IF NOT EXISTS subject_merge_recoveries (
      operation_id uuid PRIMARY KEY, actor_id text NOT NULL,
      recovered_at timestamptz NOT NULL DEFAULT now(), merge_record jsonb NOT NULL)`);
    await client.query(`INSERT INTO subject_merge_recoveries(operation_id,actor_id,merge_record)
      SELECT operation_id,$2,to_jsonb(m) FROM subject_merge_snapshots m WHERE operation_id=$1::uuid`,[operationId,actorId]);
    // Remove active archive marker only after retaining the entire merge record.
    // The transaction and table locks prevent external writes during restoration.
    await client.query("DELETE FROM subject_merge_snapshots WHERE operation_id=$1::uuid",[operationId]);
    for (const table of ["assessments","class_subjects"] as const) {
      const field = table==="class_subjects"?"assignments":"assessments";
      await client.query(`UPDATE ${table} t SET subject_id=(v->>'subject_id')::uuid
        FROM jsonb_array_elements($1::jsonb) v
        WHERE t.id=(v->>'id')::uuid AND t.subject_id IS DISTINCT FROM (v->>'subject_id')::uuid`,
        [JSON.stringify(m.snapshot[field])]);
      const removed=table==="assessments"?m.snapshot.archivedAssessmentIds??[]:m.snapshot.consolidatedAssignmentIds??[];
      if(removed.length)await client.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,[JSON.stringify(m.snapshot[field].filter((v:any)=>removed.includes(v.id)))]);
      const verified = await client.query(`WITH expected AS (SELECT v AS row FROM jsonb_array_elements($3::jsonb) v),
        actual AS (SELECT to_jsonb(t) AS row FROM ${table} t WHERE subject_id IN ($1::uuid,$2::uuid))
        SELECT EXISTS ((SELECT row FROM expected EXCEPT ALL SELECT row FROM actual)
          UNION ALL (SELECT row FROM actual EXCEPT ALL SELECT row FROM expected)) AS mismatch`,
        [m.source_id,m.target_id,JSON.stringify(m.snapshot[field])]);
      if (verified.rows[0].mismatch) throw new Error("Recovery verification failed");
    }
    await client.query("COMMIT");
    return {operationId,recovered:true};
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
