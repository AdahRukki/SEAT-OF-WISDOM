import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenSchool, GENERAL_SCHOOL_OPTION, GENERAL_SCHOOL_PATH, schoolManagementPath, schoolSelectionPath } from '../../client/src/lib/admin-navigation';

const schools = [{ id: 'real-school-a' }, { id: 'real-school-b' }];

test('General School selects a page; only a known school selects an operational school route', () => {
  assert.equal(schoolSelectionPath(GENERAL_SCHOOL_OPTION, schools), GENERAL_SCHOOL_PATH);
  assert.equal(schoolSelectionPath('real-school-a', schools), '/admin/school/real-school-a');
  assert.equal(schoolSelectionPath('unknown', schools), null);
  assert.equal(schoolSelectionPath('', schools), null);
  assert.equal(schoolManagementPath('a/b'), '/admin/school/a%2Fb');
});

test('main admins open known schools and sub-admins stay within their assigned school', () => {
  assert.equal(canOpenSchool('admin', undefined, 'real-school-a', schools), true);
  assert.equal(canOpenSchool('admin', undefined, GENERAL_SCHOOL_OPTION, schools), false);
  assert.equal(canOpenSchool('admin', undefined, 'unknown', schools), false);
  assert.equal(canOpenSchool('sub-admin', 'real-school-a', 'real-school-a', []), true);
  assert.equal(canOpenSchool('sub-admin', 'real-school-a', 'real-school-b', schools), false);
  assert.equal(canOpenSchool('sub-admin', undefined, 'real-school-a', schools), false);
  assert.equal(canOpenSchool('student', 'real-school-a', 'real-school-a', schools), false);
  assert.equal(canOpenSchool(undefined, undefined, 'real-school-a', schools), false);
});
