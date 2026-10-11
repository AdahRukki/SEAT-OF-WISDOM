-- Read-only release inspection. This never installs or changes schema/history.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name, current_setting('transaction_read_only') AS read_only;

SELECT expected.table_name, expected.required_before_migration,
  to_regclass(expected.table_name) IS NOT NULL AS installed
FROM (VALUES
  ('schools', true), ('users', true), ('classes', true), ('students', true), ('promotion_records', true),
  ('student_status_events', false), ('student_history_commands', false), ('student_population_snapshots', false)
) AS expected(table_name, required_before_migration)
ORDER BY expected.required_before_migration DESC, expected.table_name;

SELECT expected.table_name, expected.trigger_name,
  COALESCE(actual.tgenabled IN ('O', 'A'), false) AS enabled
FROM (VALUES
  ('students', 'record_student_history'), ('students', 'student_status_period'),
  ('schools', 'close_school_period'),
  ('student_status_events', 'student_history_immutable'),
  ('student_history_commands', 'student_history_command_immutable'),
  ('student_population_snapshots', 'population_snapshot_immutable')
) AS expected(table_name, trigger_name)
LEFT JOIN pg_trigger actual ON actual.tgrelid = to_regclass(expected.table_name)
  AND actual.tgname = expected.trigger_name AND NOT actual.tgisinternal
ORDER BY expected.table_name, expected.trigger_name;

SELECT id, name, current_term, current_session FROM schools ORDER BY sort_order, id;
COMMIT;
