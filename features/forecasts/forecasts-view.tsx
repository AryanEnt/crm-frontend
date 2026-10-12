"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { ErrorState } from "@/components/ui/error-state";
import { KpiStripSkeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crmApi, type LeadForecast } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { useListFilterScope } from "@/features/auth/list-scope";
import { TeamMemberFilter } from "@/features/teams/team-member-filter";
import { ChartCard, SoftIndigoBarChart, formatPct } from "@/features/analytics/charts";
import { formatLeadMoney } from "@/features/leads/lead-format";

const HORIZONS = ["3", "6", "12"] as const;

function bucketLabel(key: string) {
  if (key === "overdue") return "Past close date";
  if (key === "later") return "Later";
  if (key === "no_date") return "No close date";
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

export function ForecastsView() {
  const [pipelineId, setPipelineId] = React.useState("all");
  const [months, setMonths] = React.useState<(typeof HORIZONS)[number]>("3");
  const [teamId, setTeamId] = React.useState("all");
  const [ownerUserId, setOwnerUserId] = React.useState("all");

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });
  const { teamMemberFilter, ownerFilter, teamFilter } = useListFilterScope("forecasts:view");
  const teamsQuery = useQuery({
    queryKey: ["teams", "forecasts"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: teamFilter,
  });
  const usersQuery = useQuery({
    queryKey: ["users", "forecasts"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: ownerFilter,
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ months, owner: ownerUserId !== "all" ? ownerUserId : "all" });
    if (pipelineId !== "all") p.set("pipelineId", pipelineId);
    if (teamFilter && teamId !== "all") p.set("teamId", teamId);
    return p;
  }, [months, ownerUserId, pipelineId, teamFilter, teamId]);

  const forecastQuery = useQuery({
    queryKey: ["lead-insights", "forecast", params.toString()],
    queryFn: () => crmApi.leadForecast(params),
  });

  if (forecastQuery.isError) {
    return <ErrorState onRetry={() => void forecastQuery.refetch()} />;
  }

  const data = forecastQuery.data;
  const money = (v: number) => formatLeadMoney(v, data?.currency);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Forecasts" }]}
        title="Lead forecast"
        description="Open lead value by expected close month. Estimates, not guarantees."
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-[11px]">Pipeline</Label>
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lead pipelines</SelectItem>
              {(pipelinesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Horizon</Label>
          <Select value={months} onValueChange={(v) => setMonths(v as (typeof HORIZONS)[number])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {HORIZONS.map((h) => (
                <SelectItem key={h} value={h}>Next {h} months</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {teamFilter ? (
          <div className="space-y-1">
            <Label className="text-[11px]">Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {(teamsQuery.data?.data ?? []).map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {ownerFilter ? (
          <div className="space-y-1">
            <Label className="text-[11px]">Sales executive</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <TeamMemberFilter value={ownerUserId} onChange={setOwnerUserId} className="w-full text-sm" />
          </div>
        ) : null}
      </div>

      {forecastQuery.isLoading || !data ? (
        <KpiStripSkeleton count={4} className="xl:grid-cols-4" />
      ) : (
        <>
          <section aria-label="Forecast totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              label="Closing in window"
              value={money(data.totals.value)}
              hint={`${data.totals.count} open lead${data.totals.count === 1 ? "" : "s"}, incl. past close date`}
            />
            <MetricCard label="Weighted by stage" value={money(data.totals.weighted)} hint="Value × stage probability" />
            <MetricCard
              label="Adjusted by history"
              value={data.totals.historicalAdjusted == null ? "—" : money(data.totals.historicalAdjusted)}
              hint={
                data.historicalWinRate == null
                  ? "No won or lost leads yet"
                  : `${formatPct(data.historicalWinRate)} win rate over ${data.closedSample} closed`
              }
            />
            <MetricCard
              label="Not forecast"
              value={String(data.buckets.find((b) => b.key === "no_date")?.count ?? 0)}
              hint="Open leads without a close date"
            />
          </section>

          <Limitations forecast={data} />

          <ChartCard
            title="Value by expected close month"
            question="Bars show open value; the table adds weighted value and lead counts."
            empty={data.buckets.every((b) => b.count === 0)}
            emptyDescription="No open leads in scope."
          >
            <SoftIndigoBarChart
              data={data.buckets.map((b) => ({ label: bucketLabel(b.key), value: b.value }))}
              valueFormatter={money}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Close</th>
                    <th className="py-2 pr-3 text-right font-medium">Leads</th>
                    <th className="py-2 pr-3 text-right font-medium">Value</th>
                    <th className="py-2 pr-3 text-right font-medium">Weighted</th>
                    <th className="py-2 text-right font-medium">Without value</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {data.buckets.map((b) => (
                    <tr key={b.key} className="border-b border-border/70">
                      <td className="py-2.5 pr-3 font-medium">{bucketLabel(b.key)}</td>
                      <td className="py-2.5 pr-3 text-right">{b.count}</td>
                      <td className="py-2.5 pr-3 text-right">{money(b.value)}</td>
                      <td className="py-2.5 pr-3 text-right">{money(b.weighted)}</td>
                      <td className="py-2.5 text-right">{b.noValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

function Limitations({ forecast }: { forecast: LeadForecast }) {
  if (forecast.limitations.length === 0) return null;
  return (
    <section className="rounded-lg border border-warning/30 bg-warning-soft p-3">
      <h3 className="flex items-center gap-1.5 text-caption font-semibold text-ink">
        <AlertTriangle className="size-3.5 text-warning" aria-hidden />
        What this forecast can’t tell you
      </h3>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-caption text-ink-secondary">
        {forecast.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  );
}
