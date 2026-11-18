BEGIN;
-- Requires subject-merge-archive.sql first.
CREATE OR REPLACE FUNCTION enforce_active_subject_name() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE normalized text;
BEGIN
 normalized := upper(btrim(regexp_replace(NEW.name, '[[:space:]]+', ' ', 'g')));
 IF normalized = '' THEN RAISE EXCEPTION 'Subject name cannot be empty'; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF normalized = upper(btrim(regexp_replace(OLD.name, '[[:space:]]+', ' ', 'g'))) THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(normalized, 0));
 IF EXISTS (SELECT 1 FROM subjects s WHERE s.id <> NEW.id
   AND upper(btrim(regexp_replace(s.name, '[[:space:]]+', ' ', 'g'))) = normalized
   AND NOT EXISTS (SELECT 1 FROM subject_merge_snapshots m WHERE m.source_id=s.id))
 THEN RAISE EXCEPTION 'An active subject with this name already exists'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_active_subject_name_trigger ON subjects;
CREATE TRIGGER enforce_active_subject_name_trigger BEFORE INSERT OR UPDATE OF name ON subjects
FOR EACH ROW EXECUTE FUNCTION enforce_active_subject_name();
COMMIT;
