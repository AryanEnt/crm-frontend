"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { dataScopeFor } from "@/features/auth/list-scope";
import { adminApi } from "@/lib/api/admin";
import { canAccessPath } from "@/lib/permissions";

const COUNT_PARAMS = () => new URLSearchParams({ limit: "1", offset: "0" });

/**
 * Totals for sidebar badges, keyed by nav href. Query keys sit under ["users"] / ["teams"] so
 * the existing invalidations after create/update/deactivate refresh them too.
 */
export function useNavCounts(permissions: string[]): Record<string, number | undefined> {
  const { user } = useAuth();
  // A Team Lead's user list includes themself; the "My team" page doesn't.
  const selfInUsers = dataScopeFor(user, "users:view") !== "organization";
  const users = useQuery({
    queryKey: ["users", "nav-count"],
    queryFn: () => adminApi.listUsers(COUNT_PARAMS()),
    select: (result) => result.total,
    enabled: canAccessPath(permissions, "/admin/users"),
    staleTime: 60_000,
  });
  const teams = useQuery({
    queryKey: ["teams", "nav-count"],
    queryFn: () => adminApi.listTeams(COUNT_PARAMS()),
    select: (result) => result.total,
    enabled: canAccessPath(permissions, "/admin/teams"),
    staleTime: 60_000,
  });
  const userCount = users.data === undefined ? undefined : Math.max(0, users.data - (selfInUsers ? 1 : 0));
  return { "/admin/users": userCount, "/admin/teams": teams.data };
}
