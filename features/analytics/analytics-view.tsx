"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { KpiStripSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/error-state";
import { crmApi, type LeadOverview } from "@/lib/api/crm";
import {
  AnalyticsFilterBar,
  defaultAnalyticsFilters,
  filtersToInsightParams,
  filtersToParams,
  type AnalyticsFiltersState,
} from "@/features/analytics/filter-bar";
import {
  ChartCard,
  SoftIndigoBarChart,
  SoftIndigoLineChart,
  SoftIndigoFunnelChart,
  formatDuration,
  formatPct,
} from "@/features/analytics/charts";
import { formatLeadMoney } from "@/features/leads/lead-format";

export function MixedCurrencyNote({ overview }: { overview?: Pick<LeadOverview, "mixedCurrency" | "currency"> }) {
  if (!overview?.mixedCurrency) return null;
  return (
    <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-caption text-ink">
      Leads use more than one currency. Values show {overview.currency} leads only; counts include every lead.
    </p>
  );
}

export function AnalyticsView() {
  const [filters, setFilters] = React.useState<AnalyticsFiltersState>(defaultAnalyticsFilters);
  const insightParams = React.useMemo(() => filtersToInsightParams(filters), [filters]);
  const baseParams = React.useMemo(() => {
    const p = filtersToParams(filters);
    p.delete("anzscoId");
    return p;
  }, [filters]);

  const overviewQuery = useQuery({
    queryKey: ["lead-insights", "overview", insightParams.toString()],
    queryFn: () => crmApi.leadOverview(insightParams),
  });
  const ownersQuery = useQuery({
    queryKey: ["lead-insights", "owners", insightParams.toString()],
    queryFn: () => crmApi.leadOwners(insightParams),
  });
  const leadsQuery = useQuery({
    queryKey: ["analytics-leads", baseParams.toString()],
    queryFn: () => crmApi.analyticsLeads(baseParams),
  });
  const activitiesQuery = useQuery({
    queryKey: ["analytics-activities", baseParams.toString()],
    queryFn: () => crmApi.analyticsActivities(baseParams),
  });

  const o = overviewQuery.data;
  const money = (v: number) => formatLeadMoney(v, o?.currency);
  const openStages = (o?.stages ?? []).filter((s) => !s.isWon && !s.isLost);

  if (overviewQuery.isError) {
    return <ErrorState onRetry={() => void overviewQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Analytics" }]}
        title="Lead analytics"
        description={`${o?.pipeline ? `${o.pipeline.name} · ` : ""}${filters.from} → ${filters.to} · won and lost by close date`}
      />

      <AnalyticsFilterBar value={filters} onChange={setFilters} showAnzsco={false} />
      <MixedCurrencyNote overview={o} />

      {overviewQuery.isLoading ? (
        <KpiStripSkeleton count={8} className="md:grid-cols-4" />
      ) : (
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Open leads" value={String(o?.openLeads ?? "—")} hint="Right now" />
          <MetricCard
            label="Open pipeline value"
            value={o ? money(o.openValue) : "—"}
            hint={o ? `${money(o.weightedValue)} weighted by stage` : undefined}
          />
          <MetricCard label="Won leads" value={String(o?.wonLeads ?? "—")} hint="Won in range" />
          <MetricCard
            label="Won value"
            value={o ? money(o.wonValue) : "—"}
            hint={o?.winRate != null ? `${formatPct(o.winRate)} win rate` : "No closed leads in range"}
          />
          <MetricCard
            label="Lost leads"
            value={String(o?.lostLeads ?? "—")}
            hint={o ? `${money(o.lostValue)} lost value` : undefined}
          />
          <MetricCard label="Needing attention" value={String(o?.needingAttention ?? "—")} hint="Open leads flagged" />
          <MetricCard label="No next activity" value={String(o?.noNextActivity ?? "—")} hint="Open leads, nothing scheduled" />
          <MetricCard label="Stale" value={String(o?.stale ?? "—")} hint="No activity in 7+ days" />
        </section>
      )}

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Lead flow</TabsTrigger>
          <TabsTrigger value="activities">Activity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-3 space-y-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Open leads by stage"
              question="Where are open leads sitting right now?"
              loading={overviewQuery.isLoading}
              empty={!overviewQuery.isLoading && openStages.every((s) => s.count === 0)}
            >
              <SoftIndigoBarChart data={openStages.map((s) => ({ label: s.name, value: s.count }))} />
            </ChartCard>
            <ChartCard
              title="Open value by stage"
              question="How much potential value is in each stage?"
              loading={overviewQuery.isLoading}
              empty={!overviewQuery.isLoading && openStages.every((s) => s.value === 0)}
              emptyDescription="Open leads in this range have no value yet."
            >
              <SoftIndigoBarChart
                data={openStages.map((s) => ({ label: s.name, value: s.value }))}
                valueFormatter={money}
              />
            </ChartCard>
          </div>
          <ChartCard
            title="Stage funnel"
            question="How many leads reached each stage in the range? Based on recorded stage moves."
            loading={overviewQuery.isLoading}
            empty={!overviewQuery.isLoading && (o?.funnel ?? []).every((f) => f.reached === 0)}
            emptyDescription="Stage history starts when leads are moved on the board."
          >
            <SoftIndigoFunnelChart
              data={(o?.funnel ?? []).filter((f) => !f.isLost).map((f) => ({ name: f.name, value: f.reached }))}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="leads" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="New leads" value={String(leadsQuery.data?.leadVolume ?? "—")} hint="Created in range" />
            <MetricCard label="Qualified" value={String(leadsQuery.data?.qualifiedLeads ?? "—")} />
            <MetricCard label="Avg response" value={formatDuration(leadsQuery.data?.averageResponseTimeSeconds)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="New leads by day"
              question={leadsQuery.data?.question}
              loading={leadsQuery.isLoading}
              empty={!leadsQuery.isLoading && (leadsQuery.data?.volumeByDay.length ?? 0) === 0}
            >
              <SoftIndigoLineChart
                data={(leadsQuery.data?.volumeByDay ?? []).map((p) => ({ label: p.label, value: p.value }))}
              />
            </ChartCard>
            <ChartCard
              title="New leads by source"
              question="Which channels are generating leads?"
              loading={leadsQuery.isLoading}
              empty={!leadsQuery.isLoading && (leadsQuery.data?.bySource.length ?? 0) === 0}
            >
              <SoftIndigoBarChart
                data={(leadsQuery.data?.bySource ?? []).map((p) => ({ label: p.label, value: p.value }))}
              />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Activities" value={String(activitiesQuery.data?.activities ?? "—")} />
            <MetricCard label="Completed" value={String(activitiesQuery.data?.completed ?? "—")} />
            <MetricCard label="Overdue" value={String(activitiesQuery.data?.overdue ?? "—")} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Activities by type"
              question={activitiesQuery.data?.question}
              loading={activitiesQuery.isLoading}
              empty={!activitiesQuery.isLoading && (activitiesQuery.data?.byType.length ?? 0) === 0}
            >
              <SoftIndigoBarChart
                data={(activitiesQuery.data?.byType ?? []).map((p) => ({ label: p.label, value: p.value }))}
              />
            </ChartCard>
            <ChartCard
              title="Activity volume over time"
              question="Is follow-up activity consistent across the date range?"
              loading={activitiesQuery.isLoading}
              empty={!activitiesQuery.isLoading && (activitiesQuery.data?.byDay.length ?? 0) === 0}
            >
              <SoftIndigoLineChart
                data={(activitiesQuery.data?.byDay ?? []).map((p) => ({ label: p.label, value: p.value }))}
              />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-3 space-y-3">
          <ChartCard
            title="By owner"
            question="Open, won and lost leads per owner. Won and lost count by close date in the range."
            loading={ownersQuery.isLoading}
            empty={!ownersQuery.isLoading && (ownersQuery.data?.rows.length ?? 0) === 0}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Owner</th>
                    <th className="py-2 pr-3 text-right font-medium">Open</th>
                    <th className="py-2 pr-3 text-right font-medium">Open value</th>
                    <th className="py-2 pr-3 text-right font-medium">Won</th>
                    <th className="py-2 pr-3 text-right font-medium">Won value</th>
                    <th className="py-2 pr-3 text-right font-medium">Lost</th>
                    <th className="py-2 pr-3 text-right font-medium">Win rate</th>
                    <th className="py-2 text-right font-medium">Activities</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {(ownersQuery.data?.rows ?? []).map((r) => {
                    const fmt = (v: number) => formatLeadMoney(v, ownersQuery.data?.currency);
                    return (
                      <tr key={r.ownerUserId ?? "none"} className="border-b border-border/70">
                        <td className="py-2.5 pr-3 font-medium">{r.ownerName ?? "Unassigned"}</td>
                        <td className="py-2.5 pr-3 text-right">{r.openLeads}</td>
                        <td className="py-2.5 pr-3 text-right">{fmt(r.openValue)}</td>
                        <td className="py-2.5 pr-3 text-right">{r.wonLeads}</td>
                        <td className="py-2.5 pr-3 text-right">{fmt(r.wonValue)}</td>
                        <td className="py-2.5 pr-3 text-right">{r.lostLeads}</td>
                        <td className="py-2.5 pr-3 text-right">{r.winRate == null ? "—" : formatPct(r.winRate)}</td>
                        <td className="py-2.5 text-right">{r.activities}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
