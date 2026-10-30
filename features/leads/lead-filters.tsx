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
import { EMPTY_LEAD_FILTERS, leadFilterParams, type LeadFilters } from "@/features/leads/lead-board-state";
import { countryFilterLabel } from "@/features/leads/lead-format";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";
import { crmApi } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

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

/** Filter state shared by the Leads table and the Pipeline board; URL query seeds it. */
export function useLeadFilterState() {
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = React.useState(() => searchParams.get("q") ?? "");
  const search = useDebounced(searchInput, 300);
  const [stageId, setStageId] = React.useState(() => searchParams.get("stageId") ?? "");
  const [priority, setPriority] = React.useState("");
  const [source, setSource] = React.useState("");
  const [activity, setActivity] = React.useState(() => {
    const v = searchParams.get("activity") ?? "";
    return ACTIVITY_OPTIONS.some((o) => o.value === v) ? v : "";
  });
  const [tag, setTag] = React.useState("");
  const [country, setCountry] = React.useState(() => searchParams.get("country") ?? "");
  const [createdFrom, setCreatedFrom] = React.useState(() => searchParams.get("createdFrom") ?? "");
  const [createdTo, setCreatedTo] = React.useState(() => searchParams.get("createdTo") ?? "");
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
      country,
      createdFrom,
      createdTo,
    };
  }, [scope.params, search, stageId, priority, source, activity, tag, country, createdFrom, createdTo]);

  const moreCount = [stageId, priority, source, tag, createdFrom, createdTo].filter(Boolean).length;
  const anyFilter = !!searchInput || scope.active || !!activity || !!country || moreCount > 0;

  const clear = () => {
    setSearchInput("");
    setStageId("");
    setPriority("");
    setSource("");
    setActivity("");
    setTag("");
    setCountry("");
    setCreatedFrom("");
    setCreatedTo("");
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
    country,
    setCountry,
    createdFrom,
    setCreatedFrom,
    createdTo,
    setCreatedTo,
    scope,
    moreCount,
    anyFilter,
    clear,
  };
}

export type LeadFilterState = ReturnType<typeof useLeadFilterState>;

function CountryFilterSelect({
  value,
  onChange,
  filters,
}: {
  value: string;
  onChange: (country: string) => void;
  filters: LeadFilters;
}) {
  // Facet counts ignore the country filter itself so every option stays visible while selected.
  const facetParams = React.useMemo(() => {
    const p = leadFilterParams("", { ...filters, country: "" });
    p.set("status", "all");
    return p;
  }, [filters]);

  const countriesQuery = useQuery({
    queryKey: ["leads", "countries", facetParams.toString()],
    queryFn: () => crmApi.listLeadCountries(facetParams),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const options = countriesQuery.data ?? [];
  const selectedStillPresent = !value || options.some((o) => o.country === value);
  const totalAll = options.reduce((sum, o) => sum + o.count, 0);

  return (
    <Select
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? "" : v)}
    >
      <SelectTrigger
        className={cn("h-8 w-[180px] text-xs", value && "border-brand-border bg-brand-soft text-brand")}
        aria-label="Country"
      >
        <SelectValue placeholder="All Countries" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">
          {countriesQuery.isSuccess
            ? `All Countries (${totalAll.toLocaleString("en-AU")})`
            : "All Countries"}
        </SelectItem>
        {!selectedStillPresent && value ? (
          <SelectItem value={value}>{countryFilterLabel(value)}</SelectItem>
        ) : null}
        {options.map((o) => (
          <SelectItem key={o.country} value={o.country}>
            {`${countryFilterLabel(o.country)} (${o.count.toLocaleString("en-AU")})`}
          </SelectItem>
        ))}
        {countriesQuery.isSuccess && options.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-ink-muted">No countries in this view</div>
        ) : null}
      </SelectContent>
    </Select>
  );
}

/** Search, owner scope, next-action and country up front; stage/priority/source/tag under "More". */
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
      <CountryFilterSelect value={state.country} onChange={state.setCountry} filters={state.filters} />
      {state.createdFrom || state.createdTo ? (
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 text-xs text-ink"
          onClick={() => {
            state.setCreatedFrom("");
            state.setCreatedTo("");
          }}
          title="Clear date range"
        >
          Created: {[state.createdFrom, state.createdTo].filter(Boolean).join(" → ")}
          <span className="text-ink-muted" aria-hidden>
            ×
          </span>
        </button>
      ) : null}
    </FilterBar>
  );
}
