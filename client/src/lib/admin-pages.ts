import { hasPermission } from '@shared/permissions';

export const ADMIN_GROUPS = ['Overview', 'Students', 'Academics', 'Finance', 'Administration'] as const;
export const ADMIN_PAGES = [
  { id: 'overview', label: 'School overview', group: 'Overview', icon: 'overview' },
  { id: 'students', label: 'Students', group: 'Students', icon: 'students' },
  { id: 'scores', label: 'Scores', group: 'Academics', icon: 'scores' },
  { id: 'grading', label: 'Ratings', group: 'Academics', icon: 'grading' },
  { id: 'finance', label: 'Finance', group: 'Finance', icon: 'finance' },
  { id: 'reports', label: 'Report cards', group: 'Academics', icon: 'reports' },
  { id: 'users', label: 'Settings', group: 'Administration', icon: 'users' },
  { id: 'news', label: 'News & notifications', group: 'Administration', icon: 'news' },
  { id: 'inquiries', label: 'Inquiries', group: 'Administration', icon: 'inquiries' },
  { id: 'activity', label: 'Activity log', group: 'Administration', icon: 'activity' },
] as const;
export type AdminPage = typeof ADMIN_PAGES[number]['id'];

export function permittedAdminPages(role: string | undefined, permissions: string[] | null | undefined) {
  return ADMIN_PAGES.filter(page => hasPermission(role, permissions, `tab_${page.id}`));
}

export function selectedAdminPage(search: string, role: string | undefined, permissions: string[] | null | undefined): AdminPage | null {
  const pages = permittedAdminPages(role, permissions);
  const requested = new URLSearchParams(search).get('tab');
  return pages.find(page => page.id === requested)?.id ?? pages[0]?.id ?? null;
}

export function adminPageHref(path: string, page: AdminPage, search = '') {
  const params = new URLSearchParams(search);
  params.set('tab', page);
  return `${path}?${params}`;
}

// Retain the requested page when a school is chosen, without copying another
// school's class, student or finance filters into the destination.
export function preserveAdminPage(path: string, search: string) {
  const requested = new URLSearchParams(search).get('tab');
  return ADMIN_PAGES.some(page => page.id === requested) ? `${path}?tab=${requested}` : path;
}
