import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against the local Vite frontend. All APIs are intercepted; no database is used.
export const baseURL = process.env.NAVIGATION_TEST_URL || 'http://127.0.0.1:5173';
export const schools = ['Ikpoto', 'Bonsaac', 'Akwuofor', 'Akwuose'].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`, name,
  currentTerm: i === 3 ? null : 'First Term', currentSession: i === 3 ? null : '2026/2027',
}));
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

export async function setup(role = 'admin', viewport = { width: 1440, height: 1000 }, schoolResponse = schools, loginRole = role, permissions = null) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  await context.addInitScript(() => { if (!sessionStorage.getItem('navigation-fixture')) { localStorage.clear(); sessionStorage.setItem('navigation-fixture', '1'); } localStorage.setItem('auth_token', 'navigation-test-only'); });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  let authenticatedRole = role;
  const authUser = () => authenticatedRole === null ? null : { id: `test-${authenticatedRole}`, role: authenticatedRole, schoolId: schools[0].id, firstName: 'Test', lastName: 'Admin', permissions };
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ pathname: url.pathname, schoolId: url.searchParams.get('schoolId'), method: req.method() });
    let body = [];
    if (url.pathname.startsWith('/api/admin/analytics/')) return route.fulfill({ status: 503, json: { error: 'Reporting unavailable in navigation fixture' } });
    if (url.pathname === '/api/auth/login' && req.method() === 'POST') {
      authenticatedRole = loginRole;
      body = { token: 'navigation-login-test-only', user: authUser() };
    }
    if (url.pathname === '/api/auth/me') body = authUser();
    if (url.pathname === '/api/admin/schools') {
      if (schoolResponse === 'error') return route.fulfill({ status: 500, json: { error: 'Test failure' } });
      body = schoolResponse;
    }
    if (url.pathname === '/api/current-academic-info') body = { currentTerm: 'First Term', currentSession: '2026/2027' };
    if (url.pathname === '/api/admin/activity-logs') body = { logs: [], total: 0, page: 1, pageSize: 25 };
    if (url.pathname === '/api/logo') body = { logoUrl: '/favicon.png' };
    if (url.pathname.includes('financial-summary')) body = { totalCollected: 0, totalExpected: 0, totalOutstanding: 0, confirmedPayments: 0 };
    if (url.pathname.includes('ledger')) {
      const school = schools.find(item => item.id === url.searchParams.get('schoolId')) || schools[0];
      body = { entries: [{ studentDbId: 'fixture-student', studentId: 'SOWA/TEST', firstName: school.name, lastName: 'Fixture', className: 'Primary 1', classId: 'fixture-class', parentWhatsapp: null, studentType: 'returning', totalPaid: 1000, tuitionPaid: 1000, nonTuitionPaid: 0, tuitionKnown: true, discountKnown: true, tuitionSource: 'scoped', totalAssigned: 2000, tuitionAssigned: 2000, discount: 0, balance: 1000, paymentCount: 1, lastPaymentDate: '2026-10-01' }], meta: { hasTuitionFeeType: true, hasGlobalTuition: false, hasScopedTuition: true } };
    }
    if (url.pathname === '/api/admin/payment-broadsheet') body = { classes: [], grandTotal: { totalAssigned: 0, totalPaid: 0, balance: 0 } };
    await route.fulfill({ json: body });
  });
  return { context, page, requests, errors };
}

export async function chooseView(page, name) {
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
      if (viewport.width < 1024) {
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await page.getByRole('dialog').getByRole('link', { name: 'Choose a school', exact: true }).click();
      } else await page.locator('aside').getByRole('link', { name: 'Choose a school', exact: true }).click();
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
    await page.getByRole('heading', { name: 'Students', exact: true }).waitFor();
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

test('legacy doubled portal links redirect to the canonical portal with role access preserved', async () => {
  for (const role of ['admin', 'sub-admin', 'student', null]) {
    const { context, page, requests, errors } = await setup(role);
    try {
      await page.goto(`${baseURL}/portal/portal`);
      await page.waitForURL(`${baseURL}/portal`);
      if (role === null) await page.getByRole('button', { name: /sign in/i }).waitFor();
      else await page.getByRole('heading', { name: role === 'admin' ? 'General School' : role === 'sub-admin' ? 'Students' : 'Seat of Wisdom Academy', exact: true }).waitFor();
      await page.reload();
      if (role === null) await page.getByRole('button', { name: /sign in/i }).waitFor();
      else await page.getByRole('heading', { name: role === 'admin' ? 'General School' : role === 'sub-admin' ? 'Students' : 'Seat of Wisdom Academy', exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/portal');
      if (role === 'student' || role === null) {
        assert.equal(await page.getByRole('heading', { name: 'General School', exact: true }).count(), 0);
        assert.equal(requests.some(req => req.pathname === '/api/admin/schools' || req.pathname.startsWith('/api/admin/analytics/')), false);
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('successful sign-in opens the canonical portal without doubling its prefix', async () => {
  for (const role of ['admin', 'sub-admin', 'student']) {
    const { context, page, errors } = await setup(null, undefined, schools, role);
    try {
      await page.goto(`${baseURL}/portal/login`);
      await page.getByLabel('Email or Student ID', { exact: true }).fill('routing-test@example.com');
      await page.getByLabel('Password', { exact: true }).fill('routing-fixture-only');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL(`${baseURL}/portal`);
      await page.getByRole('heading', { name: role === 'admin' ? 'General School' : role === 'sub-admin' ? 'Students' : 'Seat of Wisdom Academy', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: role === 'admin' ? 'General School' : role === 'sub-admin' ? 'Students' : 'Seat of Wisdom Academy', exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
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
    await page.locator('aside').getByRole('link', { name: 'Users', exact: true }).click();
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
