import { db } from "../server/db";
import { students, assessments, classes } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const mode = process.argv[2] === "--apply" ? "apply" : "preview";

  // Find each student's most recent assessment classId
  const rows = await db.execute(sql`
    SELECT
      s.id            AS student_id,
      s.student_id    AS sowa_id,
      u.first_name || ' ' || u.last_name AS student_name,
      s.class_id      AS current_class_id,
      cc.name         AS current_class_name,
      a.class_id      AS assessment_class_id,
      ac.name         AS assessment_class_name
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN classes cc ON cc.id = s.class_id
    JOIN LATERAL (
      SELECT class_id FROM assessments
      WHERE student_id = s.id
      ORDER BY created_at DESC
      LIMIT 1
    ) a ON true
    JOIN classes ac ON ac.id = a.class_id
    WHERE s.class_id <> a.class_id
    ORDER BY ac.name, student_name
  `);

  const affected = rows.rows as any[];

  if (affected.length === 0) {
    console.log("✅ All students are already in their most recent assessment class. Nothing to fix.");
    process.exit(0);
  }

  console.log(`\n${mode === "preview" ? "PREVIEW" : "APPLYING FIX"} — ${affected.length} student(s) will be moved:\n`);
  console.log("Student Name".padEnd(30), "SOWA ID".padEnd(12), "Current Class".padEnd(20), "→  Correct Class");
  console.log("-".repeat(90));

  for (const row of affected) {
    console.log(
      row.student_name.padEnd(30),
      (row.sowa_id || "N/A").padEnd(12),
      row.current_class_name.padEnd(20),
      "→ ", row.assessment_class_name
    );
  }

  if (mode === "preview") {
    console.log(`\n⚠️  Run with --apply to commit these changes.`);
    process.exit(0);
  }

  // Apply: update each student's class_id to their assessment class_id
  let updated = 0;
  for (const row of affected) {
    await db
      .update(students)
      .set({ classId: row.assessment_class_id })
      .where(eq(students.id, row.student_id));
    updated++;
  }

  console.log(`\n✅ Done — ${updated} student(s) moved back to their correct class.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
