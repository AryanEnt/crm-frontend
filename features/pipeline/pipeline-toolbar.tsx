"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { OrgScopeSelects, useOwnerOptions, useTeamOptions } from "@/features/teams/scope-filters";
import { TeamMemberFilterChip } from "@/features/teams/team-member-filter";
import { countryFilterLabel } from "@/features/leads/lead-format";
import { crmApi } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import {
  NEXT_ACTION_OPTIONS,
  activeFilterChips,
  clearAllFilters,
  clearFilter,
  cleanAmount,
  isClosedStatus,
  statusOptions,
  type NextActionFilter,
  type PipelineFilters,
} from "./pipeline-filters";
import { ClosedDateFilter, ClosedSortSelect, ClosedViewToggle } from "./closed-filters";
import { currencySymbol } from "./pipeline-format";
import type { PipelineStatus } from "./pipeline-totals";

const ANY = "any";

function PipelineCountryFilter({
  filters,
  onChange,
}: {
  filters: PipelineFilters;
  onChange: (next: PipelineFilters) => void;
}) {
  const facetParams = React.useMemo(() => {
    const p = new URLSearchParams();
    if (filters.pipeline) p.set("pipelineId", filters.pipeline);
    if (filters.q.trim()) p.set("q", filters.q.trim());
    if (filters.owner) p.set("ownerUserId", filters.owner);
    if (filters.team) p.set("teamId", filters.team);
    if (filters.source) p.set("source", filters.source);
    if (filters.next) p.set("activity", filters.next);
    if (filters.min) p.set("minValue", filters.min);
    if (filters.max) p.set("maxValue", filters.max);
    p.set("status", "all");
    return p;
  }, [filters.pipeline, filters.q, filters.owner, filters.team, filters.source, filters.next, filters.min, filters.max]);

  const countriesQuery = useQuery({
    queryKey: ["leads", "countries", "pipeline", facetParams.toString()],
    queryFn: () => crmApi.listLeadCountries(facetParams),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const options = countriesQuery.data ?? [];
  const value = filters.country;
  const selectedStillPresent = !value || options.some((o) => o.country === value);

  return (
    <Select value={value || "all"} onValueChange={(v) => onChange({ ...filters, country: v === "all" ? "" : v, page: 1 })}>
      <SelectTrigger
        className={cn("h-9 w-[180px] text-xs", value && "border-brand-border bg-brand-soft text-brand")}
        aria-label="Country"
      >
        <SelectValue placeholder="All Countries" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">All Countries</SelectItem>
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

/** Names for active filter chips; list is scoped to the selected team when one is set. */
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

export function PipelineToolbar({
  filters,
  counts,
  currency,
  nurturing = false,
  onChange,
}: {
  filters: PipelineFilters;
  counts: Record<PipelineStatus, number> | null;
  currency: string;
  /** Nurturing shows a Complete filter and uses Complete wording for closed-success. */
  nurturing?: boolean;
  onChange: (next: PipelineFilters) => void;
}) {
  const names = useFilterNames(filters);
  const chips = activeFilterChips(filters, {
    owner: names.ownerName,
    team: names.teamName,
    currencySymbol: currencySymbol(currency),
    nurturing,
  });
  const closedView = isClosedStatus(filters.status);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField filters={filters} onChange={onChange} />
        <SegmentedControl
          ariaLabel="Lead status"
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status, page: 1 })}
          options={statusOptions(nurturing).map((o) => ({ ...o, count: counts?.[o.value] }))}
        />
        {names.scope.teamMemberFilter ? (
          <TeamMemberFilterChip
            value={filters.owner || "all"}
            onChange={(id) => onChange({ ...filters, owner: id === "all" ? "" : id, page: 1 })}
          />
        ) : (
          <OrgScopeSelects
            teamId={filters.team}
            ownerUserId={filters.owner}
            onTeamChange={(team) => onChange({ ...filters, team, owner: "", page: 1 })}
            onOwnerChange={(owner) => onChange({ ...filters, owner, page: 1 })}
            showTeam={names.scope.teamFilter}
            showOwner={names.scope.ownerFilter}
          />
        )}
        {closedView ? (
          <>
            <ClosedDateFilter filters={filters} onChange={onChange} />
            <ClosedSortSelect filters={filters} onChange={onChange} />
          </>
        ) : (
          <Select
            value={filters.next || ANY}
            onValueChange={(v) => onChange({ ...filters, next: (v === ANY ? "" : v) as NextActionFilter, page: 1 })}
          >
            <SelectTrigger className="h-9 w-[168px]" aria-label="Next action">
              <span className="text-ink-muted">Next action:</span>
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
        )}
        <PipelineCountryFilter filters={filters} onChange={onChange} />
        <MoreFilters filters={filters} currency={currency} onChange={onChange} />
        {closedView ? (
          <div className="ml-auto">
            <ClosedViewToggle filters={filters} onChange={onChange} />
          </div>
        ) : null}
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
  // Follow outside changes (chip removed, back button) without clobbering what is being typed.
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
    <div className="relative w-full sm:w-72">
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
        placeholder={
          filters.status === "complete"
            ? "Search complete leads"
            : filters.status === "won"
              ? "Search won leads"
              : filters.status === "lost"
                ? "Search lost leads"
                : "Search name, company, email, phone"
        }
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

type Draft = { source: string; min: string; max: string };

function MoreFilters({
  filters,
  currency,
  onChange,
}: {
  filters: PipelineFilters;
  currency: string;
  onChange: (next: PipelineFilters) => void;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>({ source: "", min: "", max: "" });
  const sources = useQuery({
    queryKey: ["lead-sources", "filter"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const active = [filters.source, filters.min || filters.max].filter(Boolean).length;
  const min = cleanAmount(draft.min);
  const max = cleanAmount(draft.max);
  const invalidAmount = (draft.min.trim() !== "" && min === "") || (draft.max.trim() !== "" && max === "");
  const reversed = min !== "" && max !== "" && Number(min) > Number(max);
  const sym = currencySymbol(currency);

  const onOpenChange = (next: boolean) => {
    if (next) setDraft({ source: filters.source, min: filters.min, max: filters.max });
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="lg" className={cn(active > 0 && "border-brand/40 text-brand-ink")}>
          <SlidersHorizontal aria-hidden />
          More filters
          {active > 0 ? (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-soft px-1.5 text-caption tabular-nums text-brand-ink">
              {active}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-column p-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalidAmount || reversed) return;
            onChange({ ...filters, source: draft.source, min, max, page: 1 });
            setOpen(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-source`}>Source</Label>
            <Select value={draft.source || ANY} onValueChange={(v) => setDraft((d) => ({ ...d, source: v === ANY ? "" : v }))}>
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
            <legend className="text-sm font-medium text-foreground">Value range</legend>
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
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft({ source: "", min: "", max: "" })}
            >
              Reset
            </Button>
            <Button type="submit" disabled={invalidAmount || reversed}>
              Apply filters
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
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
