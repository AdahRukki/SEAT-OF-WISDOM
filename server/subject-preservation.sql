CREATE TABLE IF NOT EXISTS subject_merge_recoveries (
  operation_id uuid PRIMARY KEY, actor_id text NOT NULL,
  recovered_at timestamptz NOT NULL DEFAULT now(), merge_record jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS subject_report_snapshots (
  class_id varchar(50) NOT NULL,
  session text NOT NULL,
  term text NOT NULL,
  subjects jsonb NOT NULL,
  scores jsonb NOT NULL,
  PRIMARY KEY (class_id, session, term)
);
CREATE OR REPLACE VIEW canonical_subject_ids AS
WITH RECURSIVE chain(original_id,subject_id) AS (
  SELECT id,id FROM subjects
  UNION ALL
  SELECT c.original_id,m.target_id FROM chain c
  JOIN subject_merge_snapshots m ON m.source_id=c.subject_id
)
SELECT c.* FROM chain c
WHERE NOT EXISTS (SELECT 1 FROM subject_merge_snapshots m WHERE m.source_id=c.subject_id);

DROP TRIGGER IF EXISTS immutable_subject_report_snapshot ON subject_report_snapshots;
CREATE TRIGGER immutable_subject_report_snapshot
BEFORE UPDATE OR DELETE ON subject_report_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_subject_period_snapshot_mutation();
