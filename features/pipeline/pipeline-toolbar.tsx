"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { useListFilterScope } from "@/features/auth/list-scope";
import { countryFilterLabel } from "@/features/leads/lead-format";
import { OrgScopeSelects, useOwnerOptions, useTeamOptions } from "@/features/teams/scope-filters";
import { TeamMemberFilterChip } from "@/features/teams/team-member-filter";
import { crmApi, type PipelineStage } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { ClosedSortSelect } from "./closed-filters";
import { CLOSED_RANGE_OPTIONS, type ClosedRange } from "./closed-range";
import {
  NEXT_ACTION_OPTIONS,
  PIPELINE_WORK_CHIPS,
  activeFilterChips,
  applyPipelineWork,
  clearAllFilters,
  clearFilter,
  cleanAmount,
  isClosedStatus,
  isWorkChipActive,
  statusOptions,
  type NextActionFilter,
  type PipelineFilters,
} from "./pipeline-filters";
import { currencySymbol } from "./pipeline-format";
import type { PipelineStatus } from "./pipeline-totals";
import { PipelineViewToggle } from "./pipeline-view-toggle";

const ANY = "any";

function useFilterNames(filters: PipelineFilters) {
  const { user } = useAuth();
  const scope = useListFilterScope("leads:view");
  const teamId = filters.team || (scope.teamMemberFilter ? user?.teamIds?.[0] : "") || "";
  const owners = useOwnerOptions(scope.ownerFilter || scope.teamMemberFilter, teamId || undefined);
  const teams = useTeamOptions(scope.teamFilter);
  return {
    scope,
    ownerName: owners.data?.data.find((u) => u.id === filters.owner)?.fullName,
    teamName: teams.data?.data.find((t) => t.id === filters.team)?.name,
  };
}

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function secondaryFilterCount(filters: PipelineFilters, closedView: boolean, showStage: boolean): number {
  let n = 0;
  if (filters.owner) n += 1;
  if (filters.team) n += 1;
  if (filters.source) n += 1;
  if (filters.country) n += 1;
  if (filters.min || filters.max) n += 1;
  if (showStage && filters.stage) n += 1;
  if (closedView) {
    if (filters.closed) n += 1;
  } else {
    if (filters.next) n += 1;
    if (filters.attention) n += 1;
  }
  return n;
}

