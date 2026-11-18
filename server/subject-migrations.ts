import { readFile } from "node:fs/promises";
import { connectSubjectDb } from "./subject-db-client";

export async function migrateSubjectManagement() {
  const files = [
    "subject-merge-archive.sql",
    "subject-duplicate-prevention.sql",
    "subject-history-protection.sql",
    "master-subject-configuration.sql",
    "subject-preservation.sql",
  ];
  const scripts = await Promise.all(files.map(async file =>
    (await readFile(new URL("../server/" + file, import.meta.url), "utf8"))
      .replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""),
  ));
  const client = await connectSubjectDb();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(142091634)");
    await client.query(`CREATE TABLE IF NOT EXISTS subject_management_migrations (
      version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await client.query("SELECT version FROM subject_management_migrations WHERE version=1");
    if (!applied.rows.length) {
      for (const script of scripts) await client.query(script);
      await client.query("INSERT INTO subject_management_migrations(version) VALUES(1)");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
