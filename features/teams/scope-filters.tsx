"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListFilterScope } from "@/features/auth/list-scope";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";
import { adminApi } from "@/lib/api/admin";

/**
 * Owner/team filter state for a list, shaped by the caller's data scope:
 * own → nothing, team → team-member chip, organization → owner + team selects.
 * Only filters that are shown ever reach the query params.
 */
export function useScopeFilters(
  viewPermission: string,
  { team = true }: { /** False where the endpoint has no team filter (the deal board). */ team?: boolean } = {},
) {
  const scope = useListFilterScope(viewPermission);
  const teamFilter = team && scope.teamFilter;
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(scope.teamMemberFilter);
  const [ownerUserId, setOwnerUserId] = React.useState("all");
  const [teamId, setTeamId] = React.useState("all");

  const params = React.useMemo(() => {
    const out: [string, string][] = [];
    if (scope.teamMemberFilter && salesExecutiveId !== "all") out.push(["salesExecutiveId", salesExecutiveId]);
    if (scope.ownerFilter && ownerUserId !== "all") out.push(["ownerUserId", ownerUserId]);
    if (teamFilter && teamId !== "all") out.push(["teamId", teamId]);
    return out;
  }, [scope.teamMemberFilter, scope.ownerFilter, teamFilter, salesExecutiveId, ownerUserId, teamId]);

  /** The single owner the list is narrowed to, whichever control set it; "all" when none. */
  const ownerId = scope.teamMemberFilter
    ? salesExecutiveId
    : scope.ownerFilter
      ? ownerUserId
      : "all";

  return {
    ...scope,
    teamFilter,
    salesExecutiveId,
    setSalesExecutiveId,
    ownerUserId,
    setOwnerUserId,
    teamId,
    setTeamId,
    params,
    ownerId,
    active: params.length > 0,
    reset: () => {
      setSalesExecutiveId("all");
      setOwnerUserId("all");
      setTeamId("all");
    },
  };
}

export type ScopeFilters = ReturnType<typeof useScopeFilters>;

/** Active users for org-wide owner pickers; shared cache with bulk-assign menus. */
export function useOwnerOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["users", "scope-filter"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled,
  });
}

export function ScopeFilterControls({ filters }: { filters: ScopeFilters }) {
  const owners = useOwnerOptions(filters.ownerFilter);
  const teams = useQuery({
    queryKey: ["teams", "scope-filter"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: filters.teamFilter,
  });

  return (
    <>
      {filters.teamMemberFilter ? (
        <TeamMemberFilterChip value={filters.salesExecutiveId} onChange={filters.setSalesExecutiveId} />
      ) : null}
      {filters.ownerFilter ? (
        <Select value={filters.ownerUserId} onValueChange={filters.setOwnerUserId}>
          <SelectTrigger className="w-[150px]" aria-label="Owner">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {(owners.data?.data ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {filters.teamFilter ? (
        <Select value={filters.teamId} onValueChange={filters.setTeamId}>
          <SelectTrigger className="w-[140px]" aria-label="Team">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {(teams.data?.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </>
  );
}
