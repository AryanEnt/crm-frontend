"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Globe2,
  RotateCcw,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiStripSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useListFilterScope } from "@/features/auth/list-scope";
import {
  ChartCard,
  SoftIndigoHorizontalBarChart,
  formatPct,
} from "@/features/analytics/charts";
import { TeamMemberFilter } from "@/features/teams/team-member-filter";
import { flagEmoji } from "@/features/leads/create/phone-country-picker";
import { PHONE_COUNTRIES } from "@/features/leads/create/phone";
import { adminApi } from "@/lib/api/admin";
import {
  crmApi,
  type CountryPopulationKpis,
  type CountryPopulationRow,
} from "@/lib/api/crm";
import { cn } from "@/lib/utils";

type DatePreset = "7d" | "30d" | "month" | "quarter" | "custom";

type PopulationFilters = {
  preset: DatePreset;
  from: string;
  to: string;
  country: string;
  stageId: string;
  ownerUserId: string;
  teamId: string;
};

type SortKey =
  | "country"
  | "totalLeads"
  | "newLeads"
  | "contactedLeads"
  | "qualifiedLeads"
  | "unqualifiedLeads"
  | "sharePct";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: DatePreset, now = new Date()): { from: string; to: string } {
  const to = isoDate(now);
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to };
  }
  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: isoDate(from), to };
  }
  if (preset === "month") {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: isoDate(new Date(now.getFullYear(), q, 1)), to };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to };
}

function defaultFilters(): PopulationFilters {
  const { from, to } = rangeForPreset("30d");
  return {
    preset: "30d",
    from,
    to,
    country: "all",
    stageId: "all",
    ownerUserId: "all",
    teamId: "all",
  };
}

function filtersFromParams(sp: URLSearchParams): PopulationFilters {
  const base = defaultFilters();
  const presetRaw = sp.get("preset");
  const preset: DatePreset =
    presetRaw === "7d" ||
    presetRaw === "30d" ||
    presetRaw === "month" ||
    presetRaw === "quarter" ||
    presetRaw === "custom"
      ? presetRaw
      : "30d";
  const ranged = preset === "custom" ? { from: sp.get("from") ?? base.from, to: sp.get("to") ?? base.to } : rangeForPreset(preset);
  return {
    preset,
    from: ranged.from,
    to: ranged.to,
    country: sp.get("country") || "all",
    stageId: sp.get("stageId") || "all",
    ownerUserId: sp.get("ownerUserId") || "all",
    teamId: sp.get("teamId") || "all",
  };
}

function filtersToParams(f: PopulationFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set("preset", f.preset);
  if (f.preset === "custom") {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  } else {
    p.set("from", f.from);
    p.set("to", f.to);
  }
  if (f.country && f.country !== "all") p.set("country", f.country);
  if (f.stageId && f.stageId !== "all") p.set("stageId", f.stageId);
  if (f.ownerUserId && f.ownerUserId !== "all") p.set("ownerUserId", f.ownerUserId);
  if (f.teamId && f.teamId !== "all") p.set("teamId", f.teamId);
  return p;
}

function apiParams(f: PopulationFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.country && f.country !== "all") p.set("country", f.country);
  if (f.stageId && f.stageId !== "all") p.set("stageId", f.stageId);
  if (f.ownerUserId && f.ownerUserId !== "all") p.set("ownerUserId", f.ownerUserId);
  if (f.teamId && f.teamId !== "all") p.set("teamId", f.teamId);
  return p;
}

function kpiDelta(curr: number, prev: number | undefined): number | undefined {
  if (prev === undefined) return undefined;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 100);
}

function countryMark(name: string): { emoji?: string; label: string } {
  if (name === "(Unknown)") return { label: "Unknown" };
  const hit = PHONE_COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (hit) return { emoji: flagEmoji(hit.code), label: name };
  return { label: name };
}

