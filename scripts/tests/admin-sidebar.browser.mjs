import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, schools, chooseView, baseURL } from './admin-navigation.browser.mjs';

const schoolURL = id => `${baseURL}/portal/admin/school/${id}`;
const side = page => page.locator('aside[data-testid="admin-sidebar"]');
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

test('desktop groups, active links, browser history, tooltips and saved preferences', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(`${schoolURL(schools[0].id)}?tab=finance`);
    await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
    assert.equal(await side(page).getByRole('link', { name: 'Finance', exact: true }).getAttribute('aria-current'), 'page');
    await side(page).getByRole('link', { name: 'Scores', exact: true }).click();
    await page.goBack();
    await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: 'Scores', exact: true }).waitFor();
    await side(page).getByRole('button', { name: 'Administration', exact: true }).click();
    await side(page).getByRole('button', { name: 'Collapse sidebar' }).click();
    await side(page).getByRole('link', { name: 'Finance', exact: true }).hover();
    await page.getByRole('tooltip', { name: 'Finance', exact: true }).waitFor();
    await page.reload();
    await side(page).getByRole('button', { name: 'Expand sidebar' }).click();
    assert.equal(await side(page).getByRole('button', { name: 'Administration', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.goto(`${schoolURL(schools[0].id)}?tab=activity`);
    await side(page).getByRole('link', { name: 'Activity log', exact: true }).waitFor();
    assert.equal(await side(page).getByRole('button', { name: 'Administration', exact: true }).getAttribute('aria-expanded'), 'true');
    await noOverflow(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

for (const width of [390, 820]) {
  test(`drawer keyboard, Escape focus, close on selection and full content width at ${width}px`, async () => {
    const { context, page, errors } = await setup('admin', { width, height: 1000 });
    try {
      await page.goto(schoolURL(schools[0].id));
      const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const drawer = page.getByRole('dialog');
      await drawer.getByRole('navigation', { name: 'Admin navigation' }).waitFor();
      assert.equal(await drawer.evaluate(element => element.contains(document.activeElement)), true);
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
      await trigger.click();
      await drawer.getByRole('link', { name: 'Finance', exact: true }).click();
      await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
      await page.getByText('Fixture Ikpoto', { exact: true }).filter({ visible: true }).first().waitFor();
      await drawer.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#admin-content').evaluate(element => element === document.activeElement), true);
      await noOverflow(page);
      assert.ok(await page.locator('#admin-content').evaluate(element => element.getBoundingClientRect().width) >= width - 1);
      await page.reload();
      await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
      await noOverflow(page);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('school changes retain the page and remount school-scoped content; General School selects before editing', async () => {
  const { context, page, requests, errors } = await setup();
  try {
    await page.goto(`${schoolURL(schools[0].id)}?tab=finance`);
    await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
    await chooseView(page, schools[1].name);
    await page.waitForURL(`**/portal/admin/school/${schools[1].id}?tab=finance`);
    await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
    assert.match(await page.getByRole('combobox', { name: 'School', exact: true }).innerText(), /Bonsaac/);
    await page.getByText('Fixture Bonsaac', { exact: true }).filter({ visible: true }).first().waitFor();
    assert.equal(await page.getByText('Fixture Ikpoto', { exact: true }).count(), 0);
    assert.ok(requests.some(req => req.pathname === '/api/admin/students' && req.schoolId === schools[1].id));
    await page.goBack();
    await page.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
    await chooseView(page, 'General School — All Schools');
    await page.getByRole('heading', { name: 'General School', exact: true }).waitFor();
    await side(page).getByRole('link', { name: 'Report cards', exact: true }).click();
    await page.getByRole('heading', { name: 'Choose your school', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Manage Bonsaac', exact: true }).click();
    await page.waitForURL(`**/portal/admin/school/${schools[1].id}?tab=reports`);
    await page.getByRole('heading', { name: 'Report cards', exact: true }).waitFor();
    assert.ok(requests.every(req => !req.schoolId || schools.some(school => school.id === req.schoolId)));
    assert.ok(requests.every(req => req.method === 'GET'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('sub-admin permissions guard navigation and direct links, including activity-only accounts', async () => {
  for (const permissions of [null, ['tab_activity'], ['tab_finance', 'finance_bank_reconciliation']]) {
    const { context, page, requests, errors } = await setup('sub-admin', undefined, schools, 'sub-admin', permissions);
    try {
      await page.goto(`${baseURL}/portal?tab=reports`);
      const label = permissions?.includes('tab_activity') ? 'Activity log' : permissions?.includes('tab_finance') ? 'Finance' : 'Students';
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
      for (const name of ['General School', 'Users', 'Report cards']) assert.equal(await side(page).getByRole('link', { name, exact: true }).count(), 0);
      if (label === 'Activity log') assert.equal(await side(page).getByRole('link').count(), 1);
      await page.reload();
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
      await page.goto(`${schoolURL(schools[1].id)}?tab=finance`);
      await page.getByRole('heading', { name: 'School unavailable' }).waitFor();
      assert.equal(requests.some(req => req.pathname === '/api/admin/schools'), false);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('student, score, ratings, report cards, payment ledger and reconciliation remain reachable', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(schoolURL(schools[0].id));
    for (const label of ['Students', 'Scores', 'Ratings', 'Report cards', 'Finance']) {
      await side(page).getByRole('link', { name: label, exact: true }).click();
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
    }
    await page.getByText('Bank Statement Reconciliation', { exact: true }).waitFor();
    await page.getByText('Payment Ledger & Broadsheet', { exact: true }).waitFor();
    await noOverflow(page);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});


test('student notification badges retain school-scoped pending-name-change alerts', async () => {
  const { context, page, errors } = await setup();
  try {
    await context.route('**/api/admin/name-change-requests?**', route => route.fulfill({
      json: new URL(route.request().url()).searchParams.get('schoolId') === schools[0].id ? [{ id: 'pending-name-fixture' }] : [],
    }));
    await page.goto(schoolURL(schools[0].id));
    await side(page).getByTestId('sidebar-student-notifications').waitFor();
    assert.equal(await side(page).getByTestId('sidebar-student-notifications').innerText(), '1');
    await chooseView(page, schools[1].name);
    await page.getByRole('heading', { name: 'School overview', exact: true }).waitFor();
    assert.equal(await side(page).getByTestId('sidebar-student-notifications').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
