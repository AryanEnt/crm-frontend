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
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "crm.teamMemberFilter.salesExecutiveId";

export function useTeamMemberFilter(persist = true) {
  const [value, setValue] = React.useState("all");

  React.useEffect(() => {
    if (!persist) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setValue(saved);
    } catch {
      /* ignore */
    }
  }, [persist]);

  const onChange = React.useCallback(
    (next: string) => {
      setValue(next);
      if (!persist) return;
      try {
        sessionStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [persist],
  );

  return { salesExecutiveId: value, setSalesExecutiveId: onChange };
}

export function TeamMemberFilter({
  value,
  onChange,
  className,
  showStatus,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
  showStatus?: boolean;
}) {
  const { user } = useAuth();
  const teamId = user?.teamIds?.[0];

  const membersQuery = useQuery({
    queryKey: ["team-members", "se", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "100",
        isActive: "true",
        roleCode: "sales_executive",
      });
      if (teamId) params.set("teamId", teamId);
      return adminApi.listUsers(params);
    },
  });

  const members: AdminUser[] = membersQuery.data?.data ?? [];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-[200px] text-xs", className)}>
        <SelectValue placeholder="Sales Executive" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Sales Executives</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.fullName}
            {showStatus && !m.isActive ? " (inactive)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Compact label used in filter bars: "Sales Executive: All ▾" */
export function TeamMemberFilterChip({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
      <span className="whitespace-nowrap">Sales Executive</span>
      <TeamMemberFilter value={value} onChange={onChange} />
    </div>
  );
}
