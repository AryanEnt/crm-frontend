"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import { useListFilterScope } from "@/features/auth/list-scope";
import { TeamMemberFilter } from "@/features/teams/team-member-filter";

export type AnalyticsFiltersState = {
  from: string;
  to: string;
  pipelineId: string;
  teamId: string;
  ownerUserId: string;
  source: string;
  anzscoId: string;
};

export function defaultAnalyticsFilters(): AnalyticsFiltersState {
  const to = new Date();
  const from = new Date(to.getFullYear(), 0, 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    pipelineId: "all",
    teamId: "all",
    ownerUserId: "all",
    source: "",
    anzscoId: "all",
  };
}

export function filtersToParams(f: AnalyticsFiltersState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.pipelineId && f.pipelineId !== "all") p.set("pipelineId", f.pipelineId);
  if (f.teamId && f.teamId !== "all") p.set("teamId", f.teamId);
  if (f.ownerUserId && f.ownerUserId !== "all") p.set("ownerUserId", f.ownerUserId);
  if (f.source.trim()) p.set("source", f.source.trim());
  if (f.anzscoId && f.anzscoId !== "all") p.set("anzscoId", f.anzscoId);
  return p;
}

/** Params for the /leads/insights endpoints (owner instead of ownerUserId; no ANZSCO). */
export function filtersToInsightParams(f: AnalyticsFiltersState): URLSearchParams {
  const p = new URLSearchParams({ owner: f.ownerUserId && f.ownerUserId !== "all" ? f.ownerUserId : "all" });
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.pipelineId && f.pipelineId !== "all") p.set("pipelineId", f.pipelineId);
  if (f.teamId && f.teamId !== "all") p.set("teamId", f.teamId);
  if (f.source.trim()) p.set("source", f.source.trim());
  return p;
}

export function AnalyticsFilterBar({
  value,
  onChange,
  showPipeline = true,
  showAnzsco = true,
}: {
  value: AnalyticsFiltersState;
  onChange: (next: AnalyticsFiltersState) => void;
  showPipeline?: boolean;
  showAnzsco?: boolean;
}) {
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
    enabled: showPipeline,
  });
  const { teamMemberFilter, ownerFilter, teamFilter } = useListFilterScope("analytics:view");
  const teamsQuery = useQuery({
    queryKey: ["teams", "analytics"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: teamFilter,
  });
  const usersQuery = useQuery({
    queryKey: ["users", "analytics", value.teamId],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100", isActive: "true" });
      if (value.teamId && value.teamId !== "all") p.set("teamId", value.teamId);
      return adminApi.listUsers(p);
    },
    enabled: ownerFilter,
  });
  const anzscoQuery = useQuery({
    queryKey: ["anzsco", "analytics"],
    queryFn: () => crmApi.searchAnzsco("engineer"),
    enabled: showAnzsco,
  });

  const set = (patch: Partial<AnalyticsFiltersState>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <div className="space-y-1">
        <Label className="text-[11px]">From</Label>
        <DatePicker aria-label="From" value={value.from} max={value.to} onChange={(from) => set({ from })} uiSize="md" />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">To</Label>
        <DatePicker aria-label="To" value={value.to} min={value.from} onChange={(to) => set({ to })} uiSize="md" />
      </div>
      {showPipeline ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Pipeline</Label>
          <Select value={value.pipelineId} onValueChange={(v) => set({ pipelineId: v })}>
            <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lead pipelines</SelectItem>
              {(pipelinesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {teamFilter ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Team</Label>
          <Select
            value={value.teamId}
            onValueChange={(v) => set({ teamId: v, ownerUserId: "all" })}
          >
            <SelectTrigger><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {(teamsQuery.data?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {ownerFilter ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Sales executive</Label>
          <Select value={value.ownerUserId} onValueChange={(v) => set({ ownerUserId: v })}>
            <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {(usersQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : teamMemberFilter ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Sales executive</Label>
          <TeamMemberFilter
            value={value.ownerUserId}
            onChange={(v) => set({ ownerUserId: v })}
            className="w-full text-sm"
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <Label className="text-[11px]">Source</Label>
        <Input
          value={value.source}
          onChange={(e) => set({ source: e.target.value })}
          placeholder="e.g. website"
        />
      </div>
      {showAnzsco ? (
        <div className="space-y-1">
          <Label className="text-[11px]">ANZSCO</Label>
          <Select value={value.anzscoId} onValueChange={(v) => set({ anzscoId: v })}>
            <SelectTrigger><SelectValue placeholder="ANZSCO" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All occupations</SelectItem>
              {(anzscoQuery.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.code} — {a.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
