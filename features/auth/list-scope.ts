"use client";

import { useAuth } from "@/features/auth/auth-provider";
import type { SessionUser } from "@/features/auth/types";

export type DataScope = "own" | "team" | "organization";

/**
 * Row visibility for a list, matching the backend's datascope.Resolve: the session's
 * scope for the view permission, else the role default. The server enforces this on
 * every list query; the client only uses it to decide which filters mean anything.
 */
export function dataScopeFor(user: SessionUser | null, viewPermission: string): DataScope {
  const scoped = user?.permissionScopes?.[viewPermission];
  if (scoped === "own" || scoped === "team" || scoped === "organization") return scoped;
  if (user?.roleCode === "super_admin") return "organization";
  if (user?.roleCode === "sales_manager") return "team";
  return "own";
}

export type ListFilterScope = {
  scope: DataScope;
  /** Team scope: narrow to one member of the caller's team (`salesExecutiveId`). */
  teamMemberFilter: boolean;
  /** Organization scope: any owner (`ownerUserId`). */
  ownerFilter: boolean;
  /** Organization scope: any team (`teamId`). Team Leads belong to exactly one team, so never for team scope. */
  teamFilter: boolean;
};

/**
 * Which cross-record filters a list should offer. Own scope gets none and must not
 * send owner/team params: every visible row already belongs to the caller.
 */
export function useListFilterScope(viewPermission: string): ListFilterScope {
  const { user, can } = useAuth();
  const scope = dataScopeFor(user, viewPermission);
  return {
    scope,
    teamMemberFilter: scope === "team",
    ownerFilter: scope === "organization" && can("users:view"),
    teamFilter: scope === "organization" && can("teams:view"),
  };
}
