import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";

const url = process.env.SUBJECT_TEST_DATABASE_URL;

test("subject management transactions on isolated PostgreSQL", {skip: !url}, async () => {
  const parsed = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(parsed.hostname));
  assert.equal(parsed.pathname, "/subject_management_test");
  process.env.DATABASE_URL = url;
  const {pool} = await import("../../server/db");
  const {migrateSubjectManagement} = await import("../../server/subject-migrations");
  const {executeSubjectMerge} = await import("../../server/subject-merge-engine");
  const {previewSubjectMerge} = await import("../../server/subject-merge-preview");
  const {recoverSubjectMerge} = await import("../../server/subject-merge-recovery");
  const {checkSubjectMergeRecovery} = await import("../../server/subject-merge-resolution");
  const {loadPreservedSubjectReport} = await import("../../server/report-subject-history");
  const {saveMasterConfiguration} = await import("../../server/master-subject-storage");
  const {synchroniseMasterSubjects} = await import("../../server/master-subject-sync");
  const {listSubjectMergeHistory} = await import("../../server/subject-merge-history");

  const query = pool.query.bind(pool) as (sql: string, args?: unknown[]) => Promise<{rows: any[]}>;
  const rows = async (sql: string, args?: unknown[]) => (await query(sql, args)).rows;
  const tag = randomUUID().slice(0, 5);
  const classes = Array.from({length: 4}, (_, i) => tag + i);

  try {
    const actor = (await rows(`INSERT INTO users(email,password,first_name,last_name,role)
      VALUES($1,'test','Test','Admin','admin') RETURNING id`, [tag+"@example.test"]))[0].id;
    for (const id of classes) {
      const school = (await rows("INSERT INTO schools(name) VALUES($1) RETURNING id", [id]))[0].id;
      await query("INSERT INTO classes(id,name,school_id) VALUES($1,$2,$3)", [id, "JSS 1 "+tag, school]);
    }
    const session = "2026/2027";
    const term = "First Term";
    const prior = "2025/2026";
    const active = (await rows("INSERT INTO academic_sessions(session_year,is_active) VALUES($1,true) RETURNING id", [session]))[0].id;
    await query("INSERT INTO academic_terms(term_name,session_id,is_active) VALUES($1,$2,true)", [term,active]);
    const subject = async (name: string, code: string) =>
      (await rows("INSERT INTO subjects(name,code) VALUES($1,$2) RETURNING id", [name+" "+tag, tag+code]))[0].id;
    const source = await subject("Agricultural Science", "a");
    const target = await subject("AGRICULTURAL SCIENCE", "b");
    const next = await subject("Agricultural  Science", "c");
    const master = await subject("Mathematics", "d");
    const empty = await subject("Literature", "e");
    const emptyTarget = await subject("LITERATURE", "f");

    // Existing duplicates predate the migrations.
    await migrateSubjectManagement();
    await migrateSubjectManagement();
    for (const cls of classes) {
      await query("INSERT INTO class_subjects(class_id,subject_id,custom_name) VALUES($1,$2,'Agric'),($1,$3,NULL),($1,$2,NULL)", [cls,source,target]);
      await query("INSERT INTO published_scores(class_id,term,session,published_by) VALUES($1,$2,$3,$4)", [cls,term,prior,actor]);
    }
    await query(`WITH identifiers AS (
      SELECT n, gen_random_uuid() AS id FROM generate_series(1, 330) n
    ), people AS (
      INSERT INTO users(id,email,password,first_name,last_name)
      SELECT id,$1||n||'@example.test','test','Student',n::text FROM identifiers RETURNING id
    )
    INSERT INTO students(user_id,class_id,student_id,parent_whatsapp)
    SELECT i.id,($2::text[])[1+(n%4)],$1||n,'000000' FROM identifiers i JOIN people p ON p.id=i.id`, [tag,classes]);
    await query(`INSERT INTO assessments(student_id,subject_id,class_id,term,session,first_ca,second_ca,exam,total)
      SELECT id,$2,class_id,$3,$4,0,20,50,70 FROM students WHERE student_id LIKE $1||'%'`, [tag,source,term,prior]);
    const conflicts = await rows(`INSERT INTO assessments(student_id,subject_id,class_id,term,session,first_ca,second_ca,exam,total)
      SELECT id,$2,class_id,$3,$4,CASE WHEN student_id=$1||'1' THEN 8 ELSE 0 END,20,50,
        CASE WHEN student_id=$1||'1' THEN 78 ELSE 70 END
      FROM students WHERE student_id IN ($1||'1',$1||'2') RETURNING student_id,class_id`, [tag,target,term,prior]);
    await query(`INSERT INTO generated_report_cards(student_id,class_id,term,session,student_name,class_name,generated_by)
      VALUES($1,$2,$3,$4,'Test Student','JSS 1',$5)`, [conflicts[0].student_id,conflicts[0].class_id,term,prior,actor]);

    const preview = await previewSubjectMerge(source,target);
    assert.equal(preview.executionEnabled,true);
    assert.equal(preview.overlaps.length,1);
    await assert.rejects(executeSubjectMerge(source,target,actor,[],preview.revision), /conflict decision/);
    assert.equal((await rows("SELECT count(*)::int n FROM subject_report_snapshots"))[0].n,0);
    const overlap = preview.overlaps[0];
    const choices = [{student_id: overlap.student_id, class_id: overlap.class_id, session: overlap.session,
      term: overlap.term, revision: overlap.revision, retainId: overlap.records.find((r: any) => r.subjectId===target).id}];

    const changedAssignment = (await rows(
      "SELECT id FROM class_subjects WHERE class_id=$1 AND subject_id=$2", [classes[0],target],
    ))[0].id;
    await query("UPDATE class_subjects SET custom_name='Changed after preview' WHERE id=$1",[changedAssignment]);
    await assert.rejects(executeSubjectMerge(source,target,actor,choices,preview.revision), /stale merge preview/);
    await query("UPDATE class_subjects SET custom_name=NULL WHERE id=$1",[changedAssignment]);

    // Force a failure after score/assignment mutations and verify rollback.
    await query(`CREATE FUNCTION test_subject_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced audit failure'; END; $$;
      CREATE TRIGGER test_subject_audit_failure BEFORE INSERT ON payment_audit_logs
      FOR EACH ROW EXECUTE FUNCTION test_subject_audit_failure()`);
    try {
      await assert.rejects(executeSubjectMerge(source,target,actor,choices,preview.revision), /forced audit/);
      assert.equal((await rows("SELECT count(*)::int n FROM subject_report_snapshots"))[0].n,0);
      assert.equal((await rows("SELECT count(*)::int n FROM assessments WHERE subject_id=$1",[source]))[0].n,330);
    } finally {
      await query("DROP TRIGGER test_subject_audit_failure ON payment_audit_logs; DROP FUNCTION test_subject_audit_failure()");
    }

    const first = await executeSubjectMerge(source,target,actor,choices,preview.revision);
    assert.equal(first.assessmentsArchived,2);
    assert.equal(first.assignmentsConsolidated,8);
    assert.equal((await rows("SELECT count(*)::int n FROM assessments WHERE subject_id=$1",[target]))[0].n,330);
    assert.equal((await rows("SELECT id FROM active_subjects WHERE id=$1",[source])).length,0);
    const oldReport = await loadPreservedSubjectReport(classes[1],prior,term);
    assert.ok(oldReport?.scores.some(score => score.subjectId===source && score.firstCA===0));
    assert.ok(oldReport?.scores.some(score => score.subjectId===target && score.firstCA===8));
    await assert.rejects(query("INSERT INTO class_subjects(class_id,subject_id) VALUES($1,$2)",[classes[0],source]),/has been merged/);
    await assert.rejects(subject(" agricultural science ", "g"),/already exists/);

    await query("UPDATE class_subjects SET custom_name='Changed after merge' WHERE id=$1",[changedAssignment]);
    assert.equal((await checkSubjectMergeRecovery(first.operationId)).eligibleForReview,false);
    await assert.rejects(recoverSubjectMerge(first.operationId,actor), /changed since merge/);
    await query("UPDATE class_subjects SET custom_name=NULL WHERE id=$1",[changedAssignment]);

    const secondPreview = await previewSubjectMerge(next,target);
    const second = await executeSubjectMerge(next,target,actor,[],secondPreview.revision);
    assert.equal((await checkSubjectMergeRecovery(first.operationId)).eligibleForReview,false);
    await recoverSubjectMerge(second.operationId,actor);
    assert.equal((await checkSubjectMergeRecovery(first.operationId)).eligibleForReview,true);
    await recoverSubjectMerge(first.operationId,actor);
    assert.equal((await rows("SELECT count(*)::int n FROM assessments WHERE subject_id=$1",[source]))[0].n,330);
    assert.deepEqual(await loadPreservedSubjectReport(classes[1],prior,term),oldReport);

    const emptyPreview = await previewSubjectMerge(empty,emptyTarget);
    const concurrent = await Promise.allSettled([
      executeSubjectMerge(empty,emptyTarget,actor,[],emptyPreview.revision),
      executeSubjectMerge(empty,emptyTarget,actor,[],emptyPreview.revision),
    ]);
    assert.equal(concurrent.filter(result => result.status==="fulfilled").length,1);
    const duplicateCreates = await Promise.allSettled([subject("Biology","h"),subject("BIOLOGY","i")]);
    assert.equal(duplicateCreates.filter(result => result.status==="fulfilled").length,1);

    const config = await saveMasterConfiguration({referenceClassId:classes[0],session,subjectIds:[master],actorId:actor,expectedVersion:0});
    const requestKey = randomUUID();
    const input = {versionId:config.versionId,requestKey,actorId:actor};
    const sync = await synchroniseMasterSubjects({...input, apply:false});
    assert.equal(sync.blocked,false);
    assert.equal(sync.changes.length,4);
    const applied = await synchroniseMasterSubjects({...input, apply:true,expectedRevision:sync.revision});
    assert.equal(applied.applied,true);
    assert.deepEqual(await synchroniseMasterSubjects({...input, apply:true,expectedRevision:sync.revision}),applied);
    assert.equal((await rows("SELECT count(*)::int n FROM class_subjects WHERE subject_id=$1",[master]))[0].n,4);
    assert.deepEqual(await loadPreservedSubjectReport(classes[1],prior,term),oldReport);
    assert.equal((await listSubjectMergeHistory()).filter(row => row.recovered_at).length,2);
    assert.equal((await rows("SELECT count(*)::int n FROM payment_audit_logs WHERE entity_type='subject_management'"))[0].n,7);
  } finally {
    await pool.end();
  }
});
