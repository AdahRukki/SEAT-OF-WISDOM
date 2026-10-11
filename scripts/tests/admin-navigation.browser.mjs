import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against the local Vite frontend. All APIs are intercepted; no database is used.
const baseURL = process.env.NAVIGATION_TEST_URL || 'http://127.0.0.1:5173';
const schools = ['Ikpoto', 'Bonsaac', 'Akwuofor', 'Akwuose'].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`, name,
  currentTerm: i === 3 ? null : 'First Term', currentSession: i === 3 ? null : '2026/2027',
}));
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function setup(role = 'admin', viewport = { width: 1440, height: 1000 }, schoolResponse = schools) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(() => { localStorage.clear(); localStorage.setItem('auth_token', 'navigation-test-only'); });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ pathname: url.pathname, schoolId: url.searchParams.get('schoolId'), method: req.method() });
    let body = [];
    if (url.pathname.startsWith('/api/admin/analytics/')) return route.fulfill({ status: 503, json: { error: 'Reporting unavailable in navigation fixture' } });
    if (url.pathname === '/api/auth/me') body = role === null ? null : { id: `test-${role}`, role, schoolId: schools[0].id, firstName: 'Test', lastName: 'Admin', permissions: null };
    if (url.pathname === '/api/admin/schools') {
      if (schoolResponse === 'error') return route.fulfill({ status: 500, json: { error: 'Test failure' } });
      body = schoolResponse;
    }
    if (url.pathname === '/api/current-academic-info') body = { currentTerm: 'First Term', currentSession: '2026/2027' };
    if (url.pathname === '/api/logo') body = { logoUrl: '/favicon.png' };
    if (url.pathname.includes('financial-summary')) body = { totalCollected: 0, totalExpected: 0, totalOutstanding: 0, confirmedPayments: 0 };
    if (url.pathname.includes('ledger')) body = { entries: [], summary: {} };
    await route.fulfill({ json: body });
  });
  return { context, page, requests, errors };
}

async function chooseView(page, name) {
  await page.locator('button[role="combobox"]:visible').first().click();
  await page.getByRole('option', { name, exact: true }).click();
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`main-admin default, five choices, branch switching, refresh and back at ${viewport.width}px`, async () => {
    const { context, page, requests, errors } = await setup('admin', viewport);
    try {
      await page.goto(`${baseURL}/portal`);
      await page.getByRole('heading', { name: 'General School', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Manage Ikpoto', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: /^Manage / }).count(), 4);
      assert.equal(await page.getByText('Not recorded', { exact: true }).count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.getByRole('link', { name: 'Choose a school', exact: true }).click();
      await page.getByRole('heading', { name: 'Choose your school', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Open General School', exact: true }).count(), 1);
      assert.equal(await page.getByRole('link', { name: /^Manage / }).count(), 4);
      await page.getByRole('link', { name: 'Manage Ikpoto', exact: true }).click();
      await page.waitForURL(`**/portal/admin/school/${schools[0].id}`);
      await page.locator('button[role="combobox"]:visible').first().waitFor();
      await chooseView(page, schools[1].name);
      await page.waitForURL(`**/portal/admin/school/${schools[1].id}`);
      await page.goBack();
      await page.waitForURL(`**/portal/admin/school/${schools[0].id}`);
      await page.reload();
      await page.locator('button[role="combobox"]:visible').first().waitFor();
      assert.match(await page.locator('button[role="combobox"]:visible').first().innerText(), /Ikpoto/);
      await chooseView(page, 'General School — All Schools');
      await page.getByRole('heading', { name: 'General School', exact: true }).waitFor();
      assert.ok(requests.every(req => !req.schoolId || schools.some(school => school.id === req.schoolId)));
      assert.ok(requests.every(req => req.method === 'GET'));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('sub-admin keeps their dashboard and cannot open General School or another branch directly', async () => {
  const { context, page, requests, errors } = await setup('sub-admin');
  try {
    await page.goto(`${baseURL}/portal`);
    await page.getByRole('heading', { name: 'Seat of Wisdom Academy', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'General School', exact: true }).count(), 0);
    for (const path of ['general', 'schools']) {
      await page.goto(`${baseURL}/portal/admin/${path}`);
      await page.getByRole('heading', { name: 'Main administrator access required' }).waitFor();
    }
    await page.goto(`${baseURL}/portal/admin/school/${schools[1].id}`);
    await page.getByRole('heading', { name: 'School unavailable' }).waitFor();
    assert.equal(requests.some(req => req.pathname === '/api/admin/schools'), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('unknown school URL does not mount the operational dashboard', async () => {
  const { context, page, requests, errors } = await setup();
  try {
    await page.goto(`${baseURL}/portal/admin/school/general-school-view`);
    await page.getByRole('heading', { name: 'School unavailable' }).waitFor();
    assert.equal(requests.some(req => req.schoolId === 'general-school-view'), false);
    assert.equal(requests.some(req => req.pathname === '/api/admin/students/withdrawn'), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('student and signed-out direct links do not expose the management page', async () => {
  for (const role of ['student', null]) {
    const { context, page, requests, errors } = await setup(role);
    try {
      await page.goto(`${baseURL}/portal/admin/general`);
      if (role === null) await page.getByRole('button', { name: /sign in/i }).waitFor();
      else await page.getByText('404 Page Not Found', { exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'General School', exact: true }).count(), 0);
      assert.equal(requests.some(req => req.pathname === '/api/admin/schools'), false);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('existing Users and Profile routes remain reachable from General School', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(`${baseURL}/portal`);
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await page.getByRole('heading', { name: 'User Management', exact: true }).waitFor();
    await page.goBack();
    await page.getByRole('link', { name: 'Test', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Dashboard', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to Dashboard', exact: true }).click();
    await page.getByRole('heading', { name: 'General School', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('empty and unavailable branch data is displayed without invented records', async () => {
  for (const response of [[], 'error']) {
    const { context, page } = await setup('admin', undefined, response);
    try {
      await page.goto(`${baseURL}/portal/admin/general`);
      if (response === 'error') {
        await page.getByRole('alert').filter({ hasText: 'School branches could not be loaded' }).waitFor();
        await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
      } else await page.getByText('No school branches are available.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: /^Manage / }).count(), 0);
    } finally { await context.close(); }
  }
});
