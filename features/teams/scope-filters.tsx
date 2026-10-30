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

const ALL = "all";

/**
 * Owner/team filter state for a list, shaped by the caller's data scope:
 * own → nothing, team → team-member chip, organization → team then individual.
 * Only filters that are shown ever reach the query params.
 */
export function useScopeFilters(
  viewPermission: string,
  { team = true }: { /** False where the endpoint has no team filter (the deal board). */ team?: boolean } = {},
) {
  const scope = useListFilterScope(viewPermission);
  const teamFilter = team && scope.teamFilter;
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(scope.teamMemberFilter);
  const [ownerUserId, setOwnerUserId] = React.useState(ALL);
  const [teamId, setTeamId] = React.useState(ALL);

  const params = React.useMemo(() => {
    const out: [string, string][] = [];
    if (scope.teamMemberFilter && salesExecutiveId !== ALL) out.push(["salesExecutiveId", salesExecutiveId]);
    if (scope.ownerFilter && ownerUserId !== ALL) out.push(["ownerUserId", ownerUserId]);
    if (teamFilter && teamId !== ALL) out.push(["teamId", teamId]);
    return out;
  }, [scope.teamMemberFilter, scope.ownerFilter, teamFilter, salesExecutiveId, ownerUserId, teamId]);

  /** The single owner the list is narrowed to, whichever control set it; "all" when none. */
  const ownerId = scope.teamMemberFilter
    ? salesExecutiveId
    : scope.ownerFilter
      ? ownerUserId
      : ALL;

  return {
    ...scope,
    teamFilter,
    salesExecutiveId,
    setSalesExecutiveId,
    ownerUserId,
    setOwnerUserId,
    teamId,
    setTeamId: (id: string) => {
      setTeamId(id);
      setOwnerUserId(ALL);
    },
    params,
    ownerId,
    active: params.length > 0,
    reset: () => {
      setSalesExecutiveId(ALL);
      setOwnerUserId(ALL);
      setTeamId(ALL);
    },
  };
}

export type ScopeFilters = ReturnType<typeof useScopeFilters>;

/** Active sales executives for owner pickers. Team leads are not assignable owners. */
export function useOwnerOptions(enabled: boolean, teamId?: string) {
  const team = teamId && teamId !== ALL ? teamId : "";
  return useQuery({
    queryKey: ["users", "assignable-owners", team || ALL],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100", isActive: "true", roleCode: "sales_executive" });
      if (team) params.set("teamId", team);
      return adminApi.listUsers(params);
    },
    enabled,
  });
}

export function useTeamOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["teams", "scope-filter"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled,
  });
}

/** Organization-scope All / Team / Individual selects. Team first so individuals can be that team's members. */
export function OrgScopeSelects({
  teamId,
  ownerUserId,
  onTeamChange,
  onOwnerChange,
  showTeam,
  showOwner,
}: {
  teamId: string;
  ownerUserId: string;
  onTeamChange: (id: string) => void;
  onOwnerChange: (id: string) => void;
  showTeam: boolean;
  showOwner: boolean;
}) {
  const teamValue = teamId || ALL;
  const ownerValue = ownerUserId || ALL;
  const owners = useOwnerOptions(showOwner, teamValue);
  const teams = useTeamOptions(showTeam);
  const ownerList = owners.data?.data ?? [];

  if (!showTeam && !showOwner) return null;

  return (
    <>
      {showTeam ? (
        <Select value={teamValue} onValueChange={(v) => onTeamChange(v === ALL ? "" : v)}>
          <SelectTrigger className="w-[150px]" aria-label="Team">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>
            {(teams.data?.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {showOwner ? (
        <Select value={ownerValue} onValueChange={(v) => onOwnerChange(v === ALL ? "" : v)}>
          <SelectTrigger className="w-[170px]" aria-label="Individual">
            <SelectValue placeholder="Individual" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{teamValue !== ALL ? "Anyone on team" : "All individuals"}</SelectItem>
            {ownerList.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </>
  );
}

export function ScopeFilterControls({ filters }: { filters: ScopeFilters }) {
  return (
    <>
      {filters.teamMemberFilter ? (
        <TeamMemberFilterChip value={filters.salesExecutiveId} onChange={filters.setSalesExecutiveId} />
      ) : null}
      <OrgScopeSelects
        teamId={filters.teamId === ALL ? "" : filters.teamId}
        ownerUserId={filters.ownerUserId === ALL ? "" : filters.ownerUserId}
        onTeamChange={(id) => filters.setTeamId(id || ALL)}
        onOwnerChange={(id) => filters.setOwnerUserId(id || ALL)}
        showTeam={filters.teamFilter}
        showOwner={filters.ownerFilter}
      />
    </>
  );
}
