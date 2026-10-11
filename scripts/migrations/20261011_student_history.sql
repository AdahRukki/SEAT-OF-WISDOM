-- Phase 1. Apply explicitly after backup/review; never run by application startup.
-- All changes are additive. Re-running the migration is safe.
BEGIN;

CREATE TABLE IF NOT EXISTS student_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigserial UNIQUE NOT NULL,
  student_id uuid NOT NULL,
  student_number varchar(50) NOT NULL,
  student_name text NOT NULL,
  school_id uuid,
  school_name text,
  class_id varchar(50),
  class_name text,
  event_type varchar(30) NOT NULL CHECK (event_type IN ('admission','withdrawal','readmission','graduation','transfer_out','transfer_in','class_change','promotion','reactivation','deactivation','legacy_observation')),
  admission_category varchar(20) CHECK (admission_category IN ('new','returning','readmitted')),
  occurred_at timestamp,
  term varchar(50),
  session varchar(20),
  date_verified boolean NOT NULL DEFAULT false,
  period_verified boolean NOT NULL DEFAULT false,
  class_verified boolean NOT NULL DEFAULT false,
  reason text,
  actor_id uuid,
  actor_role varchar(30),
  request_id text,
  source varchar(30) NOT NULL,
  previous_data jsonb,
  new_data jsonb NOT NULL,
  recorded_at timestamp NOT NULL DEFAULT now()
);
-- Deliberately no cascading foreign keys: cleanup cannot erase historical facts.
CREATE UNIQUE INDEX IF NOT EXISTS student_history_one_admission ON student_status_events(student_id) WHERE event_type='admission';
CREATE UNIQUE INDEX IF NOT EXISTS student_history_legacy_once ON student_status_events(student_id,event_type,source) WHERE source='legacy_backfill';
CREATE INDEX IF NOT EXISTS student_history_period ON student_status_events(school_id,session,term,event_type);
CREATE INDEX IF NOT EXISTS student_history_student ON student_status_events(student_id,sequence);
CREATE UNIQUE INDEX IF NOT EXISTS student_history_promotion_import ON student_status_events(request_id) WHERE source='promotion_ledger';

CREATE TABLE IF NOT EXISTS student_history_commands (
  actor_id uuid NOT NULL,
  request_id text NOT NULL,
  command jsonb NOT NULL,
  recorded_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id)
);

CREATE TABLE IF NOT EXISTS student_population_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  school_name text NOT NULL,
  term varchar(50) NOT NULL,
  session varchar(20) NOT NULL,
  snapshot_kind varchar(20) NOT NULL CHECK (snapshot_kind IN ('baseline','term_end')),
  captured_at timestamp NOT NULL DEFAULT now(),
  captured_by uuid,
  coverage varchar(30) NOT NULL DEFAULT 'point_in_time',
  students jsonb NOT NULL,
  UNIQUE(school_id,session,term,snapshot_kind)
);

CREATE OR REPLACE FUNCTION sowa_history_context() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('sowa.student_history_context',true),''),'{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION sowa_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Student history is append-only'; END $$;
DROP TRIGGER IF EXISTS student_history_immutable ON student_status_events;
CREATE TRIGGER student_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON student_status_events FOR EACH STATEMENT EXECUTE FUNCTION sowa_history_immutable();
DROP TRIGGER IF EXISTS population_snapshot_immutable ON student_population_snapshots;
CREATE TRIGGER population_snapshot_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON student_population_snapshots FOR EACH STATEMENT EXECUTE FUNCTION sowa_history_immutable();
DROP TRIGGER IF EXISTS student_history_command_immutable ON student_history_commands;
CREATE TRIGGER student_history_command_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON student_history_commands FOR EACH STATEMENT EXECUTE FUNCTION sowa_history_immutable();

