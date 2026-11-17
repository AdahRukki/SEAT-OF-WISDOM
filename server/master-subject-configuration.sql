BEGIN;
CREATE TABLE IF NOT EXISTS master_subject_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_key text NOT NULL CHECK (length(trim(class_key)) > 0),
  session text NOT NULL CHECK (length(trim(session)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_key, session)
);
CREATE TABLE IF NOT EXISTS master_subject_configuration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES master_subject_configurations(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  reference_class_id varchar(50) NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(configuration_id, version)
);
CREATE TABLE IF NOT EXISTS master_subject_configuration_items (
  version_id uuid NOT NULL REFERENCES master_subject_configuration_versions(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  subject_name text NOT NULL,
  PRIMARY KEY(version_id, subject_id)
);
CREATE TABLE IF NOT EXISTS master_subject_sync_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES master_subject_configuration_versions(id) ON DELETE RESTRICT,
  actor_id text NOT NULL,
  request_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  preview_revision text NOT NULL,
  result jsonb NOT NULL
);
COMMIT;
