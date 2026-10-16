import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_PAGES, ADMIN_GROUPS, permittedAdminPages, selectedAdminPage, adminPageHref, preserveAdminPage } from '../../client/src/lib/admin-pages';
import { TAB_PERMISSIONS } from '../../shared/permissions';

test('all existing pages retain their permissions and logical groups', () => {
  assert.deepEqual(ADMIN_PAGES.map(page => `tab_${page.id}`).sort(), TAB_PERMISSIONS.map(permission => permission.key).sort());
  assert.deepEqual([...ADMIN_GROUPS], ['Overview', 'Students', 'Academics', 'Finance', 'Administration']);
  assert.equal(permittedAdminPages('admin', []).length, 10);
  assert.deepEqual(permittedAdminPages('sub-admin', null).map(page => page.id), ['students', 'scores', 'grading', 'finance']);
  assert.deepEqual(permittedAdminPages('student', null), []);
});
test('direct links and changed permissions cannot select a forbidden page', () => {
  assert.equal(selectedAdminPage('?tab=finance', 'admin', null), 'finance');
  assert.equal(selectedAdminPage('?tab=reports', 'sub-admin', null), 'students');
  assert.equal(selectedAdminPage('?tab=activity', 'sub-admin', ['tab_activity']), 'activity');
  assert.equal(selectedAdminPage('?tab=students', 'sub-admin', ['tab_finance']), 'finance');
  assert.equal(selectedAdminPage('?tab=unknown', 'admin', null), 'overview');
  assert.equal(selectedAdminPage('?tab=finance', 'student', null), null);
});
test('school changes retain only the valid page, without stale class/student filters', () => {
  assert.equal(adminPageHref('/admin', 'finance', '?existing=yes'), '/admin?existing=yes&tab=finance');
  assert.equal(preserveAdminPage('/admin/school/new-school', '?tab=finance&classId=old&studentId=old'), '/admin/school/new-school?tab=finance');
  assert.equal(preserveAdminPage('/admin/school/new-school', '?tab=unknown'), '/admin/school/new-school');
});