CREATE OR REPLACE FUNCTION sowa_append_student_event(p_student students, p_type text, p_before jsonb, p_context jsonb, p_school uuid DEFAULT NULL, p_class text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_school schools; v_class classes; v_name text; v_after jsonb;
  v_admission boolean := p_type='admission'; v_new boolean;
  v_term text; v_session text; v_date timestamp;
BEGIN
  SELECT * INTO v_class FROM classes WHERE id=COALESCE(p_class,CASE WHEN v_admission THEN p_context->>'admissionClassId' END,p_student.class_id);
  SELECT * INTO v_school FROM schools WHERE id=COALESCE(p_school,v_class.school_id);
  SELECT concat_ws(' ',last_name,first_name,NULLIF(middle_name,'')) INTO v_name FROM users WHERE id=p_student.user_id;
  v_after := jsonb_build_object('classId',p_student.class_id,'status',p_student.status,'schoolId',v_school.id);
  v_new := COALESCE(p_context->>'admissionCategory',p_student.student_type,'returning')='new';
  -- Returning registrations are not proof of an original admission period/date.
  v_term := CASE WHEN v_admission THEN COALESCE(p_context->>'admissionTerm',CASE WHEN v_new THEN v_school.current_term END) ELSE v_school.current_term END;
  v_session := CASE WHEN v_admission THEN COALESCE(p_context->>'admissionSession',CASE WHEN v_new THEN v_school.current_session END) ELSE v_school.current_session END;
  v_date := CASE WHEN v_admission THEN COALESCE((p_context->>'admissionDate')::date::timestamp,CASE WHEN v_new THEN now() END) ELSE now() END;
  INSERT INTO student_status_events(student_id,student_number,student_name,school_id,school_name,class_id,class_name,event_type,admission_category,occurred_at,term,session,date_verified,period_verified,class_verified,reason,actor_id,actor_role,request_id,source,previous_data,new_data)
  VALUES(p_student.id,p_student.student_id,COALESCE(v_name,p_student.student_id),v_school.id,v_school.name,
    CASE WHEN NOT v_admission OR v_new OR p_context->>'admissionClassId' IS NOT NULL THEN v_class.id END,CASE WHEN NOT v_admission OR v_new OR p_context->>'admissionClassId' IS NOT NULL THEN v_class.name END,
    p_type,CASE WHEN v_admission THEN COALESCE(p_context->>'admissionCategory',p_student.student_type,'returning') WHEN p_type='readmission' THEN 'readmitted' END,
    v_date,v_term,v_session,v_date IS NOT NULL AND p_context->>'actorId' IS NOT NULL,
    v_term IS NOT NULL AND v_session IS NOT NULL AND p_context->>'actorId' IS NOT NULL,
    (NOT v_admission OR v_new OR p_context->>'admissionClassId' IS NOT NULL) AND v_class.id IS NOT NULL,
    p_context->>'reason',(p_context->>'actorId')::uuid,p_context->>'actorRole',p_context->>'requestId',
    CASE WHEN p_context->>'actorId' IS NOT NULL THEN 'administrative_action' ELSE 'unattributed_write' END,p_before,v_after);
END $$;

CREATE OR REPLACE FUNCTION sowa_record_student_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ctx jsonb := sowa_history_context(); before_data jsonb; old_school uuid; new_school uuid; event_name text;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM sowa_append_student_event(NEW,'admission',NULL,ctx);
    RETURN NEW;
  END IF;
  SELECT school_id INTO old_school FROM classes WHERE id=OLD.class_id;
  SELECT school_id INTO new_school FROM classes WHERE id=NEW.class_id;
  before_data := jsonb_build_object('classId',OLD.class_id,'status',OLD.status,'schoolId',old_school);
  IF OLD.class_id IS DISTINCT FROM NEW.class_id THEN
    IF old_school IS DISTINCT FROM new_school THEN
      PERFORM sowa_append_student_event(OLD,'transfer_out',before_data,ctx,old_school,OLD.class_id);
      PERFORM sowa_append_student_event(NEW,'transfer_in',before_data,ctx,new_school,NEW.class_id);
    ELSE
      PERFORM sowa_append_student_event(NEW,CASE WHEN ctx->>'action'='promotion' THEN 'promotion' ELSE 'class_change' END,before_data,ctx);
    END IF;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    event_name := CASE WHEN NEW.status='withdrawn' THEN 'withdrawal' WHEN NEW.status='graduated' THEN 'graduation'
      WHEN NEW.status='active' AND OLD.status='withdrawn' THEN 'readmission' WHEN NEW.status='active' THEN 'reactivation' ELSE 'deactivation' END;
    PERFORM sowa_append_student_event(NEW,event_name,before_data,ctx);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS record_student_history ON students;
CREATE TRIGGER record_student_history AFTER INSERT OR UPDATE OF class_id,status ON students FOR EACH ROW EXECUTE FUNCTION sowa_record_student_history();

-- School-period attribution is authoritative; a missing period remains unknown.
-- Only an explicit withdrawal/graduation writes these current status fields.
CREATE OR REPLACE FUNCTION sowa_student_status_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_school schools;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('withdrawn','graduated') THEN
      SELECT sc.* INTO v_school FROM schools sc JOIN classes c ON c.school_id=sc.id WHERE c.id=NEW.class_id;
      NEW.status_term := v_school.current_term;
      NEW.status_session := v_school.current_session;
    ELSIF NEW.status='active' THEN
      NEW.status_term := NULL; NEW.status_session := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS student_status_period ON students;
CREATE TRIGGER student_status_period BEFORE UPDATE OF status ON students FOR EACH ROW EXECUTE FUNCTION sowa_student_status_period();

CREATE OR REPLACE FUNCTION sowa_capture_population(p_school uuid,p_term text,p_session text,p_kind text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE roster jsonb; v_name text;
BEGIN
  IF p_term IS NULL OR p_session IS NULL THEN RETURN; END IF;
  SELECT name INTO v_name FROM schools WHERE id=p_school FOR UPDATE;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('studentId',s.id,'studentNumber',s.student_id,
    'studentName',concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')),
    'classId',CASE WHEN uncertain.value AND h.previous_data IS NULL THEN NULL ELSE COALESCE(h.previous_data->>'classId',s.class_id) END,
    'className',CASE WHEN uncertain.value AND h.previous_data IS NULL THEN NULL ELSE hc.name END,
    'historicalClassVerified',NOT uncertain.value OR h.previous_data IS NOT NULL,
    'status',s.status,'accountActive',u.is_active) ORDER BY s.id),'[]'::jsonb) INTO roster
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

