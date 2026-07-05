// Per-sub-admin tab/feature permission system (Task #152).
//
// A sub-admin's `permissions` column on `users` is either:
//   - null/undefined  -> use DEFAULT_SUB_ADMIN_PERMISSIONS (legacy behavior)
//   - a string[]      -> the exact set of enabled permission keys
//
// Main admins (role === 'admin') always have every permission, regardless of
// what's stored (main admins should never be restricted).

export interface PermissionDef {
  key: string;
  label: string;
  group: "Tabs" | "Students" | "Finance";
}

// Tabs shown in the sub-admin dashboard nav. At least one must always be enabled.
export const TAB_PERMISSIONS: PermissionDef[] = [
  { key: "tab_overview", label: "Overview", group: "Tabs" },
  { key: "tab_students", label: "Students", group: "Tabs" },
  { key: "tab_scores", label: "Scores", group: "Tabs" },
  { key: "tab_grading", label: "Ratings/Grading", group: "Tabs" },
  { key: "tab_finance", label: "Finance", group: "Tabs" },
  { key: "tab_reports", label: "Reports", group: "Tabs" },
  { key: "tab_users", label: "Settings (Users)", group: "Tabs" },
  { key: "tab_news", label: "News", group: "Tabs" },
  { key: "tab_inquiries", label: "Inquiries", group: "Tabs" },
];

// Granular feature toggles nested within tabs.
export const FEATURE_PERMISSIONS: PermissionDef[] = [
  { key: "students_delete", label: "Delete student", group: "Students" },
  { key: "students_view_graduated", label: "Graduated Students card", group: "Students" },
  { key: "students_view_withdrawn", label: "Inactive/Withdrawn Students card", group: "Students" },
  { key: "finance_total_revenue", label: "Total Revenue card", group: "Finance" },
  { key: "finance_outstanding_fees", label: "Outstanding Fees card", group: "Finance" },
  { key: "finance_pos_fees", label: "POS Fees card", group: "Finance" },
  { key: "finance_class_tuition_breakdown", label: "Class Tuition Breakdown", group: "Finance" },
  { key: "finance_fee_types_management", label: "Fee Types Management", group: "Finance" },
  { key: "finance_bank_reconciliation", label: "Bank Statement Reconciliation", group: "Finance" },
];

export const ALL_PERMISSIONS: PermissionDef[] = [...TAB_PERMISSIONS, ...FEATURE_PERMISSIONS];
export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSIONS.map((p) => p.key);
export const TAB_PERMISSION_KEYS: string[] = TAB_PERMISSIONS.map((p) => p.key);

// Matches the sub-admin experience prior to Task #152: Students/Scores/Grading/Finance
// tabs visible, everything else (Overview, Reports, Users, News, Inquiries, and all
// granular feature toggles) hidden.
export const DEFAULT_SUB_ADMIN_PERMISSIONS: string[] = [
  "tab_students",
  "tab_scores",
  "tab_grading",
  "tab_finance",
];

export function getEffectivePermissions(
  role: string | undefined | null,
  permissions: string[] | null | undefined,
): string[] {
  if (role === "admin") return ALL_PERMISSION_KEYS;
  if (role !== "sub-admin") return [];
  return permissions && permissions.length > 0 ? permissions : DEFAULT_SUB_ADMIN_PERMISSIONS;
}

export function hasPermission(
  role: string | undefined | null,
  permissions: string[] | null | undefined,
  key: string,
): boolean {
  if (role === "admin") return true;
  if (role !== "sub-admin") return false;
  return getEffectivePermissions(role, permissions).includes(key);
}

export function hasAnyTabPermission(permissions: string[]): boolean {
  return permissions.some((p) => TAB_PERMISSION_KEYS.includes(p));
}

export function validatePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) {
    throw new Error("Permissions must be an array");
  }
  const invalid = permissions.filter((p) => typeof p !== "string" || !ALL_PERMISSION_KEYS.includes(p));
  if (invalid.length > 0) {
    throw new Error(`Invalid permission key(s): ${invalid.join(", ")}`);
  }
  if (!hasAnyTabPermission(permissions)) {
    throw new Error("At least one tab must remain enabled");
  }
  return Array.from(new Set(permissions));
}
