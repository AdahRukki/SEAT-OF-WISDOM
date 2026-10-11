import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createAnalyticsFixture } from './analytics-database-fixture';

test('the Replit post-merge hook installs locked dependencies without invoking a schema change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sowa-post-merge-'));
  try {
    const trace = path.join(dir, 'commands');
    fs.writeFileSync(path.join(dir, 'npm'), '#!/bin/bash\nprintf \'%s\\n\' "$*" >> "$SOWA_POST_MERGE_TRACE"\n', { mode: 0o755 });
    const result = spawnSync('bash', [new URL('../post-merge.sh', import.meta.url).pathname], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, SOWA_POST_MERGE_TRACE: trace }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(trace, 'utf8').trim(), 'ci');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('release inspection reports missing and installed history accurately without writing database records', async () => {
  const f = await createAnalyticsFixture(false);
  try {
    const inspection = fs.readFileSync(new URL('../migrations/check_student_history.sql', import.meta.url), 'utf8');
    const missing = await f.pg.exec(inspection);
    assert.equal((missing[1].rows[0] as any).read_only, 'on');
    assert.equal(missing[2].rows.filter((row: any) => row.required_before_migration && !row.installed).length, 0);
    assert.equal(missing[2].rows.filter((row: any) => !row.required_before_migration && !row.installed).length, 3);
    assert.ok(missing[3].rows.every((row: any) => !row.enabled));
    // Migration is executed only in this disposable fixture, never on a live DB.
    await f.pg.exec(fs.readFileSync(new URL('../migrations/20261011_student_history.sql', import.meta.url), 'utf8'));
    const before = (await f.pg.query('SELECT count(*) AS events FROM student_status_events')).rows;
    const ready = await f.pg.exec(inspection);
    assert.ok(ready[2].rows.every((row: any) => row.installed));
    assert.equal(ready[3].rows.length, 6);
    assert.ok(ready[3].rows.every((row: any) => row.enabled));
    assert.equal(ready[4].rows.length, 4);
    assert.deepEqual((await f.pg.query('SELECT count(*) AS events FROM student_status_events')).rows, before);
  } finally { await f.pg.close(); }
});
