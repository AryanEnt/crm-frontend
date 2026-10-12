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
  filtersToInsightParams,
  type AnalyticsFiltersState,
} from "@/features/analytics/filter-bar";
import { ChartCard, SoftIndigoFunnelChart, formatPct } from "@/features/analytics/charts";
import { MixedCurrencyNote } from "@/features/analytics/analytics-view";
import { formatLeadMoney } from "@/features/leads/lead-format";

export function SalesFunnelView() {
  const [filters, setFilters] = React.useState<AnalyticsFiltersState>(() => defaultAnalyticsFilters());
  const params = React.useMemo(() => filtersToInsightParams(filters), [filters]);

  const query = useQuery({
    queryKey: ["lead-insights", "overview", params.toString()],
    queryFn: () => crmApi.leadOverview(params),
  });

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const funnel = data?.funnel ?? [];
  const stripBy = new Map((data?.stages ?? []).map((s) => [s.id, s]));
  const progress = funnel.filter((f) => !f.isLost);
  const entered = progress[0]?.reached ?? 0;
  const won = funnel.find((f) => f.isWon)?.reached ?? 0;
  const lost = funnel.find((f) => f.isLost)?.reached ?? 0;
  const money = (v: number) => formatLeadMoney(v, data?.currency);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Sales Funnel" }]}
        title="Lead funnel"
        description={
          data?.pipeline
            ? `${data.pipeline.name} · ${filters.from} → ${filters.to}`
            : "Stage progression from recorded lead moves"
        }
      />

      <AnalyticsFilterBar value={filters} onChange={setFilters} showAnzsco={false} />
      <MixedCurrencyNote overview={data} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Entered the funnel" value={query.isLoading ? "—" : String(entered)} hint="Reached the first stage" />
        <MetricCard label="Reached Won" value={query.isLoading ? "—" : String(won)} />
        <MetricCard label="Reached Lost" value={query.isLoading ? "—" : String(lost)} />
        <MetricCard
          label="Win rate"
          value={data?.winRate != null ? formatPct(data.winRate) : "—"}
          hint="Won ÷ (won + lost), by close date"
        />
      </section>

      <ChartCard
        title="Stage funnel"
        question="How many leads reached each stage in the range?"
        loading={query.isLoading}
        empty={!query.isLoading && progress.every((f) => f.reached === 0)}
        emptyDescription="Stage history starts when leads are created or moved in this pipeline."
      >
        <SoftIndigoFunnelChart data={progress.map((f) => ({ name: f.name, value: f.reached }))} />
      </ChartCard>

      <ChartCard
        title="Stage detail"
        question="Reached counts leads that got at least this far. In stage counts open leads now, and leads won or lost in the range."
        loading={query.isLoading}
        empty={!query.isLoading && funnel.length === 0}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-foreground-subtle">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 text-right font-medium">Reached</th>
                <th className="py-2 pr-3 text-right font-medium">Of entered</th>
                <th className="py-2 pr-3 text-right font-medium">From previous</th>
                <th className="py-2 pr-3 text-right font-medium">In stage</th>
                <th className="py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {funnel.map((f) => {
                const i = progress.findIndex((p) => p.stageId === f.stageId);
                const prev = i > 0 ? progress[i - 1].reached : 0;
                const strip = stripBy.get(f.stageId);
                return (
                  <tr key={f.stageId} className="border-b border-border/70">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{f.name}</span>
                        {f.isWon ? <StatusBadge tone="success">won</StatusBadge> : null}
                        {f.isLost ? <StatusBadge tone="danger">lost</StatusBadge> : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right">{f.reached}</td>
                    <td className="py-2.5 pr-3 text-right">{entered > 0 ? formatPct(f.rate) : "—"}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {f.isLost || i <= 0 || prev === 0 ? "—" : formatPct((f.reached / prev) * 100)}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{strip?.count ?? 0}</td>
                    <td className="py-2.5 text-right">{money(strip?.value ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
