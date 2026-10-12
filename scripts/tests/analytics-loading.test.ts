import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectStudentHistory } from '../../server/student-history-readiness';
import { analyticsFailure } from '../../client/src/lib/analytics-failure';
import { createAnalyticsFixture } from './analytics-database-fixture';
import { createAnalyticsHttpFixture } from './analytics-http-fixture';

test('missing setup returns a distinct protected, non-cacheable reporting error and works after the actual migration', async () => {
  const f = await createAnalyticsFixture(false);
  const http = await createAnalyticsHttpFixture(f);
  try {
    for (const endpoint of ['overview', 'periods', 'comparison?mode=session&originalSession=2025%2F2026&comparisonSession=2026%2F2027']) {
      assert.equal((await http.request(endpoint, 'sub-admin')).status, 403);
      const response = await http.request(endpoint, 'admin');
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const body = await response.json();
      assert.equal(body.code, 'STUDENT_HISTORY_NOT_READY');
      assert.equal(body.details.missingTables.length, 3);
      assert.equal(body.details.missingTriggers.length, 6);
      assert.equal(analyticsFailure(new Error(`503: ${JSON.stringify(body)}`)).title, 'History setup required');
    }
    await f.pg.exec(fs.readFileSync(new URL('../migrations/20261011_student_history.sql', import.meta.url), 'utf8'));
    assert.equal((await http.request('overview', 'admin')).status, 200);
    assert.equal((await http.request('periods', 'admin')).status, 200);
    await f.pg.exec('ALTER TABLE students DISABLE TRIGGER record_student_history');
    const disabled = await (await http.request('overview', 'admin')).json();
    assert.deepEqual(disabled.details.missingTables, []);
    assert.deepEqual(disabled.details.missingTriggers, [{ tableName: 'students', name: 'record_student_history', state: 'disabled' }]);
  } finally { await http.close(); await f.pg.close(); }
});

test('readiness also verifies immutable history and inspections do not write records', async () => {
  const f = await createAnalyticsFixture();
  try {
    const before = (await f.pg.query('SELECT count(*) AS events FROM student_status_events')).rows;
    const ready = await f.db.transaction(tx => inspectStudentHistory(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    assert.deepEqual(ready, { ready: true, missingTables: [], missingTriggers: [] });
    await f.pg.exec('ALTER TABLE student_status_events DISABLE TRIGGER student_history_immutable');
    const failed = await f.db.transaction(tx => inspectStudentHistory(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    assert.equal(failed.ready, false);
    assert.deepEqual(failed.missingTriggers, [{ tableName: 'student_status_events', name: 'student_history_immutable', state: 'disabled' }]);
    assert.deepEqual((await f.pg.query('SELECT count(*) AS events FROM student_status_events')).rows, before);
  } finally { await f.pg.close(); }
});

test('a reporting SQL failure returns a support reference without being labelled as missing history', async () => {
  const f = await createAnalyticsFixture();
  const http = await createAnalyticsHttpFixture(f);
  const originalError = console.error;
  try {
    await f.pg.exec('ALTER TABLE assessments RENAME COLUMN first_ca TO first_ca_unavailable');
    let logged = '';
    console.error = (...args: unknown[]) => { logged = String(args[0]); };
    const response = await http.request('overview', 'admin');
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.code, 'REPORT_GENERATION_FAILED');
    assert.match(body.reference, /^[a-f0-9-]{36}$/i);
    assert.ok(logged.includes(body.reference));
    assert.equal(JSON.stringify(body).includes('first_ca'), false);
    assert.equal(analyticsFailure(new Error(`500: ${JSON.stringify(body)}`)).title, 'Report request failed');
  } finally { console.error = originalError; await http.close(); await f.pg.close(); }
});

test('generic backend, proxy and permission errors do not falsely claim missing history or expose server details', () => {
  assert.equal(analyticsFailure(new Error('403: {"error":"Main admin access required"}')).title, 'Main administrator access required');
  const failure = analyticsFailure(new Error('500: {"error":"SELECT password FROM users","reference":"12345678-1234-1234-1234-123456789abc"}'));
  assert.equal(failure.title, 'Report request failed');
  assert.equal(failure.reference, '12345678-1234-1234-1234-123456789abc');
  assert.equal(failure.message.includes('password'), false);
  assert.equal(analyticsFailure(new Error('503: {"error":"Maintenance"}')).title, 'Reports temporarily unavailable');
  assert.equal(analyticsFailure(new Error('503: null')).title, 'Reports temporarily unavailable');
  assert.equal(analyticsFailure(new Error('500: <html>Proxy error</html>')).title, 'Report request failed');
  assert.equal(analyticsFailure(new TypeError('Failed to fetch')).title, 'Connection unavailable');
});

test('terminal status command reports missing configuration without attempting a live connection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sowa-status-'));
  try {
    const env = { ...process.env, DOTENV_CONFIG_PATH: path.join(dir, 'absent.env') };
    delete env.DATABASE_URL;
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-general-school-data.ts'], { env, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL is not configured/);
    assert.equal(result.stdout.includes('database driver'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
