import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { chromium } from 'playwright';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema.ts';
import { setHistoryContext } from '../../server/student-history.ts';
import { createAnalyticsFixture, ids, actor } from './analytics-database-fixture.ts';
import { createAnalyticsHttpFixture } from './analytics-http-fixture.ts';

const baseURL = process.env.NAVIGATION_TEST_URL || 'http://127.0.0.1:5173';
let f, http, browser, admitted, expected;
before(async () => {
  f = await createAnalyticsFixture();
  for (const id of ids) await f.pg.query("UPDATE schools SET current_term='First Term',current_session='2026/2027' WHERE id=$1", [id]);
  admitted = [];
  for (let i = 0; i < 4; i++) admitted.push(await f.create(i, '2026-09-01'));
  const receipt = await f.payment('100', null);
  await f.db.insert(schema.feePaymentStudentSplits).values([{ paymentRecordId: receipt.id, studentId: f.students[0].id, amount: '40', purpose: 'Tuition' }, { paymentRecordId: receipt.id, studentId: admitted[0].id, amount: '60', purpose: 'Tuition' }]);
  await f.payment('50', f.students[0].id);
  const fee = (await f.pg.query('SELECT id FROM fee_types WHERE school_id=$1', [ids[0]])).rows[0];
  await f.db.insert(schema.studentFees).values([f.students[0], admitted[0]].map(s => ({ studentId: s.id, feeTypeId: fee.id, amount: '100', status: 'pending', session: '2026/2027', term: 'First Term' })));
  for (let i = 0; i < 4; i++) {
    const [subject] = await f.db.insert(schema.subjects).values({ name: 'Mathematics', code: `MATH-${i}`, schoolId: ids[i], classId: `p${i}` }).returning();
    await f.db.insert(schema.assessments).values({ studentId: admitted[i].id, classId: `p${i}`, subjectId: subject.id, firstCA: 15, secondCA: 15, exam: [52, 20, 35, 40][i], term: 'First Term', session: '2026/2027' });
    const present = [18, 9, 5, 0][i], total = i === 0 ? 20 : 10;
    await f.db.insert(schema.attendance).values({ studentId: admitted[i].id, classId: `p${i}`, presentDays: present, absentDays: total - present, totalDays: total, term: 'First Term', session: '2026/2027' });
  }
  await f.pg.query("UPDATE students SET student_type='returning',student_type_flipped_term='First Term',student_type_flipped_session='2026/2027' WHERE id=$1", [admitted[0].id]);
  await f.db.transaction(async tx => {
    await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', reason: 'Relocated' });
    await tx.execute(sql`UPDATE students SET status='withdrawn' WHERE id=${admitted[0].id}`);
    await tx.execute(sql`UPDATE students SET status='withdrawn' WHERE id=${admitted[0].id}`);
    await tx.execute(sql`UPDATE users SET is_active=false WHERE id=${admitted[0].userId}`);
  });
  await f.pg.query("UPDATE schools SET current_term='Third Term' WHERE id=$1", [ids[0]]);
  await f.db.transaction(async tx => {
    await setHistoryContext(tx, { actorId: actor, actorRole: 'admin', reason: 'Readmitted' });
    await tx.execute(sql`UPDATE students SET status='active' WHERE id=${admitted[0].id}`);
    await tx.execute(sql`UPDATE users SET is_active=true WHERE id=${admitted[0].userId}`);
    await tx.execute(sql`UPDATE students SET class_id='s0' WHERE id=${admitted[0].id}`);
  });
  expected = await f.reporting.report({ session: '2026/2027', term: 'First Term' });
  assert.equal(expected.population.combined.activeEnrolled, 7);
  assert.equal(expected.admissions.originalNewAdmissions, 4);
  assert.equal(expected.withdrawals.withdrawalEvents, 1);
  assert.equal(expected.withdrawals.stillWithdrawnFromSelectedPeriod, 0);
  assert.equal(expected.finance.combined.confirmedRevenue, 150);
  assert.equal(expected.academics.averageScore, 66.75);
  assert.equal(expected.attendance.percentage, 64);
  http = await createAnalyticsHttpFixture(f);
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await http?.close(); await f?.pg.close(); });

