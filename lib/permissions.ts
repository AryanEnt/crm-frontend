/**
 * Centralized permission helpers.
 * Do not scatter role checks in components — use these instead.
 * Authorization is permission-based (resource:action). Role is only used
 * for shell / navigation selection, never as an allow-everything bypass.
 */

export type PermissionCode = string;

/** Actions implied by resource:manage — keep in sync with backend ExpandImplies. */
const MANAGE_IMPLIES = new Set([
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "export",
  "configure",
]);

export function hasPermission(
  permissions: PermissionCode[] | undefined,
  code: PermissionCode,
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes(code)) return true;
  const [resource, action] = code.split(":");
  if (!resource || !action) return false;
  // :manage does not imply provider-specific actions such as communications:send
  if (!MANAGE_IMPLIES.has(action)) return false;
  return permissions.includes(`${resource}:manage`);
}

export function hasAnyPermission(
  permissions: PermissionCode[] | undefined,
  codes: PermissionCode[],
): boolean {
  return codes.some((code) => hasPermission(permissions, code));
}

export function hasAllPermissions(
  permissions: PermissionCode[] | undefined,
  codes: PermissionCode[],
): boolean {
  return codes.every((code) => hasPermission(permissions, code));
}

/** Navigation / feature gates keyed by required permissions. */
export const routePermissions: Record<string, PermissionCode[]> = {
  "/admin/users": ["users:view", "users:manage"],
  "/admin/teams": ["teams:view", "teams:manage"],
  "/admin/roles": ["roles:view", "roles:manage"],
  "/admin/audit-logs": ["audit:view"],
  "/admin/pipelines": ["pipelines:manage", "pipelines:view"],
  "/admin/custom-fields": ["custom_fields:view", "custom_fields:manage"],
  "/admin/lead-sources": ["lead_sources:view", "lead_sources:manage"],
  "/admin/activity-types": ["activity_types:view", "activity_types:manage"],
  "/admin/referrals": ["referrals:view", "referrals:manage"],
  "/admin/automations": ["automations:view", "automations:manage"],
  "/admin/system-activity": ["system:view", "audit:view"],
  "/admin/org-analytics": ["analytics:view"],
  "/admin/settings": ["settings:view", "settings:manage"],
  "/admin/lookup": [
    "leads:view",
    "customers:view",
    "deals:view",
    "users:view",
    "teams:view",
    "audit:view",
  ],
  "/leads": ["leads:view"],
  "/customers": ["customers:view"],
  "/deals": ["deals:view"],
  "/pipelines": ["deals:view", "pipelines:view"],
  "/analytics": ["analytics:view"],
  "/sales-funnel": ["analytics:view"],
  "/reports": ["reports:view"],
  "/forecasts": ["forecasts:view"],
  "/targets": ["targets:view"],
  "/insights": ["predictions:view"],
  "/activities": ["activities:view"],
  "/calendar": ["activities:view"],
  "/documents": ["documents:view"],
  "/email": ["email:view"],
  "/settings/email": ["email:view", "email:send"],
  "/settings/email/templates": ["email:manage"],
  "/admin/gmail": ["email:configure", "email:view"],
};

export function canAccessPath(
  permissions: PermissionCode[] | undefined,
  pathname: string,
): boolean {
  const exact = routePermissions[pathname];
  if (exact) return hasAnyPermission(permissions, exact);
  const nested = Object.entries(routePermissions).find(
    ([path]) => path !== "/" && pathname.startsWith(`${path}/`),
  );
  if (!nested) return true;
  return hasAnyPermission(permissions, nested[1]);
}

/** Operational CRM write actions — Super Admin should not have these by default. */
export const operationalWritePermissions: PermissionCode[] = [
  "leads:create",
  "leads:edit",
  "leads:delete",
  "leads:assign",
  "customers:create",
  "customers:edit",
  "customers:delete",
  "deals:create",
  "deals:edit",
  "deals:delete",
  "deals:assign",
  "activities:create",
  "activities:edit",
  "activities:delete",
  "communications:send",
  "email:send",
  "referrals:create",
  "referrals:edit",
  "documents:create",
  "documents:edit",
  "documents:delete",
];

export function hasOperationalCrmAccess(
  permissions: PermissionCode[] | undefined,
): boolean {
  return hasAnyPermission(permissions, operationalWritePermissions);
}
