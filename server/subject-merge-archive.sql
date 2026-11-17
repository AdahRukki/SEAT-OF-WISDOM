-- Apply only in a staging database after dependency and historical report review.
-- The merge snapshot table doubles as the source-subject archive registry.
BEGIN;
CREATE TABLE IF NOT EXISTS subject_merge_snapshots (
 operation_id uuid PRIMARY KEY, actor_id text NOT NULL,
 source_id uuid NOT NULL UNIQUE, target_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL
);
CREATE OR REPLACE FUNCTION reject_merged_subject_reference() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 -- Serialize with merge transaction's subject-table lock.
 PERFORM 1 FROM subjects WHERE id=NEW.subject_id FOR KEY SHARE;
 IF EXISTS (SELECT 1 FROM subject_merge_snapshots WHERE source_id=NEW.subject_id) THEN
   RAISE EXCEPTION 'Subject has been merged; reload the subject list';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reject_archived_assessment_subject ON assessments;
CREATE TRIGGER reject_archived_assessment_subject
 BEFORE INSERT OR UPDATE OF subject_id ON assessments
 FOR EACH ROW EXECUTE FUNCTION reject_merged_subject_reference();
DROP TRIGGER IF EXISTS reject_archived_class_subject ON class_subjects;
CREATE TRIGGER reject_archived_class_subject
 BEFORE INSERT OR UPDATE OF subject_id ON class_subjects
 FOR EACH ROW EXECUTE FUNCTION reject_merged_subject_reference();

CREATE OR REPLACE FUNCTION protect_merged_subject_record() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM subject_merge_snapshots WHERE source_id=OLD.id OR target_id=OLD.id) THEN
   RAISE EXCEPTION 'Subject is protected by merge history';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_subject_merge_history ON subjects;
CREATE TRIGGER protect_subject_merge_history BEFORE DELETE OR UPDATE ON subjects
 FOR EACH ROW EXECUTE FUNCTION protect_merged_subject_record();
CREATE OR REPLACE VIEW active_subjects AS
 SELECT s.* FROM subjects s
 WHERE NOT EXISTS (SELECT 1 FROM subject_merge_snapshots m WHERE m.source_id=s.id);
COMMIT;