CREATE OR REPLACE FUNCTION sowa_close_school_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.current_term IS DISTINCT FROM NEW.current_term OR OLD.current_session IS DISTINCT FROM NEW.current_session THEN
    PERFORM sowa_capture_population(OLD.id,OLD.current_term,OLD.current_session,'term_end');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_school_period ON schools;
CREATE TRIGGER close_school_period BEFORE UPDATE OF current_term,current_session ON schools FOR EACH ROW EXECUTE FUNCTION sowa_close_school_period();

-- Preserve only facts actually present. Registration timestamps, current class
-- and mutable student_type do NOT establish an original admission.
INSERT INTO student_status_events(student_id,student_number,student_name,school_id,school_name,event_type,source,new_data)
SELECT s.id,s.student_id,concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')),c.school_id,sc.name,
  'legacy_observation','legacy_backfill',jsonb_build_object('observedClassId',s.class_id,'observedStatus',s.status,'originalAdmissionUnknown',true)
FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id LEFT JOIN schools sc ON sc.id=c.school_id
WHERE NOT EXISTS (SELECT 1 FROM student_status_events e WHERE e.student_id=s.id AND e.event_type IN ('admission','legacy_observation'))
ON CONFLICT DO NOTHING;
-- Bulk promotion has always been explicitly restricted to Third Term and
-- records the school, session and FROM class. Individual legacy promotions used
-- global periods, so they cannot safely establish a school's historical term.
INSERT INTO student_status_events(student_id,student_number,student_name,school_id,school_name,class_id,class_name,event_type,
  occurred_at,term,session,date_verified,period_verified,class_verified,actor_id,request_id,source,previous_data,new_data)
SELECT s.id,s.student_id,concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')),pr.school_id,sc.name,
  pr.from_class_id,c.name,CASE WHEN pr.to_class_id='graduated' THEN 'graduation' ELSE 'promotion' END,
  pr.created_at,'Third Term',pr.session,pr.created_at IS NOT NULL,true,true,pr.promoted_by,'legacy-promotion:'||pr.id,'promotion_ledger',
  jsonb_build_object('classId',pr.from_class_id,'status','active','schoolId',pr.school_id),
  jsonb_build_object('classId',CASE WHEN pr.to_class_id='graduated' THEN pr.from_class_id ELSE pr.to_class_id END,'status',CASE WHEN pr.to_class_id='graduated' THEN 'graduated' ELSE 'active' END,'schoolId',pr.school_id)
FROM promotion_records pr JOIN students s ON s.id=pr.student_id JOIN users u ON u.id=s.user_id
LEFT JOIN schools sc ON sc.id=pr.school_id LEFT JOIN classes c ON c.id=pr.from_class_id
WHERE pr.is_bulk=true AND NOT EXISTS (SELECT 1 FROM student_status_events e WHERE e.student_id=pr.student_id AND e.school_id=pr.school_id AND e.session=pr.session
  AND e.term='Third Term' AND e.period_verified AND e.event_type=CASE WHEN pr.to_class_id='graduated' THEN 'graduation' ELSE 'promotion' END
  AND e.previous_data->>'classId'=pr.from_class_id)
ON CONFLICT DO NOTHING;

INSERT INTO student_status_events(student_id,student_number,student_name,school_id,school_name,event_type,term,session,source,new_data)
SELECT s.id,s.student_id,concat_ws(' ',u.last_name,u.first_name,NULLIF(u.middle_name,'')),c.school_id,sc.name,
  CASE WHEN s.status='withdrawn' THEN 'withdrawal' ELSE 'graduation' END,s.status_term,s.status_session,'legacy_backfill',
  jsonb_build_object('observedStatus',s.status,'legacyPeriodUnverified',true,'reason','Legacy endpoint used global academic information; school period/date/class are unverified')
FROM students s JOIN users u ON u.id=s.user_id JOIN classes c ON c.id=s.class_id LEFT JOIN schools sc ON sc.id=c.school_id
WHERE s.status IN ('withdrawn','graduated') AND NOT EXISTS (SELECT 1 FROM student_status_events e WHERE e.student_id=s.id AND e.event_type=CASE WHEN s.status='withdrawn' THEN 'withdrawal' ELSE 'graduation' END)
ON CONFLICT DO NOTHING;

-- Baselines are observations made now, not invented past-term populations.
SELECT sowa_capture_population(id,current_term,current_session,'baseline') FROM schools ORDER BY id;
COMMIT;