function leadsDrillHref(country: string, f: PopulationFilters): string {
  const p = new URLSearchParams();
  if (country) p.set("country", country);
  if (f.stageId && f.stageId !== "all") p.set("stageId", f.stageId);
  if (f.from) p.set("createdFrom", f.from);
  if (f.to) p.set("createdTo", f.to);
  const q = p.toString();
  return q ? `/leads?${q}` : "/leads";
}

const PAGE_SIZE = 10;
const CHART_TOP = 8;

export function LeadPopulationView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = React.useState<PopulationFilters>(() => filtersFromParams(searchParams));
  const [tableSearch, setTableSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("totalLeads");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [showAllChart, setShowAllChart] = React.useState(false);

  const { teamMemberFilter, ownerFilter, teamFilter } = useListFilterScope("analytics:view");

  React.useEffect(() => {
    const next = filtersToParams(filters);
    const cur = searchParams.toString();
    if (next.toString() === cur) return;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [filters, pathname, router, searchParams]);

  const params = React.useMemo(() => apiParams(filters), [filters]);
  const query = useQuery({
    queryKey: ["analytics-countries", params.toString()],
    queryFn: () => crmApi.analyticsCountries(params),
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });

  const teamsQuery = useQuery({
    queryKey: ["teams", "lead-population"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: teamFilter,
  });

  const usersQuery = useQuery({
    queryKey: ["users", "lead-population", filters.teamId],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100", isActive: "true" });
      if (filters.teamId && filters.teamId !== "all") p.set("teamId", filters.teamId);
      return adminApi.listUsers(p);
    },
    enabled: ownerFilter,
  });

  const stageOptions = React.useMemo(() => {
    const pipelines = pipelinesQuery.data ?? [];
    return pipelines.flatMap((p) =>
      p.stages
        .filter((s) => s.isActive)
        .map((s) => ({
          id: s.id,
          label: pipelines.length > 1 ? `${p.name} · ${s.name}` : s.name,
        })),
    );
  }, [pipelinesQuery.data]);

  const countryOptions = React.useMemo(() => {
    const names = (query.data?.countries ?? []).map((c) => c.country);
    if (filters.country !== "all" && !names.includes(filters.country)) {
      return [filters.country, ...names];
    }
    return names;
  }, [query.data?.countries, filters.country]);

  const patch = (partial: Partial<PopulationFilters>) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, ...partial };
      if (partial.preset && partial.preset !== "custom") {
        const ranged = rangeForPreset(partial.preset);
        next.from = ranged.from;
        next.to = ranged.to;
      }
      if (partial.from !== undefined || partial.to !== undefined) {
        next.preset = "custom";
      }
      return next;
    });
  };

  const reset = () => {
    setTableSearch("");
    setSortKey("totalLeads");
    setSortDir("desc");
    setPage(1);
    setShowAllChart(false);
    setFilters(defaultFilters());
  };

  const rows = query.data?.countries ?? [];
  const filteredRows = React.useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        const label = r.country === "(Unknown)" ? "unknown" : r.country.toLowerCase();
        return label.includes(q);
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "country") {
        return a.country.localeCompare(b.country) * dir;
      }
      return (Number(a[sortKey]) - Number(b[sortKey])) * dir;
    });
  }, [rows, tableSearch, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const chartRows = showAllChart ? filteredRows : filteredRows.slice(0, CHART_TOP);
  const kpis = query.data?.kpis;
  const prev = query.data?.previousKpis;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "country" ? "asc" : "desc");
    }
  };

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Lead Population" }]}
        title="Lead Population"
        description="Analyze lead distribution, market coverage, and pipeline performance by country."
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="space-y-1">
            <Label className="text-[11px]">Date range</Label>
            <Select
              value={filters.preset}
              onValueChange={(v) => patch({ preset: v as DatePreset })}
            >
              <SelectTrigger aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filters.preset === "custom" ? (
            <>
              <div className="space-y-1">
                <Label className="text-[11px]">From</Label>
                <DatePicker
                  aria-label="From"
                  value={filters.from}
                  max={filters.to}
                  onChange={(from) => patch({ from })}
                  uiSize="md"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">To</Label>
                <DatePicker
                  aria-label="To"
                  value={filters.to}
                  min={filters.from}
                  onChange={(to) => patch({ to })}
                  uiSize="md"
                />
              </div>
            </>
          ) : null}
          <div className="space-y-1">
            <Label className="text-[11px]">Country</Label>
            <Select value={filters.country} onValueChange={(v) => patch({ country: v })}>
              <SelectTrigger aria-label="Country">
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "(Unknown)" ? "Unknown" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Lead stage</Label>
            <Select value={filters.stageId} onValueChange={(v) => patch({ stageId: v })}>
              <SelectTrigger aria-label="Lead stage">
                <SelectValue placeholder="All stages" />
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
          </div>
          {teamFilter ? (
            <div className="space-y-1">
              <Label className="text-[11px]">Team</Label>
              <Select
                value={filters.teamId}
                onValueChange={(v) => patch({ teamId: v, ownerUserId: "all" })}
              >
                <SelectTrigger aria-label="Team">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {(teamsQuery.data?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {ownerFilter ? (
            <div className="space-y-1">
              <Label className="text-[11px]">Sales executive</Label>
              <Select
                value={filters.ownerUserId}
                onValueChange={(v) => patch({ ownerUserId: v })}
              >
                <SelectTrigger aria-label="Sales executive">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {(usersQuery.data?.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : teamMemberFilter ? (
            <div className="space-y-1">
              <Label className="text-[11px]">Sales executive</Label>
              <TeamMemberFilter
                value={filters.ownerUserId}
                onChange={(v) => patch({ ownerUserId: v })}
                className="w-full text-sm"
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-ink-muted">
            {filters.from} → {filters.to}
            {query.data?.countryFieldLabel ? ` · ${query.data.countryFieldLabel}` : ""}
          </p>
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-8" onClick={reset}>
            <RotateCcw className="size-3.5" />
            Reset filters
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <KpiStripSkeleton count={4} className="md:grid-cols-4" />
      ) : (
        <section aria-label="Summary metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard
            label="Total Leads"
            value={String(kpis?.totalLeads ?? 0)}
            hint="Matching filters"
            delta={kpiDelta(kpis?.totalLeads ?? 0, prev?.totalLeads)}
          />
          <MetricCard
            label="New Leads"
            value={String(kpis?.newLeads ?? 0)}
            hint="Lead / New stage"
            delta={kpiDelta(kpis?.newLeads ?? 0, prev?.newLeads)}
          />
          <MetricCard
            label="Qualified Leads"
            value={String(kpis?.qualifiedLeads ?? 0)}
            hint="Qualified stage"
            delta={kpiDelta(kpis?.qualifiedLeads ?? 0, prev?.qualifiedLeads)}
          />
          <MetricCard
            label="Conversion Rate"
            value={kpis ? formatPct(kpis.conversionRate) : "—"}
            hint="Won ÷ (won + lost)"
            delta={
              prev ? kpiDelta(kpis?.conversionRate ?? 0, prev.conversionRate) : undefined
            }
          />
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-2"
          title="Country distribution"
          question="Share of matching leads by residence country"
          loading={query.isLoading}
          empty={!query.isLoading && chartRows.length === 0}
          emptyDescription="No leads match these filters. Try widening the date range or clearing country and stage."
        >
          <SoftIndigoHorizontalBarChart
            data={chartRows.map((r) => ({
              label: r.country === "(Unknown)" ? "Unknown" : r.country,
              value: r.totalLeads,
              country: r.country,
            }))}
            onBarClick={(row) => {
              const country = String(row.country ?? "");
              if (!country) return;
              router.push(leadsDrillHref(country, filters));
            }}
          />
          {!showAllChart && filteredRows.length > CHART_TOP ? (
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllChart(true)}>
                View all countries ({filteredRows.length})
              </Button>
            </div>
          ) : null}
        </ChartCard>

        <section className="xl:col-span-3 rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <h2 className="text-sm font-semibold text-ink">Country performance</h2>
            <div className="relative ml-auto w-full max-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Search countries…"
                aria-label="Search countries"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {query.isLoading ? (
            <div className="p-3">
              <TableSkeleton rows={6} cols={7} />
            </div>
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon={Globe2}
              title="No countries match"
              description="Adjust search or filters to see lead population by country."
              actionLabel="Reset filters"
              onAction={reset}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wide text-foreground-subtle">
                    <tr className="border-b border-border">
                      <SortTh label="Country" active={sortKey === "country"} dir={sortDir} onClick={() => toggleSort("country")} />
                      <SortTh label="Total" align="right" active={sortKey === "totalLeads"} dir={sortDir} onClick={() => toggleSort("totalLeads")} />
                      <SortTh label="New" align="right" active={sortKey === "newLeads"} dir={sortDir} onClick={() => toggleSort("newLeads")} />
                      <SortTh label="Contacted" align="right" active={sortKey === "contactedLeads"} dir={sortDir} onClick={() => toggleSort("contactedLeads")} />
                      <SortTh label="Qualified" align="right" active={sortKey === "qualifiedLeads"} dir={sortDir} onClick={() => toggleSort("qualifiedLeads")} />
                      <SortTh label="Unqualified" align="right" active={sortKey === "unqualifiedLeads"} dir={sortDir} onClick={() => toggleSort("unqualifiedLeads")} />
                      <SortTh label="Share" align="right" active={sortKey === "sharePct"} dir={sortDir} onClick={() => toggleSort("sharePct")} />
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {pageRows.map((row) => (
                      <CountryRow key={row.country} row={row} href={leadsDrillHref(row.country, filters)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-caption text-ink-muted">
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of{" "}
                  {filteredRows.length}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function SortTh({
  label,
  align = "left",
  active,
  dir,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("py-2 font-medium", align === "right" ? "pr-3 text-right" : "pl-3 pr-2")}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink",
          align === "right" && "flex-row-reverse",
          active && "text-ink",
        )}
        onClick={onClick}
      >
        {label}
        <Icon className="size-3 opacity-60" />
      </button>
    </th>
  );
}

function CountryRow({ row, href }: { row: CountryPopulationRow; href: string }) {
  const mark = countryMark(row.country);
  return (
    <tr className="border-b border-border/70 transition-colors hover:bg-surface-muted/60">
      <td className="py-2.5 pl-3 pr-2">
        <Link href={href} className="inline-flex items-center gap-2 font-medium text-ink hover:text-brand">
          <span className="flex size-6 items-center justify-center rounded-md bg-surface-muted text-xs" aria-hidden>
            {mark.emoji ?? <Globe2 className="size-3.5 text-ink-muted" />}
          </span>
          {mark.label}
        </Link>
        <div className="mt-1.5 h-1.5 max-w-[160px] overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand/80"
            style={{ width: `${Math.min(100, Math.max(0, row.sharePct))}%` }}
          />
        </div>
      </td>
      <td className="py-2.5 pr-3 text-right">{row.totalLeads.toLocaleString()}</td>
      <td className="py-2.5 pr-3 text-right">{row.newLeads.toLocaleString()}</td>
      <td className="py-2.5 pr-3 text-right">{row.contactedLeads.toLocaleString()}</td>
      <td className="py-2.5 pr-3 text-right">{row.qualifiedLeads.toLocaleString()}</td>
      <td className="py-2.5 pr-3 text-right">{row.unqualifiedLeads.toLocaleString()}</td>
      <td className="py-2.5 pr-3 text-right">{formatPct(row.sharePct)}</td>
    </tr>
  );
}

/** Exported for tests / reuse — period-over-period delta helper. */
export function populationKpiDelta(kpis: CountryPopulationKpis, prev: CountryPopulationKpis | null) {
  if (!prev) return null;
  return {
    totalLeads: kpiDelta(kpis.totalLeads, prev.totalLeads),
    newLeads: kpiDelta(kpis.newLeads, prev.newLeads),
    qualifiedLeads: kpiDelta(kpis.qualifiedLeads, prev.qualifiedLeads),
    conversionRate: kpiDelta(kpis.conversionRate, prev.conversionRate),
  };
}
