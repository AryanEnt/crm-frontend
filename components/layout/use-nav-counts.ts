"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { dataScopeFor } from "@/features/auth/list-scope";
import { LEAD_PIPELINE_ID, NURTURING_PIPELINE_ID } from "@/features/leads/lead-board-state";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import { LEAD_PIPELINE_HREF, NURTURING_PIPELINE_HREF } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";

const COUNT_PARAMS = () => new URLSearchParams({ limit: "1", offset: "0" });

function overdueLeadParams(pipelineId: string) {
  return new URLSearchParams({
    pipelineId,
    activity: "overdue",
    status: "open",
    limit: "1",
    offset: "0",
  });
}

/**
 * Totals for sidebar badges, keyed by nav href. Query keys sit under ["users"] / ["teams"] /
 * ["leads"] so the existing invalidations after create/update/move refresh them too.
 */
export function useNavCounts(permissions: string[]): Record<string, number | undefined> {
  const { user } = useAuth();
  // A Team Lead's user list includes themself; the "My team" page doesn't.
  const selfInUsers = dataScopeFor(user, "users:view") !== "organization";
  const canPipeline = canAccessPath(permissions, "/pipeline");

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

  const leadOverdue = useQuery({
    queryKey: ["leads", "nav-overdue", LEAD_PIPELINE_ID],
    queryFn: () => crmApi.listLeads(overdueLeadParams(LEAD_PIPELINE_ID)),
    select: (result) => result.total,
    enabled: canPipeline,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const nurturingOverdue = useQuery({
    queryKey: ["leads", "nav-overdue", NURTURING_PIPELINE_ID],
    queryFn: () => crmApi.listLeads(overdueLeadParams(NURTURING_PIPELINE_ID)),
    select: (result) => result.total,
    enabled: canPipeline,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const userCount = users.data === undefined ? undefined : Math.max(0, users.data - (selfInUsers ? 1 : 0));
  return {
    "/admin/users": userCount,
    "/admin/teams": teams.data,
    [LEAD_PIPELINE_HREF]: leadOverdue.data,
    [NURTURING_PIPELINE_HREF]: nurturingOverdue.data,
  };
}
