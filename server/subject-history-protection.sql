BEGIN;
CREATE TABLE IF NOT EXISTS class_subject_period_snapshots (
  class_id varchar(50) NOT NULL,
  session text NOT NULL,
  term text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by text NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('verified_historical','before_assignment_change')),
  subjects jsonb NOT NULL CHECK (jsonb_typeof(subjects) = 'array'),
  PRIMARY KEY (class_id,session,term)
);
CREATE OR REPLACE FUNCTION prevent_subject_period_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical subject snapshots cannot be modified or deleted';
END;
$$;
DROP TRIGGER IF EXISTS immutable_subject_period_snapshot ON class_subject_period_snapshots;
CREATE TRIGGER immutable_subject_period_snapshot
BEFORE UPDATE OR DELETE ON class_subject_period_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_subject_period_snapshot_mutation();
-- No automatic historical backfill: present assignments cannot prove historical curriculum.
COMMIT;
