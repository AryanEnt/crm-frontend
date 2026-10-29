"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type AdminUser } from "@/lib/api/admin";

/** Multi-select of Sales Executives on the Team Lead's team who may see a document. */
export function DocumentVisibilityPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const teamId = user?.teamIds?.[0];
  const isTeamLead = user?.roleCode === "sales_manager";
  const isAdmin = user?.roleCode === "super_admin";

  const membersQuery = useQuery({
    queryKey: ["document-viewers", "se", teamId ?? "org"],
    enabled: isTeamLead || isAdmin,
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

  if (!isTeamLead && !isAdmin) return null;

  const members: AdminUser[] = membersQuery.data?.data ?? [];
  const selected = new Set(value);

  const toggle = (id: string, checked: boolean) => {
    if (checked) onChange([...value, id].filter((v, i, arr) => arr.indexOf(v) === i));
    else onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-foreground-muted">
        Visible to selected Sales Executives on your team. Leave empty to keep it Team Lead–only.
      </p>
      {membersQuery.isLoading ? (
        <p className="text-[13px] text-foreground-muted">Loading team…</p>
      ) : members.length === 0 ? (
        <p className="text-[13px] text-foreground-muted">No Sales Executives on your team yet.</p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
          {members.map((m) => {
            const checked = selected.has(m.id);
            return (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle(m.id, v === true)}
                    aria-label={`Share with ${m.fullName}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{m.fullName}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