export function PipelineToolbar({
  filters,
  counts,
  currency,
  stages = [],
  nurturing = false,
  onChange,
}: {
  filters: PipelineFilters;
  counts: Record<PipelineStatus, number> | null;
  currency: string;
  stages?: PipelineStage[];
  nurturing?: boolean;
  onChange: (next: PipelineFilters) => void;
}) {
  const names = useFilterNames(filters);
  const stageName = stages.find((s) => s.id === filters.stage)?.name;
  const chips = activeFilterChips(filters, {
    owner: names.ownerName,
    team: names.teamName,
    stage: stageName,
    currencySymbol: currencySymbol(currency),
    nurturing,
  }).filter((chip) => chip.key !== "next" && chip.key !== "attention");
  const closedView = isClosedStatus(filters.status);
  const showStageFilter = filters.view === "table" && !closedView;
  const filterCount = secondaryFilterCount(filters, closedView, showStageFilter);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField filters={filters} onChange={onChange} />
        {!closedView ? (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Work on">
            {PIPELINE_WORK_CHIPS.map((chip) => {
              const on = isWorkChipActive(filters, chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(applyPipelineWork(filters, chip.id))}
                  className={cn(
                    "h-8 rounded-full px-3 text-caption font-medium transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on
                      ? chip.id === "overdue" || chip.id === "stuck"
                        ? "bg-danger-soft text-danger"
                        : chip.id === "today"
                          ? "bg-warning-soft text-warning"
                          : "bg-brand-soft text-brand-ink"
                      : "bg-surface-muted text-ink-secondary hover:bg-surface-muted/80 hover:text-ink",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        ) : null}
        <SegmentedControl
          ariaLabel="Lead status"
          value={filters.status}
          onChange={(status) => {
            const next = { ...filters, status, page: 1 };
            if (isClosedStatus(status) && next.sort === "next") {
              next.sort = "closed";
              next.order = "desc";
            }
            if (isClosedStatus(status)) next.stage = "";
            else if (status === "open" && next.stage) {
              const st = stages.find((s) => s.id === next.stage);
              if (st?.isWon || st?.isLost) next.stage = "";
            }
            onChange(next);
          }}
          options={statusOptions(nurturing).map((o) => ({ ...o, count: counts?.[o.value] }))}
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FiltersPanel
            filters={filters}
            currency={currency}
            stages={stages}
            closedView={closedView}
            showStageFilter={showStageFilter}
            filterCount={filterCount}
            scope={names.scope}
            onChange={onChange}
          />
          {closedView ? <ClosedSortSelect filters={filters} onChange={onChange} /> : null}
          <PipelineViewToggle filters={filters} onChange={onChange} />
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters" role="group">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-soft pl-3 pr-1 text-caption font-medium text-brand-ink"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove filter ${chip.label}`}
                onClick={() => onChange(clearFilter(filters, chip.key))}
                className="inline-flex size-5 items-center justify-center rounded-full hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange(clearAllFilters(filters))}
            className="ml-1 rounded-sm text-caption font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SearchField({ filters, onChange }: { filters: PipelineFilters; onChange: (next: PipelineFilters) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [input, setInput] = React.useState(filters.q);
  const [committed, setCommitted] = React.useState(filters.q);
  const [synced, setSynced] = React.useState(filters.q);
  if (filters.q !== synced) {
    setSynced(filters.q);
    if (filters.q !== committed) {
      setCommitted(filters.q);
      setInput(filters.q);
    }
  }

  React.useEffect(() => {
    const q = input.trim();
    if (q === filters.q) return;
    const t = window.setTimeout(() => {
      setCommitted(q);
      onChange({ ...filters, q, page: 1 });
    }, 300);
    return () => window.clearTimeout(t);
  }, [input, filters, onChange]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full min-w-[12rem] flex-1 sm:max-w-sm sm:flex-none">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <Input
        ref={inputRef}
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && input) {
            e.preventDefault();
            setInput("");
          }
        }}
        placeholder="Search leads"
        aria-label="Search leads"
        aria-keyshortcuts="/"
        className="peer h-9 rounded-full pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {input ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setInput("")}
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-surface-muted px-1.5 font-sans text-[0.6875rem] leading-4 text-ink-muted peer-focus:hidden"
        >
          /
        </kbd>
      )}
    </div>
  );
}

type Draft = {
  source: string;
  min: string;
  max: string;
  next: NextActionFilter;
  country: string;
  stage: string;
  team: string;
  owner: string;
  closed: PipelineFilters["closed"];
  closedFrom: string;
  closedTo: string;
};

function FiltersPanel({
  filters,
  currency,
  stages,
  closedView,
  showStageFilter,
  filterCount,
  scope,
  onChange,
}: {
  filters: PipelineFilters;
  currency: string;
  stages: PipelineStage[];
  closedView: boolean;
  showStageFilter: boolean;
  filterCount: number;
  scope: ReturnType<typeof useFilterNames>["scope"];
  onChange: (next: PipelineFilters) => void;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(draftFrom(filters));
  const sources = useQuery({
    queryKey: ["lead-sources", "filter"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const facetParams = React.useMemo(() => {
    const p = new URLSearchParams();
    if (filters.pipeline) p.set("pipelineId", filters.pipeline);
    if (draft.owner) p.set("ownerUserId", draft.owner);
    if (draft.team) p.set("teamId", draft.team);
    if (draft.source) p.set("source", draft.source);
    if (draft.next) p.set("activity", draft.next);
    const min = cleanAmount(draft.min);
    const max = cleanAmount(draft.max);
    if (min) p.set("minValue", min);
    if (max) p.set("maxValue", max);
    p.set("status", "all");
    return p;
  }, [draft, filters.pipeline]);

  const countriesQuery = useQuery({
    queryKey: ["leads", "countries", "pipeline-filters", facetParams.toString()],
    queryFn: () => crmApi.listLeadCountries(facetParams),
    staleTime: 30_000,
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const min = cleanAmount(draft.min);
  const max = cleanAmount(draft.max);
  const invalidAmount = (draft.min.trim() !== "" && min === "") || (draft.max.trim() !== "" && max === "");
  const reversed = min !== "" && max !== "" && Number(min) > Number(max);
  const sym = currencySymbol(currency);
  const stageOptions =
    filters.status === "open" ? stages.filter((s) => !s.isWon && !s.isLost) : stages;
  const showPeople = scope.teamMemberFilter || scope.teamFilter || scope.ownerFilter;

  const onOpenChange = (next: boolean) => {
    if (next) setDraft(draftFrom(filters));
    setOpen(next);
  };

  const apply = () => {
    if (invalidAmount || reversed) return;
    onChange({
      ...filters,
      source: draft.source,
      min,
      max,
      next: closedView ? "" : draft.next,
      country: draft.country,
      stage: showStageFilter ? draft.stage : filters.stage,
      team: draft.team,
      owner: draft.owner,
      closed: closedView ? draft.closed : "",
      closedFrom: closedView && draft.closed === "custom" ? draft.closedFrom : "",
      closedTo: closedView && draft.closed === "custom" ? draft.closedTo : "",
      page: 1,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className={cn("h-9 gap-1.5", filterCount > 0 && "border-brand/40 text-brand-ink")}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {filterCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-soft px-1.5 text-caption tabular-nums text-brand-ink">
              {filterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-column p-0 shadow-lift">
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Filters</p>
          <p className="text-caption text-ink-muted">Narrow the leads shown on this pipeline.</p>
        </div>
        <form
          className="max-h-[min(28rem,70vh)] space-y-4 overflow-y-auto px-4 py-3 crm-scroll"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          {showPeople ? (
            <section className="space-y-2">
              <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">People</p>
              {scope.teamMemberFilter ? (
                <TeamMemberFilterChip
                  value={draft.owner || "all"}
                  onChange={(owner) => setDraft((d) => ({ ...d, owner: owner === "all" ? "" : owner }))}
                />
              ) : (
                <OrgScopeSelects
                  teamId={draft.team}
                  ownerUserId={draft.owner}
                  onTeamChange={(team) => setDraft((d) => ({ ...d, team, owner: "" }))}
                  onOwnerChange={(owner) => setDraft((d) => ({ ...d, owner }))}
                  showTeam={scope.teamFilter}
                  showOwner={scope.ownerFilter}
                />
              )}
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">Pipeline</p>
            {closedView ? (
              <div className="space-y-2">
                <Label>Closed date</Label>
                <div role="radiogroup" aria-label="Closed date" className="flex flex-wrap gap-1.5">
                  {CLOSED_RANGE_OPTIONS.filter((o) => o.value !== "custom").map((o) => {
                    const on = draft.closed === o.value;
                    return (
                      <button
                        key={o.value || "any"}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() =>
                          setDraft((d) => ({ ...d, closed: o.value as ClosedRange, closedFrom: "", closedTo: "" }))
                        }
                        className={cn(
                          "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on
                            ? "border-brand bg-brand text-primary-foreground"
                            : "border-line bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-from`} className="text-caption text-ink-muted">
                      From
                    </Label>
                    <DatePicker
                      id={`${id}-from`}
                      value={draft.closedFrom}
                      max={draft.closedTo || undefined}
                      onChange={(closedFrom) =>
                        setDraft((d) => ({
                          ...d,
                          closed: closedFrom || d.closedTo ? "custom" : "",
                          closedFrom,
                        }))
                      }
                      placeholder="Any"
                      uiSize="md"
                      clearable
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-to`} className="text-caption text-ink-muted">
                      To
                    </Label>
                    <DatePicker
                      id={`${id}-to`}
                      value={draft.closedTo}
                      min={draft.closedFrom || undefined}
                      onChange={(closedTo) =>
                        setDraft((d) => ({
                          ...d,
                          closed: d.closedFrom || closedTo ? "custom" : "",
                          closedTo,
                        }))
                      }
                      placeholder="Any"
                      uiSize="md"
                      clearable
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-next`}>Next action</Label>
                <Select
                  value={draft.next || ANY}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, next: (v === ANY ? "" : v) as NextActionFilter }))
                  }
                >
                  <SelectTrigger id={`${id}-next`} className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEXT_ACTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value || ANY} value={o.value || ANY}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showStageFilter ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-stage`}>Stage</Label>
                <Select
                  value={draft.stage || ANY}
                  onValueChange={(v) => setDraft((d) => ({ ...d, stage: v === ANY ? "" : v }))}
                >
                  <SelectTrigger id={`${id}-stage`} className="h-9">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={ANY}>Any</SelectItem>
                    {draft.stage && !stageOptions.some((s) => s.id === draft.stage) ? (
                      <SelectItem value={draft.stage}>Unknown stage</SelectItem>
                    ) : null}
                    {stageOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-country`}>Country of residency</Label>
              <Select
                value={draft.country || "all"}
                onValueChange={(v) => setDraft((d) => ({ ...d, country: v === "all" ? "" : v }))}
              >
                <SelectTrigger id={`${id}-country`} className="h-9">
                  <SelectValue placeholder="Country of residency" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All countries</SelectItem>
                  {draft.country && !(countriesQuery.data ?? []).some((o) => o.country === draft.country) ? (
                    <SelectItem value={draft.country}>{countryFilterLabel(draft.country)}</SelectItem>
                  ) : null}
                  {(countriesQuery.data ?? []).map((o) => (
                    <SelectItem key={o.country} value={o.country}>
                      {`${countryFilterLabel(o.country)} (${o.count.toLocaleString("en-AU")})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">Details</p>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-source`}>Source</Label>
              <Select
                value={draft.source || ANY}
                onValueChange={(v) => setDraft((d) => ({ ...d, source: v === ANY ? "" : v }))}
              >
                <SelectTrigger id={`${id}-source`} className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any source</SelectItem>
                  {draft.source && !(sources.data ?? []).some((s) => s.name === draft.source) ? (
                    <SelectItem value={draft.source}>{draft.source}</SelectItem>
                  ) : null}
                  {(sources.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-foreground">Lead value</legend>
              <div className="flex items-center gap-2">
                <AmountInput
                  label="Minimum value"
                  symbol={sym}
                  placeholder="Min"
                  value={draft.min}
                  onChange={(v) => setDraft((d) => ({ ...d, min: v }))}
                />
                <span className="text-ink-muted" aria-hidden>
                  –
                </span>
                <AmountInput
                  label="Maximum value"
                  symbol={sym}
                  placeholder="Max"
                  value={draft.max}
                  onChange={(v) => setDraft((d) => ({ ...d, max: v }))}
                />
              </div>
              {invalidAmount || reversed ? (
                <p className="text-caption text-danger" role="alert">
                  {invalidAmount ? "Enter whole amounts, like 5000." : "Minimum is more than maximum."}
                </p>
              ) : null}
            </fieldset>
          </section>

          <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-line bg-surface px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setDraft({
                  source: "",
                  min: "",
                  max: "",
                  next: "",
                  country: "",
                  stage: "",
                  team: "",
                  owner: "",
                  closed: "",
                  closedFrom: "",
                  closedTo: "",
                })
              }
            >
              Reset
            </Button>
            <Button type="submit" disabled={invalidAmount || reversed}>
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function draftFrom(filters: PipelineFilters): Draft {
  return {
    source: filters.source,
    min: filters.min,
    max: filters.max,
    next: filters.next,
    country: filters.country,
    stage: filters.stage,
    team: filters.team,
    owner: filters.owner,
    closed: filters.closed,
    closedFrom: filters.closedFrom,
    closedTo: filters.closedTo,
  };
}

function AmountInput({
  label,
  symbol,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  symbol: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex-1">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted" aria-hidden>
        {symbol}
      </span>
      <Input
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-6 tabular-nums"
      />
    </div>
  );
}
