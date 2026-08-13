/**
 * Regression test: past-session scores must never be re-filed to a new class.
 *
 * `createOrUpdateAssessment` matches existing rows on student+subject+term+session
 * (ignoring class). Without the guard in server/storage.ts, re-saving a score after
 * a student is promoted moves the old-session row to the student's NEW class,
 * emptying historical rosters.
 *
 * Cases:
 *  1. Past-session row re-saved with a different classId -> stored classId is
 *     UNCHANGED and scores are merged (untouched fields preserved).
 *  2. Promotion-ledger case: even when the school session has NOT advanced yet,
 *     a promotion record (fromClassId = stored class) keeps the original class.
 *  3. Current-session row re-saved with a different classId -> submitted classId
 *     IS accepted (normal class-transfer behaviour still works).
 *
 * Runs against the development database using throwaway rows that are deleted
 * afterwards (cascade from the temp school + user).
 *
 * Run with:  npx tsx scripts/test-assessment-class-guard.ts
 */
import { db } from "../server/db";
import { storage } from "../server/storage";
import {
  schools,
  users,
  students,
  classes,
  subjects,
  assessments,
  promotionRecords,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

const TAG = `assess-guard-test-${Date.now()}`;
const CURRENT_SESSION = "2025/2026";
const PAST_SESSION = "2024/2025";
const TERM = "First Term";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail ?? "");
  }
}

async function main() {
  // Declare all setup variables before the try so finally can guard each delete.
  let school: { id: number | string } | undefined;
  let user: { id: number | string } | undefined;
  let student: { id: number | string } | undefined;
  let subjA: { id: number | string } | undefined;
  let subjB: { id: number | string } | undefined;
  let subjC: { id: number | string } | undefined;
  let oldClassId: string | undefined;
  let newClassId: string | undefined;

  try {
    // ---------- setup ----------
    [school] = await db
      .insert(schools)
      .values({
        name: TAG,
        currentTerm: TERM,
        currentSession: CURRENT_SESSION,
      })
      .returning();

    oldClassId = `${TAG}-OLD`;
    newClassId = `${TAG}-NEW`;
    await db.insert(classes).values([
      { id: oldClassId, name: "Old Class", schoolId: school.id },
      { id: newClassId, name: "New Class", schoolId: school.id },
    ]);

    [user] = await db
      .insert(users)
      .values({
        email: `${TAG}@example.test`,
        password: "x",
        firstName: "Guard",
        lastName: "Test",
        role: "student",
        schoolId: school.id,
      })
      .returning();

    [student] = await db
      .insert(students)
      .values({
        userId: user.id,
        classId: newClassId, // already promoted to the new class
        studentId: TAG,
        parentWhatsapp: "0000000000",
      })
      .returning();

    [subjA] = await db
      .insert(subjects)
      .values({ name: `${TAG} Subject A`, code: `G${Date.now() % 100000000}` })
      .returning();
    [subjB] = await db
      .insert(subjects)
      .values({ name: `${TAG} Subject B`, code: `H${Date.now() % 100000000}` })
      .returning();
    [subjC] = await db
      .insert(subjects)
      .values({ name: `${TAG} Subject C`, code: `I${Date.now() % 100000000}` })
      .returning();

    // ---------- case 1: past-session save must keep original class ----------
    console.log("Case 1: past-session re-save keeps original class + merges scores");
    await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjA.id,
      classId: oldClassId,
      term: TERM,
      session: PAST_SESSION,
      firstCA: 12,
      secondCA: 15,
      exam: 0,
    });
    // Re-save after promotion: submitted under the NEW class, only exam filled
    const updated1 = await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjA.id,
      classId: newClassId,
      term: TERM,
      session: PAST_SESSION,
      firstCA: 0,
      secondCA: 0,
      exam: 50,
    });
    check("stored classId unchanged (old class)", updated1.classId === oldClassId, updated1.classId);
    check("firstCA preserved from original save", updated1.firstCA === 12, updated1.firstCA);
    check("secondCA preserved from original save", updated1.secondCA === 15, updated1.secondCA);
    check("exam merged from new save", updated1.exam === 50, updated1.exam);
    check("total recomputed from merged values", updated1.total === 77, updated1.total);

    // ---------- case 2: promotion ledger keeps class even before session advance ----------
    console.log("Case 2: promotion ledger keeps class when session hasn't advanced yet");
    await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjB.id,
      classId: oldClassId,
      term: TERM,
      session: CURRENT_SESSION, // same session as school's current one
      firstCA: 10,
      secondCA: 10,
      exam: 10,
    });
    await db.insert(promotionRecords).values({
      schoolId: school.id,
      session: CURRENT_SESSION,
      studentId: student.id,
      fromClassId: oldClassId,
      toClassId: newClassId,
      isBulk: true,
    });
    const updated2 = await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjB.id,
      classId: newClassId,
      term: TERM,
      session: CURRENT_SESSION,
      firstCA: 0,
      secondCA: 0,
      exam: 40,
    });
    check("ledger-backed row keeps original class", updated2.classId === oldClassId, updated2.classId);
    check("exam merged on ledger-backed row", updated2.exam === 40, updated2.exam);

    // ---------- case 3: current-session save accepts submitted class ----------
    console.log("Case 3: current-session re-save (no ledger) accepts the submitted class");
    await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjC.id,
      classId: oldClassId,
      term: TERM,
      session: CURRENT_SESSION,
      firstCA: 5,
      secondCA: 5,
      exam: 5,
    });
    // Remove the ledger entry so this is a plain current-session class change
    await db.delete(promotionRecords).where(eq(promotionRecords.studentId, student.id));
    const updated3 = await storage.createOrUpdateAssessment({
      studentId: student.id,
      subjectId: subjC.id,
      classId: newClassId,
      term: TERM,
      session: CURRENT_SESSION,
      firstCA: 0,
      secondCA: 0,
      exam: 60,
    });
    check("current-session row moves to submitted class", updated3.classId === newClassId, updated3.classId);
    check("scores merged on current-session row", updated3.firstCA === 5 && updated3.exam === 60, {
      firstCA: updated3.firstCA,
      exam: updated3.exam,
    });
  } finally {
    // ---------- cleanup (nullish-guarded so partial setup never orphans rows) ----------
    if (student) {
      await db.delete(assessments).where(eq(assessments.studentId, student.id));
      await db.delete(promotionRecords).where(eq(promotionRecords.studentId, student.id));
      await db.delete(students).where(eq(students.id, student.id));
    }
    if (subjA && subjB && subjC) {
      await db.delete(subjects).where(inArray(subjects.id, [subjA.id, subjB.id, subjC.id]));
    } else {
      // Delete whichever subjects were created individually
      for (const subj of [subjA, subjB, subjC]) {
        if (subj) await db.delete(subjects).where(eq(subjects.id, subj.id));
      }
    }
    if (oldClassId && newClassId) {
      await db.delete(classes).where(inArray(classes.id, [oldClassId, newClassId]));
    } else {
      if (oldClassId) await db.delete(classes).where(eq(classes.id, oldClassId));
      if (newClassId) await db.delete(classes).where(eq(classes.id, newClassId));
    }
    if (user) {
      await db.delete(users).where(eq(users.id, user.id));
    }
    if (school) {
      await db.delete(schools).where(eq(schools.id, school.id));
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll assessment class-guard checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
