"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { KpiStripSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { crmApi } from "@/lib/api/crm";
import {
  AnalyticsFilterBar,
  defaultAnalyticsFilters,
  filtersToParams,
  type AnalyticsFiltersState,
} from "@/features/analytics/filter-bar";
import {
  ChartCard,
  SoftIndigoBarChart,
  SoftIndigoLineChart,
  SoftIndigoFunnelChart,
  formatDuration,
  formatMoney,
  formatPct,
} from "@/features/analytics/charts";

export function AnalyticsView() {
  const [filters, setFilters] = React.useState<AnalyticsFiltersState>(defaultAnalyticsFilters);
  const [groupBy, setGroupBy] = React.useState("user");
  const [sortBy, setSortBy] = React.useState("pipelineValue");
  const [period, setPeriod] = React.useState("month");

  const baseParams = React.useMemo(() => filtersToParams(filters), [filters]);

  const summaryQuery = useQuery({
    queryKey: ["analytics-summary", baseParams.toString()],
    queryFn: () => crmApi.analyticsSummary(baseParams),
  });
  const leadsQuery = useQuery({
    queryKey: ["analytics-leads", baseParams.toString()],
    queryFn: () => crmApi.analyticsLeads(baseParams),
  });
  const pipelineQuery = useQuery({
    queryKey: ["analytics-pipeline", baseParams.toString()],
    queryFn: () => crmApi.analyticsPipeline(baseParams),
  });
  const activitiesQuery = useQuery({
    queryKey: ["analytics-activities", baseParams.toString()],
    queryFn: () => crmApi.analyticsActivities(baseParams),
  });
  const conversionsQuery = useQuery({
    queryKey: ["analytics-conversions", baseParams.toString()],
    queryFn: () => crmApi.analyticsConversions(baseParams),
  });
  const sourcesQuery = useQuery({
    queryKey: ["analytics-sources", baseParams.toString()],
    queryFn: () => crmApi.analyticsSources(baseParams),
  });

  const teamParams = React.useMemo(() => {
    const p = filtersToParams(filters);
    p.set("groupBy", groupBy);
    p.set("sortBy", sortBy);
    p.set("period", period);
    return p;
  }, [filters, groupBy, sortBy, period]);

  const teamsQuery = useQuery({
    queryKey: ["analytics-teams", teamParams.toString()],
    queryFn: () => crmApi.analyticsTeams(teamParams),
  });

  const summary = summaryQuery.data;
  const rangeLabel = summary
    ? `${summary.from.slice(0, 10)} → ${summary.to.slice(0, 10)}`
    : "Selected range";

  if (summaryQuery.isError) {
    return <ErrorState onRetry={() => void summaryQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Analytics" }]}
        title="CRM Analytics"
        description={`Live PostgreSQL metrics · ${rangeLabel}`}
      />

      <AnalyticsFilterBar value={filters} onChange={setFilters} />

      {summaryQuery.isLoading ? (
        <KpiStripSkeleton count={6} className="md:grid-cols-3 xl:grid-cols-6" />
      ) : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Lead volume" value={String(summary?.leadVolume ?? "—")} />
          <MetricCard label="Qualified" value={String(summary?.qualifiedLeads ?? "—")} />
          <MetricCard label="Deals" value={String(summary?.deals ?? "—")} />
          <MetricCard label="Pipeline value" value={summary ? formatMoney(summary.pipelineValue) : "—"} />
          <MetricCard label="Conversion rate" value={summary ? formatPct(summary.conversionRate) : "—"} />
          <MetricCard
            label="Avg stage time"
            value={formatDuration(summary?.averageStageDurationSeconds)}
          />
        </section>
      )}

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Lead</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activities">Activity</TabsTrigger>
          <TabsTrigger value="conversions">Conversion</TabsTrigger>
          <TabsTrigger value="teams">Team</TabsTrigger>
          <TabsTrigger value="sources">Source</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Leads" value={String(leadsQuery.data?.leadVolume ?? "—")} />
            <MetricCard label="Qualified" value={String(leadsQuery.data?.qualifiedLeads ?? "—")} />
            <MetricCard
              label="Avg response"
              value={formatDuration(leadsQuery.data?.averageResponseTimeSeconds)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Lead volume by day"
              question={leadsQuery.data?.question}
              loading={leadsQuery.isLoading}
              empty={!leadsQuery.isLoading && (leadsQuery.data?.volumeByDay.length ?? 0) === 0}
            >
              <SoftIndigoLineChart
                data={(leadsQuery.data?.volumeByDay ?? []).map((p) => ({
                  label: p.label,
                  value: p.value,
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Leads by source"
              question="Which channels are generating lead volume?"
              loading={leadsQuery.isLoading}
              empty={!leadsQuery.isLoading && (leadsQuery.data?.bySource.length ?? 0) === 0}
            >
              <SoftIndigoBarChart
                data={(leadsQuery.data?.bySource ?? []).map((p) => ({
                  label: p.label,
                  value: p.value,
                }))}
              />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Open deals" value={String(pipelineQuery.data?.openDeals ?? "—")} />
            <MetricCard label="Won" value={String(pipelineQuery.data?.wonDeals ?? "—")} />
            <MetricCard label="Lost" value={String(pipelineQuery.data?.lostDeals ?? "—")} />
            <MetricCard
              label="Open value"
              value={pipelineQuery.data ? formatMoney(pipelineQuery.data.pipelineValue) : "—"}
            />
          </div>
          <ChartCard
            title="Open pipeline value by stage"
            question={pipelineQuery.data?.question}
            loading={pipelineQuery.isLoading}
            empty={
              !pipelineQuery.isLoading && (pipelineQuery.data?.openValueByStage.length ?? 0) === 0
            }
          >
            <SoftIndigoBarChart
              data={(pipelineQuery.data?.openValueByStage ?? []).map((p) => ({
                label: p.label,
                value: p.value,
              }))}
              valueFormatter={(v) => formatMoney(v)}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="activities" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Activities" value={String(activitiesQuery.data?.activities ?? "—")} />
            <MetricCard label="Completed" value={String(activitiesQuery.data?.completed ?? "—")} />
            <MetricCard label="Overdue" value={String(activitiesQuery.data?.overdue ?? "—")} />
            <MetricCard
              label="Avg per deal"
              value={activitiesQuery.data ? String(activitiesQuery.data.averagePerDeal) : "—"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Activities by type"
              question={activitiesQuery.data?.question}
              loading={activitiesQuery.isLoading}
              empty={!activitiesQuery.isLoading && (activitiesQuery.data?.byType.length ?? 0) === 0}
            >
              <SoftIndigoBarChart
                data={(activitiesQuery.data?.byType ?? []).map((p) => ({
                  label: p.label,
                  value: p.value,
                }))}
              />
            </ChartCard>
            <ChartCard
              title="Activity volume over time"
              question="Is follow-up activity consistent across the date range?"
              loading={activitiesQuery.isLoading}
              empty={!activitiesQuery.isLoading && (activitiesQuery.data?.byDay.length ?? 0) === 0}
            >
              <SoftIndigoLineChart
                data={(activitiesQuery.data?.byDay ?? []).map((p) => ({
                  label: p.label,
                  value: p.value,
                }))}
              />
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="conversions" className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard
              label="Lead → customer"
              value={
                conversionsQuery.data
                  ? formatPct(conversionsQuery.data.leadToCustomerRate)
                  : "—"
              }
            />
            <MetricCard
              label="Deal win rate"
              value={conversionsQuery.data ? formatPct(conversionsQuery.data.dealWinRate) : "—"}
            />
            <MetricCard
              label="Submissions"
              value={String(conversionsQuery.data?.submissions ?? "—")}
            />
            <MetricCard
              label="Positive outcomes"
              value={String(conversionsQuery.data?.positiveOutcomes ?? "—")}
            />
          </div>
          <ChartCard
            title="Conversion path"
            question={conversionsQuery.data?.question}
            loading={conversionsQuery.isLoading}
            empty={
              !conversionsQuery.isLoading &&
              (conversionsQuery.data?.conversionFunnel.length ?? 0) === 0
            }
          >
            <SoftIndigoFunnelChart
              data={(conversionsQuery.data?.conversionFunnel ?? []).map((p) => ({
                name: p.label,
                value: p.value,
              }))}
            />
          </ChartCard>
        </TabsContent>

        <TabsContent value="teams" className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Compare by</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="period">Period</SelectItem>
                  <SelectItem value="pipeline">Pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Sort by</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pipelineValue">Pipeline value</SelectItem>
                  <SelectItem value="deals">Deals</SelectItem>
                  <SelectItem value="wonDeals">Won deals</SelectItem>
                  <SelectItem value="leadVolume">Lead volume</SelectItem>
                  <SelectItem value="activities">Activities</SelectItem>
                  <SelectItem value="conversionRate">Conversion rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {groupBy === "period" ? (
              <div className="space-y-1">
                <Label className="text-[11px]">Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <ChartCard
            title="Factual comparison"
            question={teamsQuery.data?.question}
            loading={teamsQuery.isLoading}
            empty={!teamsQuery.isLoading && (teamsQuery.data?.rows.length ?? 0) === 0}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Leads</th>
                    <th className="py-2 pr-3 font-medium">Deals</th>
                    <th className="py-2 pr-3 font-medium">Won</th>
                    <th className="py-2 pr-3 font-medium">Activities</th>
                    <th className="py-2 pr-3 font-medium">Pipeline value</th>
                    <th className="py-2 font-medium">Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {(teamsQuery.data?.rows ?? []).map((r) => (
                    <tr key={`${r.entityType}-${r.entityId}`} className="border-b border-border/70">
                      <td className="py-2.5 pr-3 font-medium">{r.entityName}</td>
                      <td className="py-2.5 pr-3">{r.leadVolume}</td>
                      <td className="py-2.5 pr-3">{r.deals}</td>
                      <td className="py-2.5 pr-3">{r.wonDeals}</td>
                      <td className="py-2.5 pr-3">{r.activities}</td>
                      <td className="py-2.5 pr-3">{formatMoney(r.pipelineValue)}</td>
                      <td className="py-2.5">{formatPct(r.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </TabsContent>

        <TabsContent value="sources" className="mt-3 space-y-3">
          <ChartCard
            title="Source performance"
            question={sourcesQuery.data?.question}
            loading={sourcesQuery.isLoading}
            empty={!sourcesQuery.isLoading && (sourcesQuery.data?.sources.length ?? 0) === 0}
          >
            <SoftIndigoBarChart
              data={(sourcesQuery.data?.sources ?? []).map((s) => ({
                label: s.source,
                value: s.pipelineValue || s.leads,
              }))}
              valueFormatter={(v) => (v > 100 ? formatMoney(v) : String(v))}
            />
          </ChartCard>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Leads</th>
                  <th className="px-3 py-2 font-medium">Customers</th>
                  <th className="px-3 py-2 font-medium">Deals</th>
                  <th className="px-3 py-2 font-medium">Won</th>
                  <th className="px-3 py-2 font-medium">Pipeline value</th>
                  <th className="px-3 py-2 font-medium">Lead conv. %</th>
                </tr>
              </thead>
              <tbody>
                {(sourcesQuery.data?.sources ?? []).map((s) => (
                  <tr key={s.source} className="border-b border-border/70">
                    <td className="px-3 py-2.5 font-medium">{s.source}</td>
                    <td className="px-3 py-2.5">{s.leads}</td>
                    <td className="px-3 py-2.5">{s.customers}</td>
                    <td className="px-3 py-2.5">{s.deals}</td>
                    <td className="px-3 py-2.5">{s.wonDeals}</td>
                    <td className="px-3 py-2.5">{formatMoney(s.pipelineValue)}</td>
                    <td className="px-3 py-2.5">{formatPct(s.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
