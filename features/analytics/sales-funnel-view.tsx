"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { crmApi } from "@/lib/api/crm";
import {
  AnalyticsFilterBar,
  defaultAnalyticsFilters,
  filtersToParams,
  type AnalyticsFiltersState,
} from "@/features/analytics/filter-bar";
import {
  ChartCard,
  SoftIndigoFunnelChart,
  SoftIndigoBarChart,
  formatDuration,
  formatMoney,
  formatPct,
} from "@/features/analytics/charts";

export function SalesFunnelView() {
  const [filters, setFilters] = React.useState<AnalyticsFiltersState>(() =>
    defaultAnalyticsFilters(),
  );
  const params = React.useMemo(() => filtersToParams(filters), [filters]);

  const query = useQuery({
    queryKey: ["analytics-funnel", params.toString()],
    queryFn: () => crmApi.analyticsFunnel(params),
  });

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const stages = data?.stages ?? [];
  const funnelData = stages
    .filter((s) => !s.isLost)
    .map((s) => ({ name: s.stageName, value: s.entered }));

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Sales Funnel" }]}
        title="Sales Funnel"
        description={
          data
            ? `${data.pipelineName} · ${data.from.slice(0, 10)} → ${data.to.slice(0, 10)}`
            : "Stage conversion from live pipeline data"
        }
      />

      <AnalyticsFilterBar value={filters} onChange={setFilters} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Entered first stage"
          value={String(data?.totals.entered ?? "—")}
        />
        <MetricCard
          label="Open pipeline value"
          value={data ? formatMoney(data.totals.totalPipelineValue) : "—"}
        />
        <MetricCard
          label="Avg deal value"
          value={data ? formatMoney(data.totals.averageDealValue) : "—"}
        />
        <MetricCard
          label="Win rate (closed)"
          value={data ? formatPct(data.totals.overallConversionRate) : "—"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Stage funnel"
          question="How many records enter each stage of the selected pipeline?"
          loading={query.isLoading}
          empty={!query.isLoading && funnelData.every((d) => d.value === 0)}
        >
          <SoftIndigoFunnelChart data={funnelData} />
        </ChartCard>

        <ChartCard
          title="Conversion vs drop-off"
          question="What share of entrants progress to the next stage versus drop off?"
          loading={query.isLoading}
          empty={!query.isLoading && stages.length === 0}
        >
          <SoftIndigoBarChart
            data={stages
              .filter((s) => !s.isWon && !s.isLost)
              .map((s) => ({
                label: s.stageName,
                value: s.conversionRate,
                dropOff: s.dropOffRate,
              }))}
            valueFormatter={(v) => formatPct(v)}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Stage detail"
        question="Entered, left, time-in-stage, and open value for each pipeline stage."
        loading={query.isLoading}
        empty={!query.isLoading && stages.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 font-medium">Entered</th>
                <th className="py-2 pr-3 font-medium">Left</th>
                <th className="py-2 pr-3 font-medium">Conversion</th>
                <th className="py-2 pr-3 font-medium">Drop-off</th>
                <th className="py-2 pr-3 font-medium">Avg time</th>
                <th className="py-2 pr-3 font-medium">Open value</th>
                <th className="py-2 font-medium">Avg deal</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stageId} className="border-b border-border/70">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.stageName}</span>
                      {s.isWon ? <StatusBadge tone="success">won</StatusBadge> : null}
                      {s.isLost ? <StatusBadge tone="danger">lost</StatusBadge> : null}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">{s.entered}</td>
                  <td className="py-2.5 pr-3">{s.left}</td>
                  <td className="py-2.5 pr-3">
                    {s.isWon || s.isLost ? "—" : formatPct(s.conversionRate)}
                  </td>
                  <td className="py-2.5 pr-3">
                    {s.isWon || s.isLost ? "—" : formatPct(s.dropOffRate)}
                  </td>
                  <td className="py-2.5 pr-3">{formatDuration(s.avgTimeInStageSeconds)}</td>
                  <td className="py-2.5 pr-3">{formatMoney(s.totalPipelineValue)}</td>
                  <td className="py-2.5">{formatMoney(s.averageDealValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
