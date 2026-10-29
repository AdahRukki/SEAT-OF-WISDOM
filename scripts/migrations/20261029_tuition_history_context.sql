-- Historical Finance context. Apply explicitly after backup/review.
-- Prerequisite: 20261011_student_history.sql. No new tables, no past-data backfill.
BEGIN;
DO $$ BEGIN
  IF to_regclass('student_population_snapshots') IS NULL OR to_regclass('student_status_events') IS NULL
    OR to_regclass('student_history_commands') IS NULL OR to_regprocedure('sowa_history_context()') IS NULL
    OR (SELECT count(*) FROM (VALUES
      ('students','record_student_history'),('students','student_status_period'),('schools','close_school_period'),
      ('student_status_events','student_history_immutable'),('student_population_snapshots','population_snapshot_immutable'),
      ('student_history_commands','student_history_command_immutable')
    ) expected(table_name,trigger_name) JOIN pg_trigger actual ON actual.tgrelid=to_regclass(expected.table_name)
      AND actual.tgname=expected.trigger_name AND actual.tgenabled IN ('O','A') AND NOT actual.tgisinternal) <> 6 THEN
    RAISE EXCEPTION 'Apply 20261011_student_history.sql before the tuition history context migration';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sowa_capture_population(p_school uuid,p_term text,p_session text,p_kind text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE roster jsonb; v_name text;
BEGIN
  IF p_term IS NULL OR p_session IS NULL THEN RETURN; END IF;
  SELECT name INTO v_name FROM schools WHERE id=p_school FOR UPDATE;
  -- Preserve only settings that really apply while this is the current period.
  -- Never manufacture rates for an already-closed historical period.
  IF p_kind='term_end'
    AND EXISTS (SELECT 1 FROM schools WHERE id=p_school AND current_term=p_term AND current_session=p_session)
    AND NOT EXISTS (SELECT 1 FROM student_population_snapshots WHERE school_id=p_school AND term=p_term AND session=p_session AND snapshot_kind='term_end') THEN
    INSERT INTO tuition_class_amounts(fee_type_id,class_id,amount,term,session,student_type)
    SELECT r.fee_type_id,r.class_id,r.amount,p_term,p_session,r.student_type
    FROM tuition_class_amounts r JOIN fee_types ft ON ft.id=r.fee_type_id
      JOIN classes c ON c.id=r.class_id AND c.school_id=p_school
    WHERE ft.school_id=p_school AND ft.is_tuition=true AND ft.is_active=true AND r.term IS NULL AND r.session IS NULL
      AND NOT EXISTS (SELECT 1 FROM tuition_class_amounts scoped WHERE scoped.fee_type_id=r.fee_type_id AND scoped.class_id=r.class_id
        AND scoped.term=p_term AND scoped.session=p_session AND (scoped.student_type IS NULL OR scoped.student_type IS NOT DISTINCT FROM r.student_type));
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('studentId',s.id,'studentNumber',s.student_id,
    'studentName',concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')),
    'classId',CASE WHEN uncertain.value AND h.previous_data IS NULL THEN NULL ELSE COALESCE(h.previous_data->>'classId',s.class_id) END,
    'className',CASE WHEN uncertain.value AND h.previous_data IS NULL THEN NULL ELSE hc.name END,
    'historicalClassVerified',NOT uncertain.value OR h.previous_data IS NOT NULL,
    'status',s.status,'accountActive',u.is_active,'discount',s.discount,
    'studentType',CASE WHEN s.student_type='returning' AND s.student_type_flipped_term=p_term AND s.student_type_flipped_session=p_session THEN 'new' ELSE s.student_type END) ORDER BY s.id),'[]'::jsonb) INTO roster
  FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id
  LEFT JOIN LATERAL (
    -- Annual promotion occurs before the school advances its session. Retain
    -- the pre-promotion class when closing that precise academic period.
    SELECT e.previous_data FROM student_status_events e
    WHERE e.student_id=s.id AND e.school_id=p_school AND e.session=p_session AND e.term=p_term
      AND e.event_type='promotion' AND e.period_verified
    ORDER BY e.occurred_at,e.sequence LIMIT 1
  ) h ON true
  LEFT JOIN LATERAL (
    SELECT p_kind='term_end' AND EXISTS (
      SELECT 1 FROM promotion_records pr WHERE pr.student_id=s.id AND pr.school_id=p_school AND pr.session=p_session AND pr.is_bulk=false
      AND NOT EXISTS (SELECT 1 FROM student_status_events e WHERE e.student_id=s.id AND e.school_id=p_school AND e.session=p_session
        AND e.event_type='promotion' AND e.period_verified AND e.previous_data->>'classId'=pr.from_class_id AND e.new_data->>'classId'=pr.to_class_id)
    ) AS value
  ) uncertain ON true
  LEFT JOIN classes hc ON hc.id=COALESCE(h.previous_data->>'classId',s.class_id)
  WHERE c.school_id=p_school;
  INSERT INTO student_population_snapshots(school_id,school_name,term,session,snapshot_kind,captured_by,students)
  VALUES(p_school,v_name,p_term,p_session,p_kind,(sowa_history_context()->>'actorId')::uuid,roster)
  ON CONFLICT(school_id,session,term,snapshot_kind) DO NOTHING;
END $$;


COMMIT;
