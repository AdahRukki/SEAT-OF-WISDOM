/**
 * Regression test: sub-admins cannot register returning students.
 *
 * Covers three scenarios:
 *
 *  1. Sub-admin POSTs studentType='returning' → must be rejected with 403
 *  2. Sub-admin POSTs studentType='new'       → must succeed (201/200)
 *  3. Main Admin POSTs studentType='returning' → must succeed (201/200)
 *
 * Also does a static source-code check that the UI renders a locked "New
 * Student" badge (not a clickable Returning button) when the current user is a
 * sub-admin, so a future UI refactor cannot silently re-expose the selector.
 *
 * Runs against the live development server and the development database.
 * All inserted rows are deleted when the test completes (success or failure).
 *
 * Run with:  npx tsx scripts/test-returning-student-guard.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "../server/db";
import {
  schools,
  classes,
  users,
  students,
  paymentAuditLogs,
  calendarEvents,
  studentNameChangeRequests,
  bankStatements,
  bankTransactions,
  feePaymentRecords,
} from "@shared/schema";
import { eq, inArray, like } from "drizzle-orm";

// ESM-compatible __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── config ────────────────────────────────────────────────────────────────────

const BASE =
  (process.env.TEST_URL ?? "http://localhost:5000").replace(/\/$/, "");
const JWT_SECRET =
  process.env.JWT_SECRET ?? "development-jwt-secret-change-in-production";

const TAG = `ret-guard-test-${Date.now()}`;
const ORPHAN_PREFIX = "ret-guard-test-%";

// ── helpers ───────────────────────────────────────────────────────────────────

let failures = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? detail : "");
  }
}

function makeToken(userId: string, role: string, schoolId?: string): string {
  return jwt.sign({ userId, role, schoolId }, JWT_SECRET, { expiresIn: "1h" });
}

async function apiFetch(
  method: string,
  urlPath: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, body };
}

// Build a minimal valid registration payload.
function studentPayload(classId: string, studentType: "new" | "returning", schoolId?: string) {
  return {
    firstName: "Test",
    lastName: TAG,
    password: "Test1234!",
    classId,
    parentWhatsApp: "08012345678",
    studentType,
    ...(schoolId ? { schoolId } : {}),
  };
}

/**
 * Delete every row that blocks a school delete, working from deepest dependents
 * up to the school row itself.  Each step is individually try/caught so one
 * failure never silently skips the rest.
 */
async function cleanupSchoolById(schoolId: string) {
  const steps: Array<{ name: string; fn: () => Promise<unknown> }> = [
    {
      name: "paymentAuditLogs",
      fn: () => db.delete(paymentAuditLogs).where(eq(paymentAuditLogs.schoolId, schoolId)),
    },
    {
      name: "calendarEvents",
      fn: () => db.delete(calendarEvents).where(eq(calendarEvents.schoolId, schoolId)),
    },
    {
      name: "studentNameChangeRequests",
      fn: () =>
        db
          .delete(studentNameChangeRequests)
          .where(eq(studentNameChangeRequests.schoolId, schoolId)),
    },
    {
      name: "feePaymentRecords",
      fn: () => db.delete(feePaymentRecords).where(eq(feePaymentRecords.schoolId, schoolId)),
    },
    {
      name: "bankTransactions",
      fn: () => db.delete(bankTransactions).where(eq(bankTransactions.schoolId, schoolId)),
    },
    {
      name: "bankStatements",
      fn: () => db.delete(bankStatements).where(eq(bankStatements.schoolId, schoolId)),
    },
    {
      name: "users",
      fn: () => db.delete(users).where(eq(users.schoolId, schoolId)),
    },
    {
      name: "school",
      fn: () => db.delete(schools).where(eq(schools.id, schoolId)),
    },
  ];

  for (const step of steps) {
    try {
      await step.fn();
    } catch (err) {
      console.error(`  Cleanup error (${step.name} for school ${schoolId}):`, err);
    }
  }
}

/**
 * Find and fully remove any leftover test schools from previous broken runs.
 * Called once at startup so stale rows never accumulate.
 */
