// Explicit read-only inspection: never imports application startup or migrations.
import 'dotenv/config';
import { inspectStudentHistory } from '../server/student-history-readiness';

async function main() {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not configured. Run this check in the app terminal with its database connection configured.'); process.exitCode = 1; return; }
  const { db, pool } = await import('../server/db');
  try {
    const result = await db.transaction(tx => inspectStudentHistory(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    console.log(JSON.stringify({ mode: 'read-only', ...result }, null, 2));
    if (!result.ready) { console.error('Student history setup is incomplete. Review the listed missing/disabled objects and the approved history migration.'); process.exitCode = 1; }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'CONNECTION_OR_QUERY_FAILED';
    console.error(`Read-only inspection failed (${code}). Check the app database connection and server logs.`);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Read-only inspection could not initialize. Check the app database configuration.'); process.exitCode = 1; });
