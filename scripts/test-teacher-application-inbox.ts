/**
 * E2E regression test: teacher-application inbox (Task #227)
 *
 * Covers:
 *  1. csvEscape unit tests — formula-injection characters are apostrophe-prefixed
 *  2. Public submission endpoint — multipart form with a CV file and a malicious name
 *  3. Admin list endpoint — returns the submitted application
 *  4. Admin mark-read endpoint
 *  5. Admin status-update workflow — cycles through every valid status
 *  6. Admin notes save — persisted and returned
 *  7. CV file download — streams bytes back to the admin
 *  8. Permission guard — sub-admin without tab_inquiries gets 403 on list/patch/download
 *  9. Invalid status value — rejected with 400
 *
 * Runs against the live development server (must be started first) and the
 * development database.  Test rows are inserted then deleted when done.
 *
 * Run with:  npx tsx scripts/test-teacher-application-inbox.ts
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "../server/db";
import { users, teacherApplications } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";

// ── configuration ────────────────────────────────────────────────────────────

const BASE = process.env.TEST_URL?.replace(/\/$/, "") || "http://localhost:5000";
const JWT_SECRET =
  process.env.JWT_SECRET || "development-jwt-secret-change-in-production";
const TAG = `ta-inbox-test-${Date.now()}`;

// A minimal valid PDF (passes the magic-bytes check: first 4 bytes === '%PDF')
const MINI_PDF = Buffer.from(
  "%PDF-1.0\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
);

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

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "1h" });
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function jsonFetch(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) Object.assign(headers, authHeaders(opts.token));
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: any;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) body = await res.json();
  else body = await res.text();
  return { status: res.status, body };
}

// ── csvEscape logic (replicated from inquiries-management.tsx) ───────────────

function csvEscape(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nTeacher-application inbox regression test  [${TAG}]\n`);

  // Verify we can reach the server
  try {
    const ping = await fetch(`${BASE}/api/auth/me`);
    // any response (401 expected) means the server is up
    if (ping.status === 0) throw new Error("no response");
  } catch {
    console.error(
      `\nServer unreachable at ${BASE}.\nStart it with "npm run dev" and re-run this script.\n`,
    );
    process.exit(1);
  }

  // ── 1. csvEscape unit tests ────────────────────────────────────────────────
  console.log("── 1. csvEscape unit tests");

  // The string =HYPERLINK("...","click") contains " → after apostrophe-prefix it
  // still contains " → csvEscape wraps the whole cell in outer quotes and doubles
  // inner quotes, so the final string is `"'=HYPERLINK(...)"`; the neutralising
  // apostrophe is always present but is the second character.
  const escapedHyperlink = csvEscape('=HYPERLINK("http://evil.example","click")');
  check(
    "formula =HYPERLINK(...) is apostrophe-prefixed",
    escapedHyperlink.includes("'=HYPERLINK"),
    escapedHyperlink,
  );
  check(
    "formula starting with + is apostrophe-prefixed",
    csvEscape("+1234") === "'+1234",
  );
  check(
    "formula starting with - is apostrophe-prefixed",
    csvEscape("-1+2") === "'-1+2",
  );
  check(
    "formula starting with @ is apostrophe-prefixed",
    csvEscape("@SUM(A1)") === "'@SUM(A1)",
  );
  check(
    "formula with leading whitespace is apostrophe-prefixed",
    csvEscape("  =EVIL") === "'  =EVIL",
  );
  check(
    "safe string passes through unchanged",
    csvEscape("John Smith") === "John Smith",
  );
  check(
    "string with comma is double-quoted",
    csvEscape("Smith, John") === '"Smith, John"',
  );
  check(
    "string with double-quote doubles it and wraps in quotes",
    csvEscape('say "hi"') === '"say ""hi"""',
  );
  check("null → empty string", csvEscape(null) === "");
  check("undefined → empty string", csvEscape(undefined) === "");
  check(
    "already-apostrophe-prefixed formula-look-alike starting with ' is NOT double-escaped",
    // A string that starts with ' is safe (not a formula trigger character)
    csvEscape("'=harmless") === "'=harmless",
  );

  // ── 2. Create test users ───────────────────────────────────────────────────
  console.log("\n── 2. Setting up test users");

  const HASHED_PW = await bcrypt.hash("TestPassword1!", 10);

  // Set passwordUpdatedAt 10 s in the past so that the JWT issued right after
  // always passes the "token must be newer than last password change" guard.
  const pastTimestamp = new Date(Date.now() - 10_000);

  const [adminUser] = await db
    .insert(users)
    .values({
      email: `${TAG}-admin@test.invalid`,
      password: HASHED_PW,
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
      passwordUpdatedAt: pastTimestamp,
    })
    .returning();

  // Sub-admin explicitly limited to permissions that do NOT include tab_inquiries
  const [noInqUser] = await db
    .insert(users)
    .values({
      email: `${TAG}-noinq@test.invalid`,
      password: HASHED_PW,
      firstName: "No",
      lastName: "Inquiries",
      role: "sub-admin",
      permissions: ["tab_students", "tab_scores"],
      passwordUpdatedAt: pastTimestamp,
    })
    .returning();

  const adminToken = makeToken(adminUser.id);
  const noInqToken = makeToken(noInqUser.id);

  console.log("  created admin user:", adminUser.id);
  console.log("  created no-inquiries sub-admin:", noInqUser.id);

  let applicationId: string | null = null;

  try {
    // ── 3. Public submission with a CV file and a malicious name ──────────
    console.log("\n── 3. Public submission (multipart with CV file)");

    const form = new FormData();
    form.append("fullName", "=HYPERLINK(\"http://evil.example\",\"Evil Name\")");
    form.append("phone", "08012345678");
    form.append("email", `${TAG}-applicant@test.invalid`);
    form.append("position", "Primary");
    form.append("preferredBranch", "Main Campus");
    form.append("subjects", JSON.stringify(["Mathematics"]));
    form.append("highestQualification", "B.Ed");
    form.append("referenceName", "Jane Ref");
    form.append("referencePhone", "08099999999");
    form.append("referenceRelationship", "Colleague");
    form.append("confirmAccuracy", "true");
    form.append(
      "cv",
      new Blob([MINI_PDF], { type: "application/pdf" }),
      "cv.pdf",
    );

    const submitRes = await fetch(`${BASE}/api/public/careers`, {
      method: "POST",
      body: form,
    });
    const submitBody = await submitRes.json();
    check(
      "public submission returns 200",
      submitRes.status === 200,
      { status: submitRes.status, body: submitBody },
    );
    check("response has success:true", submitBody?.success === true, submitBody);

    // ── 4. Admin list endpoint ────────────────────────────────────────────
    console.log("\n── 4. Admin list endpoint");

    const listRes = await jsonFetch("GET", "/api/admin/teacher-applications", {
      token: adminToken,
    });
    check(
      "list returns 200",
      listRes.status === 200,
      { status: listRes.status },
    );
    check(
      "list is an array",
      Array.isArray(listRes.body),
      typeof listRes.body,
    );

    const app = (listRes.body as any[]).find(
      (a: any) => a.email === `${TAG}-applicant@test.invalid`,
    );
    check("submitted application appears in list", !!app, "not found in list");

    if (app) {
      applicationId = app.id;
      check(
        "malicious full name stored verbatim (un-escaped on server side)",
        app.fullName === "=HYPERLINK(\"http://evil.example\",\"Evil Name\")",
        app.fullName,
      );
      check("cv_path is set (file was uploaded)", !!app.cvPath, app.cvPath);
      check("status defaults to 'New'", app.status === "New", app.status);
    }

    if (!applicationId) {
      console.error("  Cannot proceed with remaining tests: application not found.");
      return;
    }

    // ── 5. Mark as read ───────────────────────────────────────────────────
    console.log("\n── 5. Mark-read endpoint");

    const readRes = await jsonFetch(
      "PATCH",
      `/api/admin/teacher-applications/${applicationId}/read`,
      { token: adminToken, body: { isRead: true } },
    );
    check("mark-read returns 200", readRes.status === 200, readRes.status);
    check(
      "isRead is true in response",
      readRes.body?.isRead === true,
      readRes.body,
    );

    // ── 6. Status workflow ────────────────────────────────────────────────
    console.log("\n── 6. Status workflow");

    const statuses = [
      "Under Review",
      "Shortlisted",
      "Interviewed",
      "Hired",
      "Rejected",
    ] as const;

    for (const status of statuses) {
      const res = await jsonFetch(
        "PATCH",
        `/api/admin/teacher-applications/${applicationId}`,
        { token: adminToken, body: { status } },
      );
      check(
        `status update → "${status}" returns 200`,
        res.status === 200,
        { status: res.status, body: res.body },
      );
      check(
        `status persisted as "${status}"`,
        res.body?.status === status,
        res.body?.status,
      );
    }

    // ── 7. Admin notes save ───────────────────────────────────────────────
    console.log("\n── 7. Admin notes save");

    const NOTES = `Interview scheduled for next week. [${TAG}]`;
    const notesRes = await jsonFetch(
      "PATCH",
      `/api/admin/teacher-applications/${applicationId}`,
      { token: adminToken, body: { adminNotes: NOTES } },
    );
    check("notes update returns 200", notesRes.status === 200, notesRes.status);
    check(
      "notes persisted in response",
      notesRes.body?.adminNotes === NOTES,
      notesRes.body?.adminNotes,
    );

    // Verify notes survive a fresh list
    const listRes2 = await jsonFetch("GET", "/api/admin/teacher-applications", {
      token: adminToken,
    });
    const appAfter = (listRes2.body as any[]).find((a: any) => a.id === applicationId);
    check(
      "notes persist after re-fetch",
      appAfter?.adminNotes === NOTES,
      appAfter?.adminNotes,
    );

    // ── 8. CV file download ───────────────────────────────────────────────
    console.log("\n── 8. CV file download");

    const dlRes = await fetch(
      `${BASE}/api/admin/teacher-applications/${applicationId}/file/cv`,
      { headers: authHeaders(adminToken) },
    );
    check(
      "CV download returns 200",
      dlRes.status === 200,
      { status: dlRes.status },
    );
    // The response should carry binary content (PDF magic bytes)
    const dlBytes = Buffer.from(await dlRes.arrayBuffer());
    check(
      "downloaded bytes start with %PDF magic bytes",
      dlBytes.subarray(0, 4).toString("latin1") === "%PDF",
      dlBytes.subarray(0, 8).toString("latin1"),
    );

    // Invalid file kind
    const badKindRes = await fetch(
      `${BASE}/api/admin/teacher-applications/${applicationId}/file/badkind`,
      { headers: authHeaders(adminToken) },
    );
    check(
      "invalid file kind returns 400",
      badKindRes.status === 400,
      badKindRes.status,
    );

    // ── 9. Permission guard (no tab_inquiries → 403) ──────────────────────
    console.log("\n── 9. Permission guard (sub-admin without tab_inquiries)");

    const guardList = await jsonFetch("GET", "/api/admin/teacher-applications", {
      token: noInqToken,
    });
    check("list with no-inquiries token → 403", guardList.status === 403, guardList.status);

    const guardPatch = await jsonFetch(
      "PATCH",
      `/api/admin/teacher-applications/${applicationId}`,
      { token: noInqToken, body: { status: "New" } },
    );
    check("patch with no-inquiries token → 403", guardPatch.status === 403, guardPatch.status);

    const guardDl = await fetch(
      `${BASE}/api/admin/teacher-applications/${applicationId}/file/cv`,
      { headers: authHeaders(noInqToken) },
    );
    check(
      "file-download with no-inquiries token → 403",
      guardDl.status === 403,
      guardDl.status,
    );

    // Unauthenticated request
    const guardAnon = await jsonFetch("GET", "/api/admin/teacher-applications");
    check("list without token → 401", guardAnon.status === 401, guardAnon.status);

    // ── 10. Invalid status value → 400 ────────────────────────────────────
    console.log("\n── 10. Invalid status value");

    const badStatus = await jsonFetch(
      "PATCH",
      `/api/admin/teacher-applications/${applicationId}`,
      { token: adminToken, body: { status: "NotAStatus" } },
    );
    check("invalid status returns 400", badStatus.status === 400, {
      status: badStatus.status,
      body: badStatus.body,
    });

    // Sending neither status nor adminNotes → 400 ("Nothing to update")
    const emptyPatch = await jsonFetch(
      "PATCH",
      `/api/admin/teacher-applications/${applicationId}`,
      { token: adminToken, body: {} },
    );
    check(
      "empty patch body returns 400",
      emptyPatch.status === 400,
      { status: emptyPatch.status, body: emptyPatch.body },
    );

    // ── 11. Verify CSV formula-injection escape end-to-end ─────────────────
    // The admin list returns the raw (un-escaped) name; the CSV escape must
    // neutralize it before writing to the spreadsheet.
    console.log("\n── 11. CSV formula-injection neutralization (end-to-end)");

    const latestApp = (listRes2.body as any[]).find(
      (a: any) => a.id === applicationId,
    );
    if (latestApp) {
      const escapedName = csvEscape(latestApp.fullName);
      // The malicious name contains " chars → csvEscape outer-quotes the cell,
      // so the result is `"'=HYPERLINK(...)"`. The neutralising apostrophe is
      // present (making it un-executable as a formula) even if it is not the
      // very first character of the CSV cell string.
      check(
        "malicious name is apostrophe-prefixed by csvEscape",
        escapedName.includes("'="),
        escapedName,
      );
    }
  } finally {
    // ── Cleanup ─────────────────────────────────────────────────────────────
    console.log("\n── Cleanup");
    try {
      if (applicationId) {
        await db
          .delete(teacherApplications)
          .where(eq(teacherApplications.id, applicationId));
        console.log("  deleted teacher application:", applicationId);
      } else {
        // Fallback: delete by the applicant email used in this test run
        await db
          .delete(teacherApplications)
          .where(eq(teacherApplications.email, `${TAG}-applicant@test.invalid`));
        console.log("  deleted teacher application (by email fallback)");
      }
      await db.delete(users).where(
        inArray(users.id, [adminUser.id, noInqUser.id]),
      );
      console.log("  deleted test users");
    } catch (cleanupErr) {
      console.error("  cleanup error (non-fatal):", cleanupErr);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("All teacher-application inbox checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
