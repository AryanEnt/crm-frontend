"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EMPTY_LEAD_FILTERS, type LeadFilters } from "@/features/leads/lead-board-state";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";
import { crmApi } from "@/lib/api/crm";

const ACTIVITY_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "scheduled", label: "Scheduled" },
  { value: "none", label: "No next action" },
] as const;

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type StageOption = { id: string; label: string };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Filter state shared by the Leads table and the Pipeline board; `?q=` and `?activity=` seed it. */
export function useLeadFilterState() {
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = React.useState(() => searchParams.get("q") ?? "");
  const search = useDebounced(searchInput, 300);
  const [stageId, setStageId] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [source, setSource] = React.useState("");
  const [activity, setActivity] = React.useState(() => {
    const v = searchParams.get("activity") ?? "";
    return ACTIVITY_OPTIONS.some((o) => o.value === v) ? v : "";
  });
  const [tag, setTag] = React.useState("");
  const scope = useScopeFilters("leads:view");

  const filters = React.useMemo<LeadFilters>(() => {
    const scoped = Object.fromEntries(scope.params);
    return {
      ...EMPTY_LEAD_FILTERS,
      search,
      salesExecutiveId: scoped.salesExecutiveId ?? "",
      ownerUserId: scoped.ownerUserId ?? "",
      teamId: scoped.teamId ?? "",
      stageId,
      priority,
      source,
      activity,
      tag,
    };
  }, [scope.params, search, stageId, priority, source, activity, tag]);

  const moreCount = [stageId, priority, source, tag].filter(Boolean).length;
  const anyFilter = !!searchInput || scope.active || !!activity || moreCount > 0;

  const clear = () => {
    setSearchInput("");
    setStageId("");
    setPriority("");
    setSource("");
    setActivity("");
    setTag("");
    scope.reset();
  };

  return {
    filters,
    searchInput,
    setSearchInput,
    stageId,
    setStageId,
    priority,
    setPriority,
    source,
    setSource,
    activity,
    setActivity,
    tag,
    setTag,
    scope,
    moreCount,
    anyFilter,
    clear,
  };
}

export type LeadFilterState = ReturnType<typeof useLeadFilterState>;

/** Search, owner scope and next-action up front; stage (when offered), priority, source and tag under "More". */
export function LeadFilterBar({ state, stageOptions }: { state: LeadFilterState; stageOptions?: StageOption[] }) {
  const sourcesQuery = useQuery({
    queryKey: ["lead-sources", "filter"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    staleTime: 5 * 60_000,
  });

  return (
    <FilterBar
      search={state.searchInput}
      onSearchChange={state.setSearchInput}
      searchPlaceholder="Search name, company, email, phone…"
      moreCount={state.moreCount}
      onClear={state.anyFilter ? state.clear : undefined}
      more={
        <>
          {stageOptions ? (
            <Select value={state.stageId || "all"} onValueChange={(v) => state.setStageId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Stage">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {stageOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={state.priority || "all"} onValueChange={(v) => state.setPriority(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={state.source || "all"} onValueChange={(v) => state.setSource(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any source</SelectItem>
              {(sourcesQuery.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-[140px] text-xs"
            placeholder="Tag"
            aria-label="Tag"
            value={state.tag}
            onChange={(e) => state.setTag(e.target.value)}
          />
        </>
      }
    >
      <ScopeFilterControls filters={state.scope} />
      <Select value={state.activity || "all"} onValueChange={(v) => state.setActivity(v === "all" ? "" : v)}>
        <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Next action">
          <SelectValue placeholder="Next action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any next action</SelectItem>
          {ACTIVITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
