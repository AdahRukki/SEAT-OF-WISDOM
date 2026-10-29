import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, schools, chooseView, baseURL } from './admin-navigation.browser.mjs';

const schoolURL = id => `${baseURL}/portal/admin/school/${id}`;
const side = page => page.locator('aside[data-testid="admin-sidebar"]');
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

for (const width of [1440, 390]) {
  test(`tuition payment status uses tuition paid, including other-fee-only payments, at ${width}px`, async () => {
    const { context, page, errors } = await setup('admin', { width, height: 1000 });
    const students = [
      { firstName: 'Unpaid', tuitionPaid: 0, nonTuitionPaid: 0 },
      { firstName: 'BooksOnly', tuitionPaid: 0, nonTuitionPaid: 1000 },
      { firstName: 'Partial', tuitionPaid: 500, nonTuitionPaid: 500 },
      { firstName: 'Full', tuitionPaid: 1000, nonTuitionPaid: 0 },
    ];
    try {
      await context.route('**/api/payments/ledger?**', route => route.fulfill({ json: {
        entries: students.map(student => ({ ...student, studentDbId: student.firstName, studentId: `SOWA/${student.firstName}`, lastName: 'Filter', className: 'Primary 1', classId: 'fixture-class', parentWhatsapp: null, studentType: 'returning', totalPaid: student.tuitionPaid + student.nonTuitionPaid, tuitionKnown: true, discountKnown: true, tuitionSource: 'scoped', totalAssigned: 1000, tuitionAssigned: 1000, discount: 0, balance: 1000 - student.tuitionPaid, paymentCount: student.firstName === 'Unpaid' ? 0 : 1, lastPaymentDate: null })),
        meta: { hasTuitionFeeType: true, hasGlobalTuition: false, hasScopedTuition: true },
      } }));
      await page.goto(`${schoolURL(schools[0].id)}?tab=finance`);
      await page.getByText('Filter Unpaid', { exact: true }).filter({ visible: true }).waitFor();
      const status = page.getByRole('combobox', { name: 'Payment Status', exact: true });
      for (const [option, included] of [
        ['No Payment (₦0 paid)', ['Unpaid', 'BooksOnly']],
        ['Partially Paid', ['Partial']],
        ['Fully Paid', ['Full']],
        ['All Students', students.map(student => student.firstName)],
      ]) {
        await status.click();
        await page.getByRole('option', { name: option, exact: true }).click();
        for (const student of students) {
          assert.equal(await page.getByText(`Filter ${student.firstName}`, { exact: true }).filter({ visible: true }).count(), included.includes(student.firstName) ? 1 : 0);
        }
      }
      await noOverflow(page);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

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

for (const width of [1440, 390]) {
  test(`Finance, Ledger and Payment Recording share one saved historical period at ${width}px`, async () => {
    const { context, page, errors } = await setup('admin', { width, height: 1000 });
    const scopes = [];
    try {
      await context.route('**/api/payments/finance-periods?**', route => route.fulfill({json:[
        {term:'First Term',session:'2026/2027'},{term:'Third Term',session:'2025/2026'},{term:'Second Term',session:'2018/2019'},
      ]}));
      for (const endpoint of ['ledger','records','entry-balances']) {
        await context.route(`**/api/payments/${endpoint}?**`, route => {
          const url = new URL(route.request().url());
          scopes.push({endpoint,term:url.searchParams.get('term'),session:url.searchParams.get('session')});
          if (endpoint !== 'ledger') return route.fulfill({json:[]});
          const historical = url.searchParams.get('session') === '2025/2026';
          return route.fulfill({json:{entries:[{studentDbId:'period-student',studentId:'SOWA/PERIOD',firstName:'Scope',lastName:historical?'Historical':'Current',classId:'period-class',className:'JSS 1',studentType:'returning',totalPaid:30000,tuitionPaid:30000,nonTuitionPaid:0,tuitionAssigned:historical?55000:105000,totalAssigned:historical?55000:105000,balance:historical?25000:75000,discount:0,discountKnown:false,tuitionKnown:true,tuitionSource:historical?'Period-specific class rate':'Current fee settings',paymentCount:1,lastPaymentDate:null}],meta:{hasTuitionFeeType:true,hasGlobalTuition:true,hasScopedTuition:historical,historical}}});
        });
      }
      await context.route('**/api/admin/financial-summary?**', route => {
        const url = new URL(route.request().url());
        scopes.push({endpoint:'summary',term:url.searchParams.get('term'),session:url.searchParams.get('session')});
        return route.fulfill({json:{totalFees:55000,totalPaid:30000,totalOutstanding:25000,actualTuitionCollected:30000,collectionRate:55,studentsOwing:1,totalRevenue:30000,totalPosFees:0,tuitionUnverifiedCount:0}});
      });
      await page.goto(`${schoolURL(schools[0].id)}?tab=finance`);
      await page.getByRole('heading',{name:'Finance',exact:true}).waitFor();
      if (width < 640) await page.getByRole('button',{name:'Filters',exact:true}).click();
      await page.getByRole('combobox',{name:'Ledger term',exact:true}).click();
      await page.getByRole('option',{name:'Third Term',exact:true}).click();
      assert.match(await page.getByRole('combobox',{name:'Finance term',exact:true}).innerText(),/Third Term/);
      assert.match(await page.getByRole('combobox',{name:'Payment records term',exact:true}).innerText(),/Third Term/);
      await page.getByRole('combobox',{name:'Payment records session',exact:true}).click();
      await page.getByRole('option',{name:'2018/2019',exact:true}).waitFor();
      await page.getByRole('option',{name:'2025/2026',exact:true}).click();
      await page.getByText('Historical Scope',{exact:true}).filter({visible:true}).waitFor();
      assert.match(await page.getByRole('combobox',{name:'Finance session',exact:true}).innerText(),/2025\/2026/);
      assert.match(await page.getByRole('combobox',{name:'Ledger session',exact:true}).innerText(),/2025\/2026/);
      for(const endpoint of ['ledger','records','summary']) assert.ok(scopes.some(scope=>scope.endpoint===endpoint&&scope.term==='Third Term'&&scope.session==='2025/2026'));
      const entryResponse=page.waitForResponse(response=>response.url().includes('/api/payments/entry-balances?')&&new URL(response.url()).searchParams.get('session')==='2025/2026');
      await page.getByRole('button',{name:'Record Payment',exact:true}).click();
      await page.getByRole('dialog').getByText('Third Term · 2025/2026',{exact:true}).waitFor();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]') !== null);
      await entryResponse;
      assert.ok(scopes.some(scope=>scope.endpoint==='entry-balances'&&scope.term==='Third Term'&&scope.session==='2025/2026'));
      await page.keyboard.press('Escape');
      await noOverflow(page);
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  });
}

test('historical class rates require explicit review and do not inherit current general rates', async () => {
  const { context,page,errors } = await setup();
  const writes=[];
  try {
    await context.route('**/api/payments/finance-periods?**',route=>route.fulfill({json:[{term:'First Term',session:'2026/2027'},{term:'Third Term',session:'2025/2026'}]}));
    await context.route('**/api/admin/fee-types?**',route=>route.fulfill({json:[{id:'tuition-fixture',name:'Tuition',amount:'0',schoolId:schools[0].id,category:'tuition',isTuition:true,isActive:true}]}));
    await context.route('**/api/admin/classes?**',route=>route.fulfill({json:[{id:'old-class',name:'JSS 1',schoolId:schools[0].id,sortOrder:1}]}));
    await context.route('**/api/admin/tuition-amounts/tuition-fixture',route=>{
      if(route.request().method()==='PUT'){writes.push(route.request().postDataJSON());return route.fulfill({json:[]});}
      return route.fulfill({json:[{classId:'old-class',amount:'999999',term:null,session:null,studentType:null}]});
    });
    await page.goto(`${schoolURL(schools[0].id)}?tab=finance`);
    await page.getByRole('combobox',{name:'Finance term',exact:true}).click();
    await page.getByRole('option',{name:'Third Term',exact:true}).click();
    await page.getByRole('combobox',{name:'Finance session',exact:true}).click();
    await page.getByRole('option',{name:'2025/2026',exact:true}).click();
    await page.getByRole('button',{name:'Edit tuition rates',exact:true}).click();
    const editor=page.getByRole('dialog');
    await editor.getByText(/Current defaults are not copied/).waitFor();
    await page.waitForFunction(()=>document.querySelector('[role="dialog"] input[type="number"]')?.value==='');
    assert.equal(await editor.getByRole('button',{name:'Save Changes',exact:true}).isEnabled(),false);
    await editor.getByRole('spinbutton').fill('55000');
    await editor.getByRole('checkbox').check();
    await editor.getByLabel('Verification reason / source',{exact:true}).fill('Reviewed approved Third Term fee schedule for 2025/2026');
    await editor.getByRole('button',{name:'Save Changes',exact:true}).click();
    await page.getByText('Historical tuition rates saved',{exact:true}).waitFor();
    assert.equal(writes.length,1);assert.equal(writes[0].term,'Third Term');assert.equal(writes[0].session,'2025/2026');
    assert.deepEqual(writes[0].amounts,[{classId:'old-class',amount:'55000',studentType:null}]);
    assert.equal(writes[0].verifiedHistoricalRate,true);assert.match(writes[0].verificationReason,/approved Third Term fee schedule/);
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
});
