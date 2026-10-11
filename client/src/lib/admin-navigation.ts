// General School is a navigation destination, never a database school ID.
export const GENERAL_SCHOOL_PATH = '/admin/general';
export const SCHOOL_SELECTION_PATH = '/admin/schools';
export const GENERAL_SCHOOL_OPTION = 'general-school-view';

export function schoolManagementPath(schoolId: string): string {
  return `/admin/school/${encodeURIComponent(schoolId)}`;
}

export function schoolSelectionPath(selection: string, schools: readonly { id: string }[]): string | null {
  if (selection === GENERAL_SCHOOL_OPTION) return GENERAL_SCHOOL_PATH;
  return schools.some(school => school.id === selection) ? schoolManagementPath(selection) : null;
}

export function canOpenSchool(role: string | undefined, assignedSchoolId: string | undefined, targetSchoolId: string, schools: readonly { id: string }[]): boolean {
  if (role === 'sub-admin') return !!assignedSchoolId && targetSchoolId === assignedSchoolId;
  return role === 'admin' && schools.some(school => school.id === targetSchoolId);
}
