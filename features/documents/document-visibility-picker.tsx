"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type AdminTeam, type AdminUser } from "@/lib/api/admin";

export type DocumentShareScope =
  | "all_teams"
  | "selected_teams"
  | "all_team_ses"
  | "selected_ses"
  | "none";

export type DocumentShareValue = {
  shareScope: DocumentShareScope;
  teamIds: string[];
  viewerUserIds: string[];
};

export function defaultShareValue(roleCode: string | undefined): DocumentShareValue {
  if (roleCode === "super_admin") {
    return { shareScope: "all_teams", teamIds: [], viewerUserIds: [] };
  }
  if (roleCode === "sales_manager") {
    return { shareScope: "all_team_ses", teamIds: [], viewerUserIds: [] };
  }
  return { shareScope: "none", teamIds: [], viewerUserIds: [] };
}

function mergeIds(current: string[], add: string[], checked: boolean) {
  if (checked) {
    const next = [...current];
    for (const id of add) if (!next.includes(id)) next.push(id);
    return next;
  }
  const drop = new Set(add);
  return current.filter((id) => !drop.has(id));
}

/** Admin: all / selected teams. Team Lead: all SEs / selected SEs on their team. */
export function DocumentVisibilityPicker({
  value,
  onChange,
}: {
  value: DocumentShareValue;
  onChange: (next: DocumentShareValue) => void;
}) {
  const { user } = useAuth();
  const teamId = user?.teamIds?.[0];
  const isTeamLead = user?.roleCode === "sales_manager";
  const isAdmin = user?.roleCode === "super_admin";

  const membersQuery = useQuery({
    queryKey: ["document-share", "se", teamId ?? "none"],
    enabled: isTeamLead,
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

  const teamsQuery = useQuery({
    queryKey: ["document-share", "teams"],
    enabled: isAdmin,
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  if (!isTeamLead && !isAdmin) return null;

  if (isAdmin) {
    return (
      <AdminSharePicker
        value={value}
        onChange={onChange}
        teams={teamsQuery.data?.data ?? []}
        loading={teamsQuery.isLoading}
      />
    );
  }

  return (
    <TeamLeadSharePicker
      value={value}
      onChange={onChange}
      members={membersQuery.data?.data ?? []}
      loading={membersQuery.isLoading}
    />
  );
}

function ScopeOption({
  checked,
  label,
  description,
  onSelect,
}: {
  checked: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label className="flex cursor-pointer gap-2 rounded-md border border-border px-2.5 py-2 hover:bg-surface-muted has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
      <input
        type="radio"
        className="mt-0.5"
        checked={checked}
        onChange={onSelect}
        aria-label={label}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span className="block text-[12px] text-foreground-muted">{description}</span>
      </span>
    </label>
  );
}

function AdminSharePicker({
  value,
  onChange,
  teams,
  loading,
}: {
  value: DocumentShareValue;
  onChange: (next: DocumentShareValue) => void;
  teams: AdminTeam[];
  loading: boolean;
}) {
  const selected = new Set(value.teamIds);
  const allIds = teams.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id));
  const recipientCount =
    value.shareScope === "all_teams"
      ? teams.reduce((n, t) => n + (t.members?.length ?? 0) + (t.teamLeadUserId ? 1 : 0), 0)
      : teams
          .filter((t) => selected.has(t.id))
          .reduce((n, t) => n + (t.members?.length ?? 0) + (t.teamLeadUserId ? 1 : 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <ScopeOption
          checked={value.shareScope === "all_teams"}
          label="All teams"
          description="Every Team Lead and Sales Executive in the organization."
          onSelect={() => onChange({ shareScope: "all_teams", teamIds: [], viewerUserIds: [] })}
        />
        <ScopeOption
          checked={value.shareScope === "selected_teams"}
          label="Selected teams"
          description="Only members of the teams you choose."
          onSelect={() =>
            onChange({
              shareScope: "selected_teams",
              teamIds: value.teamIds,
              viewerUserIds: [],
            })
          }
        />
      </div>

      {value.shareScope === "selected_teams" ? (
        <div className="space-y-2">
          <Label>Teams</Label>
          {loading ? (
            <p className="text-[13px] text-foreground-muted">Loading teams…</p>
          ) : teams.length === 0 ? (
            <p className="text-[13px] text-foreground-muted">No active teams yet.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              <li>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) =>
                      onChange({
                        shareScope: "selected_teams",
                        teamIds: v === true ? allIds : [],
                        viewerUserIds: [],
                      })
                    }
                    aria-label="Select all teams"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    Select all teams
                  </span>
                </label>
              </li>
              {teams.map((team) => (
                <li key={team.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted">
                    <Checkbox
                      checked={selected.has(team.id)}
                      onCheckedChange={(v) =>
                        onChange({
                          shareScope: "selected_teams",
                          teamIds: mergeIds(value.teamIds, [team.id], v === true),
                          viewerUserIds: [],
                        })
                      }
                      aria-label={`Share with ${team.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{team.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-[12px] text-foreground-muted">
        {value.shareScope === "all_teams"
          ? `Shared with all teams (${teams.length}).`
          : value.teamIds.length === 0
            ? "Select at least one team."
            : `${value.teamIds.length} team${value.teamIds.length === 1 ? "" : "s"} selected · ~${recipientCount} recipients.`}
      </p>
    </div>
  );
}

function TeamLeadSharePicker({
  value,
  onChange,
  members,
  loading,
}: {
  value: DocumentShareValue;
  onChange: (next: DocumentShareValue) => void;
  members: AdminUser[];
  loading: boolean;
}) {
  const selected = new Set(value.viewerUserIds);
  const allIds = members.map((m) => m.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id));

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <ScopeOption
          checked={value.shareScope === "all_team_ses"}
          label="All Sales Executives on my team"
          description="Every SE currently on your team. Access updates if membership changes."
          onSelect={() => onChange({ shareScope: "all_team_ses", teamIds: [], viewerUserIds: [] })}
        />
        <ScopeOption
          checked={value.shareScope === "selected_ses"}
          label="Selected Sales Executives"
          description="Only the people you choose on your team."
          onSelect={() =>
            onChange({
              shareScope: "selected_ses",
              teamIds: [],
              viewerUserIds: value.viewerUserIds,
            })
          }
        />
      </div>

      {value.shareScope === "selected_ses" ? (
        <div className="space-y-2">
          <Label>Sales Executives</Label>
          {loading ? (
            <p className="text-[13px] text-foreground-muted">Loading team…</p>
          ) : members.length === 0 ? (
            <p className="text-[13px] text-foreground-muted">No Sales Executives on your team yet.</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
              <li>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) =>
                      onChange({
                        shareScope: "selected_ses",
                        teamIds: [],
                        viewerUserIds: v === true ? allIds : [],
                      })
                    }
                    aria-label="Select all Sales Executives"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    Select all
                  </span>
                </label>
              </li>
              {members.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted">
                    <Checkbox
                      checked={selected.has(m.id)}
                      onCheckedChange={(v) =>
                        onChange({
                          shareScope: "selected_ses",
                          teamIds: [],
                          viewerUserIds: mergeIds(value.viewerUserIds, [m.id], v === true),
                        })
                      }
                      aria-label={`Share with ${m.fullName}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{m.fullName}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-[12px] text-foreground-muted">
        {value.shareScope === "all_team_ses"
          ? `Shared with all ${members.length} Sales Executive${members.length === 1 ? "" : "s"} on your team.`
          : value.viewerUserIds.length === 0
            ? "Select at least one Sales Executive."
            : `${value.viewerUserIds.length} recipient${value.viewerUserIds.length === 1 ? "" : "s"} selected.`}
      </p>
    </div>
  );
}
