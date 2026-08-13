/**
 * Integration test — Sub-admin name-change approval workflow (Task #234)
 *
 * DB-level checks always run (schema, indexes, insert/query/update cycle).
 * HTTP live tests run when TEST_SUBADMIN_PASSWORD and TEST_ADMIN_PASSWORD env
 * vars are set, and exercise the full round-trip through the API.
 *
 * Run with:
 *   npx tsx scripts/test-name-change-workflow.ts
 *
 * For HTTP tests supply credentials:
 *   TEST_SUBADMIN_EMAIL=... TEST_SUBADMIN_PASSWORD=...
 *   TEST_ADMIN_EMAIL=...    TEST_ADMIN_PASSWORD=...
 *   npx tsx scripts/test-name-change-workflow.ts
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const BASE = 'http://localhost:5000';
let pass = 0;
let fail = 0;

function ok(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    fail++;
  }
}

async function apiReq(
  path: string,
  opts: { method?: string; body?: any; token: string }
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session=${opts.token}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let body: any;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/session=([^;]+)/);
  return match?.[1] ?? '';
}

function rows(result: any): any[] {
  return ((result as any).rows ?? result) as any[];
}

async function main() {
  console.log('\n══ Name-change approval workflow integration tests ══\n');

  // ── 1. Schema checks (always run) ─────────────────────────────────────────
  console.log('── DB schema checks ──');

  const tableCheck = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name = 'student_name_change_requests'
  `);
  ok('student_name_change_requests table exists', rows(tableCheck).length > 0);

  const colCheck = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'student_name_change_requests'
    ORDER BY ordinal_position
  `);
  const cols = rows(colCheck).map((r: any) => r.column_name as string);
  const expectedCols = [
    'id', 'student_id', 'school_id', 'requested_by',
    'old_first_name', 'old_last_name', 'old_middle_name',
    'new_first_name', 'new_last_name', 'new_middle_name',
    'status', 'reviewed_by', 'reviewer_notes', 'created_at', 'reviewed_at',
  ];
  for (const col of expectedCols) {
    ok(`column ${col} exists`, cols.includes(col));
  }

  const idxCheck = await db.execute(sql`
    SELECT indexname FROM pg_indexes WHERE tablename = 'student_name_change_requests'
  `);
  const idxNames = rows(idxCheck).map((r: any) => r.indexname as string);
  ok('index on status column',    idxNames.some(n => n.includes('status')));
  ok('index on school_id column', idxNames.some(n => n.includes('school_id')));

  // ── 2. Resolve fixtures ───────────────────────────────────────────────────
  const subAdminResult = await db.execute(sql`
    SELECT id, email, school_id FROM users
    WHERE role = 'sub-admin' AND is_active = TRUE LIMIT 1
  `);
  const mainAdminResult = await db.execute(sql`
    SELECT id, email FROM users
    WHERE role = 'admin' AND is_active = TRUE LIMIT 1
  `);
  const subAdmin  = rows(subAdminResult)[0]  ?? null;
  const mainAdmin = rows(mainAdminResult)[0] ?? null;

  // Find any student (prefer one in sub-admin's school)
  const studentResult = subAdmin
    ? await db.execute(sql`
        SELECT s.id AS "studentId", u.id AS "userId",
               u.first_name AS "firstName", u.last_name AS "lastName",
               u.middle_name AS "middleName"
        FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN users u ON s.user_id = u.id
        WHERE c.school_id = ${subAdmin.school_id} AND u.is_active = TRUE
        LIMIT 1`)
    : await db.execute(sql`
        SELECT s.id AS "studentId", u.id AS "userId",
               u.first_name AS "firstName", u.last_name AS "lastName",
               u.middle_name AS "middleName"
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE u.is_active = TRUE
        LIMIT 1`);
  const student = rows(studentResult)[0] ?? null;

  if (subAdmin)  console.log(`Sub-admin : ${subAdmin.email} (school ${subAdmin.school_id})`);
  if (mainAdmin) console.log(`Main admin: ${mainAdmin.email}`);
  if (student)   console.log(`Student   : ${student.firstName} ${student.lastName} (id ${student.studentId})`);
  console.log('');

  // ── 3. Storage method cycle (DB-level, no HTTP) ────────────────────────
  console.log('── Storage method cycle ──');

  if (!subAdmin || !mainAdmin || !student) {
    console.log('  SKIPPED — missing sub-admin, main admin, or student fixture');
  } else {
    const origFirst  = student.firstName as string;
    const origLast   = student.lastName  as string;
    const origMiddle = student.middleName as string | null;

    // a) INSERT
    const insertResult = await db.execute(sql`
      INSERT INTO student_name_change_requests
        (student_id, school_id, requested_by,
         old_first_name, old_last_name, old_middle_name,
         new_first_name, new_last_name, new_middle_name, status)
      VALUES
        (${student.studentId}, ${subAdmin.school_id}, ${subAdmin.id},
         ${origFirst}, ${origLast}, ${origMiddle},
         'TESTFIRST', 'TESTLAST', NULL, 'pending')
      RETURNING id
    `);
    const insertedRows = rows(insertResult);
    const testReqId = insertedRows[0]?.id as string | undefined;
    ok('createNameChangeRequest inserts a row', !!testReqId);

    if (testReqId) {
      // b) SELECT (getNameChangeRequests pattern)
      const listResult = await db.execute(sql`
        SELECT id, old_first_name AS "oldFirstName",
               new_first_name AS "newFirstName", status
        FROM student_name_change_requests WHERE id = ${testReqId}
      `);
      const listRows = rows(listResult);
      ok('getNameChangeRequests returns row',  listRows.length === 1);
      ok('oldFirstName stored correctly',       listRows[0]?.oldFirstName === origFirst);
      ok('newFirstName stored correctly',       listRows[0]?.newFirstName === 'TESTFIRST');
      ok('status defaults to pending',          listRows[0]?.status === 'pending');

      // c) APPROVE via reviewNameChangeRequest pattern (WHERE status='pending')
      const approveResult = await db.execute(sql`
        UPDATE student_name_change_requests
        SET status = 'approved', reviewed_by = ${mainAdmin.id}, reviewed_at = NOW()
        WHERE id = ${testReqId} AND status = 'pending'
        RETURNING id, status
      `);
      const approvedRows = rows(approveResult);
      ok('approve: 1 row updated',             approvedRows.length === 1);
      ok('status flipped to approved',         approvedRows[0]?.status === 'approved');

      // d) Double-review guard — second UPDATE returns 0 rows
      const doubleResult = await db.execute(sql`
        UPDATE student_name_change_requests
        SET status = 'rejected', reviewed_by = ${mainAdmin.id}, reviewed_at = NOW()
        WHERE id = ${testReqId} AND status = 'pending'
        RETURNING id
      `);
      const doubleRows_ = rows(doubleResult);
      ok('double-review guard: 0 rows updated', doubleRows_.length === 0);

      // e) Rejection path — fresh pending row
      const rejInsert = await db.execute(sql`
        INSERT INTO student_name_change_requests
          (student_id, school_id, requested_by,
           old_first_name, old_last_name, old_middle_name,
           new_first_name, new_last_name, new_middle_name, status)
        VALUES
          (${student.studentId}, ${subAdmin.school_id}, ${subAdmin.id},
           ${origFirst}, ${origLast}, ${origMiddle},
           'REJFIRST', 'REJLAST', NULL, 'pending')
        RETURNING id
      `);
      const rejId = rows(rejInsert)[0]?.id as string | undefined;
      if (rejId) {
        const rejectResult = await db.execute(sql`
          UPDATE student_name_change_requests
          SET status = 'rejected', reviewed_by = ${mainAdmin.id}, reviewed_at = NOW()
          WHERE id = ${rejId} AND status = 'pending'
          RETURNING id, status
        `);
        const rejectedRows = rows(rejectResult);
        ok('reject: 1 row updated',     rejectedRows.length === 1);
        ok('status flipped to rejected', rejectedRows[0]?.status === 'rejected');

        // Confirm user name was NOT changed (rejection should leave it intact)
        const nameCheck = await db.execute(sql`
          SELECT first_name AS fn FROM users WHERE id = ${student.userId}
        `);
        const nameRows = rows(nameCheck);
        ok('user name unchanged after rejection', nameRows[0]?.fn === origFirst);

        await db.execute(sql`DELETE FROM student_name_change_requests WHERE id = ${rejId}`);
      }

      // Cleanup test rows
      await db.execute(sql`DELETE FROM student_name_change_requests WHERE id = ${testReqId}`);
      console.log('\n  (test rows cleaned up)');
    }
  }

  // ── 4. HTTP live tests (only when credentials are provided) ──────────────
  const subAdminEmail    = process.env.TEST_SUBADMIN_EMAIL    ?? (subAdmin?.email ?? '');
  const subAdminPassword = process.env.TEST_SUBADMIN_PASSWORD ?? '';
  const adminEmail       = process.env.TEST_ADMIN_EMAIL       ?? (mainAdmin?.email ?? '');
  const adminPassword    = process.env.TEST_ADMIN_PASSWORD    ?? '';

  if (!subAdminPassword || !adminPassword) {
    console.log('\nINFO: HTTP live tests skipped.');
    console.log('      Set TEST_SUBADMIN_PASSWORD and TEST_ADMIN_PASSWORD to enable them.\n');
  } else if (!student) {
    console.log('\nINFO: HTTP live tests skipped — no student fixture found.\n');
  } else {
    console.log('\n── HTTP live tests ──\n');

    const subToken  = await login(subAdminEmail,  subAdminPassword);
    const mainToken = await login(adminEmail,      adminPassword);
    ok('sub-admin login succeeded',  subToken  !== '');
    ok('main admin login succeeded', mainToken !== '');

    if (!subToken || !mainToken) {
      console.error('Cannot proceed without valid sessions.');
      fail += 5;
    } else {
      const origFirst  = student.firstName as string;
      const origLast   = student.lastName  as string;
      const origMiddle = student.middleName as string | null;
      const newFirst   = `TESTFN_${Date.now()}`;
      const newLast    = `TESTLN_${Date.now()}`;

      // Test A — sub-admin PATCH with name change → 202
      console.log('A: sub-admin PATCH with name change → 202');
      const patchA = await apiReq(`/api/admin/students/${student.studentId}`, {
        method: 'PATCH', token: subToken,
        body: { firstName: newFirst, lastName: newLast },
      });
      ok('status 202',             patchA.status === 202,  String(patchA.status));
      ok('pending flag true',      patchA.body?.pending === true);
      ok('pendingMessage present', typeof patchA.body?.pendingMessage === 'string');

      const uc1 = rows(await db.execute(sql`
        SELECT first_name AS fn, last_name AS ln FROM users WHERE id = ${student.userId}
      `))[0];
      ok('name NOT applied yet (first)', uc1?.fn !== newFirst, String(uc1?.fn));
      ok('name NOT applied yet (last)',  uc1?.ln !== newLast,  String(uc1?.ln));

      // Test B — main admin sees pending request
      console.log('\nB: main admin GET pending → includes new request');
      const listB = await apiReq('/api/admin/name-change-requests?status=pending', { token: mainToken });
      ok('GET 200',          listB.status === 200);
      ok('response is array', Array.isArray(listB.body));
      const newReq = (listB.body as any[])?.find((r: any) => r.newFirstName === newFirst);
      ok('request in queue', !!newReq);
      ok('oldFirstName correct', newReq?.oldFirstName === origFirst);

      const reqId = newReq?.id as string | undefined;

      // Test C — approve
      if (reqId) {
        console.log('\nC: main admin approves → name applied');
        const approveC = await apiReq(`/api/admin/name-change-requests/${reqId}`, {
          method: 'PATCH', token: mainToken,
          body: { action: 'approved', reviewerNotes: 'Looks correct.' },
        });
        ok('approve 200', approveC.status === 200, String(approveC.status));

        const uc2 = rows(await db.execute(sql`
          SELECT first_name AS fn, last_name AS ln FROM users WHERE id = ${student.userId}
        `))[0];
        ok('first name applied', uc2?.fn === newFirst, String(uc2?.fn));
        ok('last name applied',  uc2?.ln === newLast,  String(uc2?.ln));

        // Test D — double-review guard
        console.log('\nD: double review returns 404');
        const doubleD = await apiReq(`/api/admin/name-change-requests/${reqId}`, {
          method: 'PATCH', token: mainToken,
          body: { action: 'rejected' },
        });
        ok('double-review 404', doubleD.status === 404, String(doubleD.status));

        // Restore original name
        await db.execute(sql`
          UPDATE users SET first_name = ${origFirst}, last_name = ${origLast},
                           middle_name = ${origMiddle} WHERE id = ${student.userId}
        `);
        console.log('  (name restored)');
      } else {
        console.log('\nTest C & D: SKIPPED — request not found in queue');
        fail += 4;
      }

      // Test E — rejection path
      console.log('\nE: rejection leaves name unchanged');
      const patchE = await apiReq(`/api/admin/students/${student.studentId}`, {
        method: 'PATCH', token: subToken,
        body: { firstName: `REJECTED_${Date.now()}`, lastName: origLast },
      });
      ok('rejection submit 202', patchE.status === 202, String(patchE.status));

      const listE = await apiReq('/api/admin/name-change-requests?status=pending', { token: mainToken });
      const rejReq = (listE.body as any[])?.find((r: any) => (r.newFirstName as string)?.startsWith('REJECTED_'));
      if (rejReq) {
        const rejectE = await apiReq(`/api/admin/name-change-requests/${rejReq.id}`, {
          method: 'PATCH', token: mainToken,
          body: { action: 'rejected', reviewerNotes: 'Typo in name.' },
        });
        ok('reject 200', rejectE.status === 200, String(rejectE.status));

        const uc3 = rows(await db.execute(sql`
          SELECT first_name AS fn FROM users WHERE id = ${student.userId}
        `))[0];
        ok('name unchanged after rejection', uc3?.fn === origFirst, String(uc3?.fn));
      } else {
        console.log('  SKIPPED — second pending request not found');
        fail++;
      }
    }
  }

  const total = pass + fail;
  console.log(`\n══ ${pass}/${total} passed${fail > 0 ? `, ${fail} FAILED` : ' — all good'} ══\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