for (const width of [1440, 390]) {
  test(`database → authenticated API → dashboard → Excel/PDF preserves history and totals at ${width}px`, async () => {
    const before = (await f.pg.query('SELECT (SELECT count(*) FROM student_status_events) AS events,(SELECT count(*) FROM student_population_snapshots) AS censuses,(SELECT count(*) FROM schools) AS schools')).rows[0];
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    await context.addInitScript(token => { localStorage.clear(); localStorage.setItem('auth_token', token); }, http.tokens.admin);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${http.origin}${url.pathname}${url.search}` }) });
    });
    const selectSection = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('heading', { name, exact: true }).waitFor(); };
    try {
      await page.goto(`${baseURL}/portal`);
      await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
      await page.getByLabel('Academic session', { exact: true }).selectOption('2026/2027');
      await page.getByLabel('Academic term', { exact: true }).selectOption('First Term');
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
      const excelEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
      const workbook = XLSX.read(fs.readFileSync(await (await excelEvent).path()), { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Executive summary'], { header: 1 }).slice(4);
      assert.equal(rows.find(row => row[0] === 'Active enrolled students')[1], 7);
      assert.equal(rows.find(row => row[0] === 'Recorded new admissions')[1], 4);
      assert.equal(rows.find(row => row[0] === 'Confirmed revenue')[1], 150);
      assert.equal(rows.find(row => row[0] === 'Assessment average')[1], 66.75);
      assert.equal(rows.find(row => row[0] === 'Attendance')[1], 64);
      await selectSection('Withdrawals and Retention');
      assert.match(await page.getByRole('region', { name: 'Withdrawal register', exact: true }).innerText(), /Relocated[\s\S]*No longer withdrawn/);
      const pdfEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
      const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(await (await pdfEvent).path())) });
      try { const text = (await parser.getText()).text; assert.ok(text.includes('Relocated')); assert.ok(text.includes('No longer withdrawn')); assert.ok(text.includes('Primary 1')); } finally { await parser.destroy(); }
      await selectSection('New Enrolment');
      await page.getByRole('textbox', { name: 'Search Admission register' }).fill(admitted[0].studentId);
      await page.getByText('1 matching records · Page 1 of 1', { exact: true }).waitFor();
      assert.match(await page.getByRole('region', { name: 'Admission register', exact: true }).innerText(), /Primary 1[\s\S]*new/);
      for (const name of ['Bonsaac', 'Akwuofor', 'Akwuose']) await page.getByRole('checkbox', { name, exact: true }).uncheck();
      await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
      await page.getByRole('heading', { name: 'New Enrolment', exact: true }).waitFor();
      await selectSection('Historical Comparisons');
      await page.getByLabel('Original session', { exact: true }).selectOption('2026/2027');
      await page.getByLabel('Original term', { exact: true }).selectOption('First Term');
      await page.getByLabel('Comparison session', { exact: true }).selectOption('2026/2027');
      await page.getByLabel('Comparison term', { exact: true }).selectOption('Third Term');
      await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
      await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).waitFor();
      const event = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
      const comparison = XLSX.read(fs.readFileSync(await (await event).path()), { type: 'buffer' });
      assert.equal(comparison.Sheets['Historical comparison'].C5.v, 1);
      assert.equal(comparison.Sheets['Historical comparison'].D5.v, 2);
      assert.equal(comparison.Sheets['Historical comparison'].E5.v, 1);
      assert.equal(comparison.Sheets['Historical comparison'].F5.v, 100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      const after = (await f.pg.query('SELECT (SELECT count(*) FROM student_status_events) AS events,(SELECT count(*) FROM student_population_snapshots) AS censuses,(SELECT count(*) FROM schools) AS schools')).rows[0];
      assert.deepEqual(after, before);
      assert.equal(after.schools, 4);
    } finally { await context.close(); }
  });
}

test('real JWT middleware rejects non-main roles, disabled accounts, revoked tokens and unauthorized reporting writes', async () => {
  for (const path of ['overview', 'population', 'admissions', 'withdrawals', 'finance', 'academics', 'attendance', 'comparison', 'periods']) {
    assert.equal((await http.request(path)).status, 401);
    for (const role of ['sub-admin', 'bursar', 'student']) assert.equal((await http.request(path, role)).status, 403);
  }
  const response = await http.request('overview?session=2026%2F2027&term=First%20Term', 'admin');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).finance.combined.confirmedRevenue, 150);
  await f.pg.query('UPDATE users SET is_active=false WHERE id=$1', [actor]);
  assert.equal((await http.request('overview', 'admin')).status, 401);
  await f.pg.query('UPDATE users SET is_active=true WHERE id=$1', [actor]);
  http.invalidatedTokens.add(http.tokens.admin);
  assert.equal((await http.request('overview', 'admin')).status, 401);
  http.invalidatedTokens.clear();
  assert.equal((await http.request(`overview?schoolId=${ids[1]}&classId=p0`, 'admin')).status, 404);
  assert.equal((await fetch(`${http.origin}/api/admin/analytics/overview`, { method: 'POST', headers: { Authorization: `Bearer ${http.tokens.admin}` } })).status, 404);
});

test('database setup errors identify the missing migration and Retry reports also reloads period filters after setup', async () => {
  const pending = await createAnalyticsFixture(false);
  const server = await createAnalyticsHttpFixture(pending);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(15000);
  await context.addInitScript(token => { localStorage.clear(); localStorage.setItem('auth_token', token); }, server.tokens.admin);
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${server.origin}${url.pathname}${url.search}` }) });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${baseURL}/portal/admin/general`);
    await page.getByRole('heading', { name: 'History setup required', exact: true }).first().waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Executive Overview', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Download Excel', exact: true }).count(), 0);
    await pending.pg.exec(fs.readFileSync(new URL('../migrations/20261011_student_history.sql', import.meta.url), 'utf8'));
    await page.getByRole('button', { name: 'Retry reports', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Ikpoto', exact: true }).waitFor();
    assert.ok((await page.getByLabel('Academic session', { exact: true }).locator('option').allTextContents()).includes('2026/2027'));
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await context.close(); await server.close(); await pending.pg.close(); }
});
