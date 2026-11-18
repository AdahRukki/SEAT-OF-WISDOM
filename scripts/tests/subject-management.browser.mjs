import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { Client } from 'pg';
import bcrypt from 'bcrypt';

const base = process.env.SUBJECT_TEST_BASE_URL;
const dbUrl = process.env.SUBJECT_TEST_DATABASE_URL;

test('dashboard, main-admin authorization, conflict review and published reports', {skip: !base || !dbUrl}, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(dbUrl).hostname));
  assert.equal(new URL(dbUrl).pathname, '/subject_management_test');
  const db = new Client({connectionString: dbUrl});
  await db.connect();
  let browser;
  try {
    const password = 'test-fixture-pwd';
    const hash = await bcrypt.hash(password, 4);
    const adminEmail = 'browser-admin@example.test';
    const student = (await db.query(`
      SELECT s.id,s.user_id,u.email,s.class_id,a.session,a.term
      FROM students s JOIN users u ON u.id=s.user_id JOIN assessments a ON a.student_id=s.id
      WHERE a.first_ca=8 LIMIT 1
    `)).rows[0];
    await db.query("UPDATE users SET password=$1,password_updated_at=NULL WHERE id=$2",[hash,student.user_id]);
    await db.query(`INSERT INTO users(email,password,first_name,last_name,role,password_updated_at)
      VALUES($1,$2,'Browser','Admin','admin',NULL)`, [adminEmail,hash]);
    const login = async email => {
      const response = await fetch(base + '/api/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}),
      });
      assert.equal(response.status,200);
      return response.json();
    };
    const admin = await login(adminEmail);
    const studentUser = await login(student.email);
    const prefix = '/api/admin/subject-management';
    const get = (path, token) => fetch(base + path, {headers: {Authorization:'Bearer ' + token}});
    assert.equal((await get(prefix + '/audit',studentUser.token)).status,403);
    const audit = await (await get(prefix + '/audit',admin.token)).json();
    const group = audit.duplicates.find(group => group.normalized_name.startsWith('AGRICULTURAL SCIENCE'));
    assert.ok(group);
    const source = audit.subjects.find(subject => group.subject_ids.includes(subject.id) && subject.assessments===330);
    const target = audit.subjects.find(subject => group.subject_ids.includes(subject.id) && subject.assessments===2);
    assert.ok(source && target);
    const params = new URLSearchParams({classId:student.class_id,session:student.session,term:student.term});
    const studentScores = '/api/student/assessments?' + params;
    const classReport = '/api/admin/report-subject-data?' + params;
    const scoresBefore = await (await get(studentScores,studentUser.token)).json();
    const reportBefore = await (await get(classReport,admin.token)).json();
    assert.equal(scoresBefore.length, 2);
    assert.ok(reportBefore.scores.some(score => score.subjectId===source.id));

    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/portal/admin/subjects');
    await page.evaluate(({token,user}) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, admin);
    await page.reload();
    await page.getByRole('button',{name:'Merge Preview',exact:true}).click();
    await page.getByLabel('Source subject').selectOption(source.id);
    await page.getByLabel('Keep subject').selectOption(target.id);
    await page.getByRole('button',{name:'Merge Subjects',exact:true}).click();
    await page.getByRole('radio',{name:/CA1 8/}).check();
    const mergeResponse = page.waitForResponse(response => response.url().endsWith('/merge-apply'));
    await page.getByRole('button',{name:'Merge Subjects',exact:true}).click();
    assert.equal((await mergeResponse).status(),200);
    await page.getByText('Subjects merged successfully').waitFor();
    const after = await (await get(prefix + '/audit',admin.token)).json();
    assert.equal(after.subjects.length,audit.subjects.length-1);
    const active = await (await get('/api/admin/subjects',admin.token)).json();
    assert.equal(active.some(subject => subject.id===source.id),false);
    assert.deepEqual(
      (await (await get(studentScores,studentUser.token)).json()).sort((a,b) => a.id.localeCompare(b.id)),
      scoresBefore.sort((a,b) => a.id.localeCompare(b.id)),
    );
    const reportAfter = await (await get(classReport,admin.token)).json();
    assert.deepEqual(reportAfter.scores.sort((a,b) => a.id.localeCompare(b.id)), reportBefore.scores.sort((a,b) => a.id.localeCompare(b.id)));

    await page.getByRole('button',{name:'Merge History',exact:true}).click();
    await page.getByRole('button',{name:'Check recovery eligibility'}).first().click();
    await page.getByText('Eligible for recovery',{exact:true}).waitFor();
    page.once('dialog', dialog => dialog.accept());
    const recoveryResponse = page.waitForResponse(response => response.url().includes('/recovery/') && response.request().method()==='POST');
    await page.getByRole('button',{name:'Restore original subjects'}).click();
    assert.equal((await recoveryResponse).status(),200);
    assert.equal((await (await get(prefix + '/audit',admin.token)).json()).subjects.length,audit.subjects.length);
    const unusedDuplicate = audit.subjects.find(subject => group.subject_ids.includes(subject.id) && subject.assessments===0);
    assert.ok(unusedDuplicate);
    await page.getByRole('button',{name:'Merge Preview',exact:true}).click();
    await page.getByLabel('Source subject').selectOption(unusedDuplicate.id);
    await page.getByLabel('Keep subject').selectOption(target.id);
    const cleanMerge = page.waitForResponse(response => response.url().endsWith('/merge-apply'));
    await page.getByRole('button',{name:'Merge Subjects',exact:true}).click();
    assert.equal((await cleanMerge).status(),200);
    await page.getByText('Subjects merged successfully').waitFor();

    await page.getByRole('button',{name:'Master Configuration',exact:true}).click();
    await page.getByLabel('Academic session').fill('2026/2027');
    await page.getByRole('button',{name:'Load saved configurations'}).click();
    await page.getByLabel('Reference class').selectOption(student.class_id);
    await page.getByRole('button',{name:'Load saved subjects'}).click();
    await page.getByRole('button',{name:'Preview saved configuration'}).click();
    await page.getByText('Saved configuration synchronisation',{exact:true}).waitFor();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button',{name:'Apply synchronisation'}).click();
    await page.getByText(/Synchronisation completed/).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await db.end();
  }
});