async function sweepOrphansByPrefix(prefix: string) {
  const orphans = await db
    .select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(like(schools.name, prefix));

  if (orphans.length === 0) return;

  console.log(`\nSweeping ${orphans.length} orphaned test school(s) from previous runs…`);
  for (const orphan of orphans) {
    console.log(`  Removing: ${orphan.name} (${orphan.id})`);
    await cleanupSchoolById(orphan.id);
  }
  console.log("  Sweep complete.\n");
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nReturning-student registration guard test  [${TAG}]\n`);

  // ── server reachability ────────────────────────────────────────────────────
  try {
    const ping = await fetch(`${BASE}/api/auth/me`);
    if (ping.status === 0) throw new Error("no response");
  } catch {
    console.error(
      `\nServer unreachable at ${BASE}.\nStart it with "npm run dev" and re-run this script.\n`,
    );
    process.exit(1);
  }

  // Purge any schools left behind by previous failed/interrupted runs before
  // creating new test data.
  await sweepOrphansByPrefix(ORPHAN_PREFIX);

  // ── DB fixtures ───────────────────────────────────────────────────────────
  // We track every created row so cleanup is deterministic.
  const createdStudentIds: string[] = [];   // students.id
  const createdUserIds: string[]    = [];   // users.id  (non-student accounts)
  let schoolId!: string;
  let classId!: string;
  let subAdminId!: string;
  let adminId!: string;

  const hashed = await bcrypt.hash("TestPass1!", 10);

  try {
    // School + class
    const [school] = await db
      .insert(schools)
      .values({ name: TAG, currentTerm: "First Term", currentSession: "2025/2026" })
      .returning();
    schoolId = school.id;

    const classTag = `${TAG}-class`;
    await db.insert(classes).values({ id: classTag, name: "Test Class", schoolId });
    classId = classTag;

    // Sub-admin: must have schoolId so the route scopes requests to that school.
    const [subAdminUser] = await db
      .insert(users)
      .values({
        email: `${TAG}-subadmin@test.local`,
        password: hashed,
        firstName: "Sub",
        lastName: "Admin",
        role: "sub-admin",
        schoolId,
      })
      .returning();
    subAdminId = subAdminUser.id;
    createdUserIds.push(subAdminId);

    // Main admin: no schoolId (admins are cross-school).
    const [adminUser] = await db
      .insert(users)
      .values({
        email: `${TAG}-admin@test.local`,
        password: hashed,
        firstName: "Main",
        lastName: "Admin",
        role: "admin",
      })
      .returning();
    adminId = adminUser.id;
    createdUserIds.push(adminId);

    // Null out passwordUpdatedAt so the auth middleware's "token issued before
    // password change" guard doesn't fire.  The guard skips when the column is
    // NULL, and JWT iat (second-precision) vs DB timestamp (ms-precision) would
    // otherwise cause a spurious 401 on freshly-created test accounts.
    await db
      .update(users)
      .set({ passwordUpdatedAt: null })
      .where(inArray(users.id, [subAdminId, adminId]));

    const subToken   = makeToken(subAdminId,  "sub-admin", schoolId);
    const adminToken = makeToken(adminId,      "admin");

    // ── API test 1: sub-admin + returning → 403 ───────────────────────────────
    console.log("── API test 1: sub-admin POSTs studentType='returning' → 403");
    {
      const r = await apiFetch(
        "POST",
        "/api/admin/students",
        { token: subToken, body: studentPayload(classId, "returning") },
      );
      check(
        "sub-admin returning registration is rejected with 403",
        r.status === 403,
        { status: r.status, body: r.body },
      );
      check(
        "error message mentions sub-admin restriction",
        typeof r.body?.error === "string" &&
          r.body.error.toLowerCase().includes("sub-admin"),
        r.body?.error,
      );
      // No student should have been persisted; the route cleans the orphan user.
      const leftBehind = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.classId, classId));
      check(
        "no student row persisted after 403",
        leftBehind.length === 0,
        { rows: leftBehind.length },
      );
    }

    // ── API test 2: sub-admin + new → success ─────────────────────────────────
    console.log("\n── API test 2: sub-admin POSTs studentType='new' → 200/201");
    {
      const r = await apiFetch(
        "POST",
        "/api/admin/students",
        { token: subToken, body: studentPayload(classId, "new") },
      );
      check(
        "sub-admin new-student registration succeeds",
        r.status === 200 || r.status === 201,
        { status: r.status, body: r.body },
      );
      if (r.status === 200 || r.status === 201) {
        const studentDbId: string | undefined = r.body?.student?.id;
        const studentUserId: string | undefined = r.body?.user?.id;
        check(
          "response contains student record",
          !!studentDbId,
          r.body,
        );
        check(
          "created student has studentType='new'",
          r.body?.student?.studentType === "new",
          r.body?.student?.studentType,
        );
        if (studentDbId) createdStudentIds.push(studentDbId);
        if (studentUserId) createdUserIds.push(studentUserId);
      }
    }

    // ── API test 3: main admin + returning → success ──────────────────────────
    console.log("\n── API test 3: main admin POSTs studentType='returning' → 200/201");
    {
      const r = await apiFetch(
        "POST",
        "/api/admin/students",
        {
          token: adminToken,
          body: studentPayload(classId, "returning", schoolId),
        },
      );
      check(
        "main-admin returning-student registration succeeds",
        r.status === 200 || r.status === 201,
        { status: r.status, body: r.body },
      );
      if (r.status === 200 || r.status === 201) {
        const studentDbId: string | undefined = r.body?.student?.id;
        const studentUserId: string | undefined = r.body?.user?.id;
        check(
          "response contains student record",
          !!studentDbId,
          r.body,
        );
        check(
          "created student has studentType='returning'",
          r.body?.student?.studentType === "returning",
          r.body?.student?.studentType,
        );
        if (studentDbId) createdStudentIds.push(studentDbId);
        if (studentUserId) createdUserIds.push(studentUserId);
      }
    }

    // ── UI static check ───────────────────────────────────────────────────────
    console.log("\n── UI static check: sub-admin registration form is locked");
    {
      const dashboardPath = path.resolve(
        __dirname,
        "../client/src/pages/admin-dashboard.tsx",
      );
      const src = fs.readFileSync(dashboardPath, "utf8");

      // The sub-admin branch must render a locked badge (not the Returning button).
      check(
        "sub-admin path renders a 'locked' read-only badge instead of the Returning button",
        src.includes("user?.role === 'sub-admin'") &&
          src.includes("locked") &&
          src.includes("New Student"),
        "Expected sub-admin lock guard in admin-dashboard.tsx",
      );

      // The Returning selector button must be inside the else branch (main admin only).
      // Verify the source contains the role check immediately before the Returning button.
      const subAdminBranchIdx = src.indexOf("user?.role === 'sub-admin'");
      const returningBtnIdx   = src.indexOf("Returning Student");
      check(
        "Returning Student button is gated behind the role check (main admin only)",
        subAdminBranchIdx !== -1 &&
          returningBtnIdx !== -1 &&
          returningBtnIdx > subAdminBranchIdx,
        { subAdminBranchIdx, returningBtnIdx },
      );
    }

  } finally {
    // ── cleanup ───────────────────────────────────────────────────────────────
    console.log("\n── cleanup");

    // Delete any student rows created by successful registrations, then their users.
    if (createdStudentIds.length > 0) {
      try {
        const studentRows = await db
          .select({ userId: students.userId })
          .from(students)
          .where(inArray(students.id, createdStudentIds));
        await db.delete(students).where(inArray(students.id, createdStudentIds));
        const studentUserIds = studentRows.map((r) => r.userId).filter(Boolean) as string[];
        if (studentUserIds.length > 0) {
          await db.delete(users).where(inArray(users.id, studentUserIds));
        }
      } catch (e) {
        console.error("  Cleanup error (createdStudents):", e);
      }
    }

    // Also sweep any orphaned temp student users that share this session's class
    // (in case a partial run left rows behind).
    if (classId) {
      try {
        const orphans = await db
          .select({ id: students.id, userId: students.userId })
          .from(students)
          .where(eq(students.classId, classId));
        if (orphans.length > 0) {
          await db.delete(students).where(eq(students.classId, classId));
          const orphanUserIds = orphans.map((r) => r.userId).filter(Boolean) as string[];
          if (orphanUserIds.length > 0) {
            await db.delete(users).where(inArray(users.id, orphanUserIds));
          }
        }
      } catch (e) {
        console.error("  Cleanup error (orphanStudents):", e);
      }
    }

    // Delete fixture (sub-admin + main admin) accounts.
    if (createdUserIds.length > 0) {
      try {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      } catch (e) {
        console.error("  Cleanup error (createdUsers):", e);
      }
    }

    // Safety net: delete class, then everything tied to the school by schoolId so
    // no non-cascading FK row can block the final school delete.
    if (classId) {
      try { await db.delete(classes).where(eq(classes.id, classId)); }
      catch (e) { console.error("  Cleanup error (class):", e); }
    }
    if (schoolId) {
      await cleanupSchoolById(schoolId);
    }

    console.log("  cleanup done");
  }

  // ── result ────────────────────────────────────────────────────────────────
  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll returning-student guard checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
