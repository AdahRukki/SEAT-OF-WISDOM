import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export type HistoryReadiness = {
  ready: boolean;
  missingTables: string[];
  missingTriggers: { tableName: string; name: string; state: 'missing' | 'disabled' }[];
};
export async function inspectStudentHistory(connection: { execute(query: SQL): Promise<{ rows: unknown[] }> }): Promise<HistoryReadiness> {
  const result = await connection.execute(sql`
    SELECT 'table' AS kind, expected.name, expected.name AS table_name,
      CASE WHEN to_regclass(expected.name) IS NULL THEN 'missing' ELSE 'ready' END AS state
    FROM (VALUES ('student_status_events'), ('student_history_commands'), ('student_population_snapshots')) AS expected(name)
    UNION ALL
    SELECT 'trigger', expected.name, expected.table_name,
      CASE WHEN actual.oid IS NULL THEN 'missing' WHEN actual.tgenabled IN ('O','A') THEN 'ready' ELSE 'disabled' END
    FROM (VALUES
      ('students','record_student_history'), ('students','student_status_period'), ('schools','close_school_period'),
      ('student_status_events','student_history_immutable'), ('student_history_commands','student_history_command_immutable'),
      ('student_population_snapshots','population_snapshot_immutable')
    ) AS expected(table_name,name)
    LEFT JOIN pg_trigger actual ON actual.tgrelid=to_regclass(expected.table_name) AND actual.tgname=expected.name AND NOT actual.tgisinternal
    ORDER BY kind,name`);
  const rows = result.rows as { kind: string; name: string; table_name: string; state: 'ready' | 'missing' | 'disabled' }[];
  const missingTables = rows.filter(row => row.kind === 'table' && row.state !== 'ready').map(row => row.name);
  const missingTriggers = rows.filter(row => row.kind === 'trigger' && row.state !== 'ready').map(row => ({ tableName: row.table_name, name: row.name, state: row.state as 'missing' | 'disabled' }));
  return { ready: rows.length === 9 && missingTables.length === 0 && missingTriggers.length === 0, missingTables, missingTriggers };
}
