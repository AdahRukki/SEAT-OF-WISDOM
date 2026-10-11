/** Canonical student display name. Student IDs remain the identity key. */
export function formatStudentName(person?: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
} | null): string {
  return [person?.lastName, person?.firstName, person?.middleName]
    .map(part => part?.trim()).filter(Boolean).join(" ");
}
