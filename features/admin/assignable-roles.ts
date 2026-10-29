/** Roles hidden from create/edit pickers and role filters for now. */
const HIDDEN_ROLE_CODES = new Set(["sales_support"]);

/** Roles you can assign in the UI. Keeps a hidden role if the user already has it. */
export function assignableRoles<T extends { id: string; code: string }>(
  roles: T[],
  currentRoleId?: string | null,
): T[] {
  return roles.filter((role) => !HIDDEN_ROLE_CODES.has(role.code) || role.id === currentRoleId);
}
