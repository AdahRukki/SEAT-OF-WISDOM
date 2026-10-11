import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { chromium } from 'playwright';
import { schools, metadata, reportFixture, comparisonFixture } from './analytics-browser-fixtures.ts';

const baseURL = process.env.NAVIGATION_TEST_URL || 'http://127.0.0.1:5173';
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
async function setup(width = 1440, fail = false, role = 'admin') {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1100 : 844 }, serviceWorkers: 'block' });
  context.setDefaultTimeout(10000);
  await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('auth_token', 'analytics-test-only'); });
  const page = await context.newPage(), requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = { fail, failAsset: false };
  await context.route('**/*DejaVuSans*', route => state.failAsset ? route.fulfill({ status: 503, body: 'Test font failure' }) : route.continue());
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url());
    requests.push({ path: url.pathname, params: url.searchParams, method: req.method() });
    let body = [];
    if (url.pathname === '/api/auth/me') body = { id: 'analytics-admin', role, schoolId: schools[0].id, firstName: 'Test', lastName: 'Admin', permissions: null };
    if (url.pathname === '/api/admin/schools') body = schools;
    if (url.pathname === '/api/logo') body = { logoUrl: '/favicon.png' };
    if (url.pathname === '/api/current-academic-info') body = { currentSession: '2026/2027', currentTerm: 'First Term' };
    if (url.pathname.includes('financial-summary')) body = { totalCollected: 0, totalExpected: 0, totalOutstanding: 0, confirmedPayments: 0 };
    if (url.pathname.includes('ledger')) body = { entries: [], summary: {} };
    if (url.pathname === '/api/admin/analytics/periods') body = metadata;
    if (url.pathname === '/api/admin/analytics/overview') {
      if (state.fail) return route.fulfill({ status: 503, json: { error: 'Migration is required' } });
      body = reportFixture(url.searchParams);
    }
    if (url.pathname === '/api/admin/analytics/comparison') body = comparisonFixture(url.searchParams);
    await route.fulfill({ json: body });
  });
  return { context, page, requests, errors, state };
}
const section = async (page, name) => { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('heading', { name, exact: true }).waitFor(); };
const lastRequest = (requests, path) => requests.filter(r => r.path.endsWith(path)).at(-1);
for (const width of [1440, 390]) {
  test(`all management sections, registers, zero attendance and class breakdowns at ${width}px`, async () => {
    const { context, page, requests, errors } = await setup(width);
    try {
      await page.goto(`${baseURL}/portal/admin/general`);
      await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
      assert.match(await page.getByRole('region', { name: 'School comparison overview', exact: true }).innerText(), /Ikpoto/);
      await page.screenshot({ path: `/tmp/phase4-general-${width}.png`, fullPage: true });
      await section(page, 'Student Population');
      await page.getByText('Ikpoto · 7 active students · Class breakdown', { exact: true }).click();
      assert.match(await page.getByRole('region', { name: 'Ikpoto population by class', exact: true }).innerText(), /Primary 1/);
      await section(page, 'New Enrolment');
      await page.getByText('29 matching records · Page 1 of 2', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.getByText('29 matching records · Page 2 of 2', { exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'Search Admission register' }).fill('Student Ada Grace 28');
      await page.getByText('1 matching records · Page 1 of 1', { exact: true }).waitFor();
      assert.match(await page.getByRole('region', { name: 'Admission register', exact: true }).innerText(), /Student Ada Grace 28/);
      await page.getByLabel('Admission grouping').selectOption('weeks');
      await page.getByRole('heading', { name: 'Recorded new admissions by weeks' }).waitFor();
      await section(page, 'Withdrawals and Retention');
      assert.match(await page.getByRole('region', { name: 'Withdrawal register', exact: true }).innerText(), /Relocation[\s\S]*No longer withdrawn/);
      assert.match(await page.getByRole('region', { name: 'Readmission register', exact: true }).innerText(), /Student Ada Grace 1/);
      await section(page, 'Finance');
      assert.match(await page.getByRole('region', { name: 'Financial performance by school', exact: true }).innerText(), /₦10,000/);
      await section(page, 'Academic Performance');
      await page.getByText(/These statistics cover usable results only/).waitFor();
      assert.match(await page.getByRole('region', { name: 'Subject performance comparison', exact: true }).innerText(), /Mathematics/);
      await section(page, 'Attendance');
      await page.getByText('Ikpoto · Attendance class breakdown', { exact: true }).click();
      assert.match(await page.getByRole('region', { name: 'Ikpoto attendance by class', exact: true }).innerText(), /0%/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      assert.ok(requests.every(r => r.method === 'GET'));
      assert.ok(requests.every(r => !r.params.get('schoolId') || schools.some(s => s.id === r.params.get('schoolId'))));
      // Management queries must not be stored in the existing offline query cache.
      await page.waitForTimeout(1200);
      const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('sowa_query_cache') || '{}'));
      assert.equal((cached.clientState?.queries || []).some(q => String(q.queryKey[0]).startsWith('/api/admin/analytics/')), false);
    } finally { await context.close(); }
  });
}
test('applied filters use real branches, archived classes, academic periods and receipt dates', async () => {
  const { context, page, requests, errors } = await setup();
  try {
    await page.goto(`${baseURL}/portal/admin/general`);
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    for (const s of schools.slice(2)) await page.getByRole('checkbox', { name: s.name, exact: true }).uncheck();
    await page.getByLabel('Academic session', { exact: true }).selectOption('2026/2027');
    await page.getByLabel('Academic term', { exact: true }).selectOption('First Term');
    await page.getByLabel('Date from (UTC)').fill('2026-09-01');
    await page.getByLabel('Date to (UTC)').fill('2026-09-30');
    await page.getByLabel('Pass threshold / 100').fill('50');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    let req = lastRequest(requests, '/overview');
    assert.equal(req.params.get('schoolIds'), schools.slice(0, 2).map(s => s.id).join(','));
    assert.equal(req.params.get('term'), 'First Term');
    assert.equal(req.params.get('dateFrom'), '2026-09-01');
    assert.equal(req.params.get('passThreshold'), '50');
    assert.equal(req.params.has('schoolId'), false);
    await page.getByLabel('Class', { exact: true }).selectOption('archived-class');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    assert.equal(lastRequest(requests, '/overview').params.get('classId'), 'archived-class');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    assert.equal(lastRequest(requests, '/overview').params.has('schoolIds'), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('term/session comparisons retain N/A baselines and share the applied school scope', async () => {
  const { context, page, requests, errors } = await setup(390);
  try {
    await page.goto(`${baseURL}/portal/admin/general`);
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Akwuose', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await section(page, 'Historical Comparisons');
    await page.getByLabel('Original session', { exact: true }).selectOption('2025/2026');
    await page.getByLabel('Original term', { exact: true }).selectOption('First Term');
    await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
    await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).waitFor();
    assert.match(await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).innerText(), /Active student population\s+N\/A/);
    assert.equal(lastRequest(requests, '/comparison').params.get('schoolIds'), schools.slice(0, 3).map(s => s.id).join(','));
    await page.getByLabel('Comparison mode', { exact: true }).selectOption('session');
    await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
    await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).waitFor();
    assert.equal(lastRequest(requests, '/comparison').params.has('originalTerm'), false);
    await page.getByLabel('Compare corresponding terms within sessions').check();
    await page.getByLabel('Original term', { exact: true }).selectOption('Third Term');
    await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
    await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).waitFor();
    assert.equal(lastRequest(requests, '/comparison').params.get('originalTerm'), 'Third Term');
    assert.equal(lastRequest(requests, '/comparison').params.get('comparisonTerm'), 'First Term');
    await page.getByLabel('Comparison metric', { exact: true }).selectOption('attendancePercentage');
    await page.getByRole('heading', { name: 'Attendance comparison by school' }).waitFor();
    await page.screenshot({ path: '/tmp/phase4-comparison-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('missing historical population stays N/A and service failures allow retry', async () => {
  const { context, page, requests, state, errors } = await setup(1440, true);
  try {
    await page.goto(`${baseURL}/portal/admin/general`);
    await page.getByRole('alert').filter({ hasText: 'Management reports could not be loaded' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Executive Overview', exact: true }).count(), 0);
    state.fail = false;
    await page.getByRole('button', { name: 'Retry reports', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await page.getByLabel('Academic session', { exact: true }).selectOption('2025/2026');
    await page.getByLabel('Academic term', { exact: true }).selectOption('First Term');
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await section(page, 'Student Population');
    await page.getByText(/4 schools have no usable census/).waitFor();
    await page.getByText('Ikpoto · N/A active students · Class breakdown', { exact: true }).waitFor();
    assert.ok(requests.filter(r => r.path.endsWith('/overview')).length >= 3);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const width of [1440, 390]) {
  test(`Excel/PDF downloads for all six management reports match the displayed snapshot at ${width}px`, async () => {
    const { context, page, requests, errors } = await setup(width);
    try {
      await page.goto(`${baseURL}/portal/admin/general`);
      await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
      await section(page, 'New Enrolment');
      await page.getByRole('textbox', { name: 'Search Admission register' }).fill('Student Ada Grace 28');
      await page.getByText('1 matching records · Page 1 of 1', { exact: true }).waitFor();
      const reportReads = requests.filter(r => r.path.endsWith('/overview')).length;
      for (const kind of ['overview', 'population', 'admissions', 'withdrawals', 'finance']) {
        await page.getByLabel('Management report', { exact: true }).selectOption(kind);
        for (const format of ['xlsx', 'pdf']) {
          const event = page.waitForEvent('download', { timeout: 20000 });
          await page.getByRole('button', { name: format === 'xlsx' ? 'Download Excel' : 'Download PDF', exact: true }).click();
          const download = await event;
          assert.match(download.suggestedFilename(), new RegExp(`Seat-of-Wisdom_${kind}_\\d{14}\\.${format}$`));
          const bytes = fs.readFileSync(await download.path());
          if (format === 'pdf') {
            assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
            if (width === 1440 && kind === 'population') fs.writeFileSync('/tmp/phase5-population.pdf', bytes);
          } else {
            const book = XLSX.read(bytes, { type: 'buffer' });
            assert.equal(book.Sheets['Filters and coverage'].A1.v, 'Seat of Wisdom Academy');
            if (kind === 'admissions') {
              const rows = XLSX.utils.sheet_to_json(book.Sheets['Original new admission regi'], { header: 1 }).slice(4);
              assert.equal(rows.length, 28);
              assert.ok(rows.some(row => row[0] === 'Student Ada Grace 1'));
            }
            if (kind === 'finance') assert.equal(book.Sheets['Financial performance'].B5.v, 100000);
          }
          await page.getByText(format === 'xlsx' ? 'Excel download prepared.' : 'PDF download prepared.', { exact: true }).waitFor();
        }
      }
      assert.equal(requests.filter(r => r.path.endsWith('/overview')).length, reportReads);
      await section(page, 'Historical Comparisons');
      assert.equal(await page.getByRole('button', { name: 'Download Excel', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Compare periods', exact: true }).click();
      await page.getByRole('region', { name: 'Combined historical comparison', exact: true }).waitFor();
      for (const format of ['xlsx', 'pdf']) {
        const event = page.waitForEvent('download', { timeout: 20000 });
        await page.getByRole('button', { name: format === 'xlsx' ? 'Download Excel' : 'Download PDF', exact: true }).click();
        const download = await event;
        const bytes = fs.readFileSync(await download.path());
        assert.match(download.suggestedFilename(), new RegExp(`_comparison_\\d{14}\\.${format}$`));
        if (format === 'xlsx') {
          const book = XLSX.read(bytes, { type: 'buffer' });
          assert.equal(book.Sheets['Historical comparison'].C5.v, 'N/A');
          assert.equal(book.Sheets['Historical comparison'].D5.v, 28);
        } else assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      }
      await page.getByLabel('Original term', { exact: true }).selectOption('Third Term');
      assert.equal(await page.getByRole('button', { name: 'Download Excel', exact: true }).isDisabled(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      assert.ok(requests.every(r => r.method === 'GET'));
    } finally { await context.close(); }
  });
}

test('export failures create no empty download and can be retried; unapplied filters disable exports', async () => {
  const { context, page, state, errors } = await setup();
  try {
    await page.goto(`${baseURL}/portal/admin/general`);
    await page.getByRole('heading', { name: 'Executive Overview', exact: true }).waitFor();
    await page.getByRole('checkbox', { name: 'Ikpoto', exact: true }).uncheck();
    assert.equal(await page.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    state.failAsset = true;
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'The report could not be exported' }).waitFor();
    assert.equal(downloads, 0);
    state.failAsset = false;
    const event = page.waitForEvent('download', { timeout: 20000 });
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    assert.equal(fs.readFileSync(await (await event).path()).subarray(0, 4).toString(), '%PDF');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
