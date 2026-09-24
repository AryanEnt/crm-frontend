"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crmApi } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { formatMoney } from "@/features/analytics/charts";

export function ForecastsView() {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);

  const [pipelineId, setPipelineId] = React.useState("");
  const [teamId, setTeamId] = React.useState("all");
  const [ownerUserId, setOwnerUserId] = React.useState("all");
  const [from, setFrom] = React.useState(quarterStart.toISOString().slice(0, 10));
  const [to, setTo] = React.useState(quarterEnd.toISOString().slice(0, 10));
  const [historyFrom, setHistoryFrom] = React.useState(
    new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10),
  );
  const [historyTo, setHistoryTo] = React.useState(now.toISOString().slice(0, 10));

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "forecasts"],
    queryFn: () => crmApi.listPipelines("sales"),
  });

  React.useEffect(() => {
    if (!pipelineId && pipelinesQuery.data?.length) {
      const preferred =
        pipelinesQuery.data.find((p) => p.isDefault) ?? pipelinesQuery.data[0];
      if (preferred) setPipelineId(preferred.id);
    }
  }, [pipelinesQuery.data, pipelineId]);

  const teamsQuery = useQuery({
    queryKey: ["teams", "forecasts"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "forecasts"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });
  const methodQuery = useQuery({
    queryKey: ["forecast-methodology"],
    queryFn: () => crmApi.forecastMethodology(),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({
      pipelineId,
      from,
      to,
      historyFrom,
      historyTo,
    });
    if (teamId !== "all") p.set("teamId", teamId);
    if (ownerUserId !== "all") p.set("ownerUserId", ownerUserId);
    return p;
  }, [pipelineId, from, to, historyFrom, historyTo, teamId, ownerUserId]);

  const forecastQuery = useQuery({
    queryKey: ["pipeline-forecast", params.toString()],
    queryFn: () => crmApi.pipelineForecast(params),
    enabled: !!pipelineId,
  });

  if (forecastQuery.isError) {
    return <ErrorState onRetry={() => void forecastQuery.refetch()} />;
  }

  const data = forecastQuery.data;
  const t = data?.transparency;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Forecasts" }]}
        title="Forecasts"
        description="Transparent pipeline projections — estimates, not guarantees."
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-[11px]">Pipeline</Label>
          <Select value={pipelineId || "none"} onValueChange={(v) => setPipelineId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select…</SelectItem>
              {(pipelinesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Forecast from</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Forecast to</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">History from</Label>
          <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">History to</Label>
          <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
        </div>
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
        <div className="space-y-1 xl:col-span-2">
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
      </div>

      {!pipelineId ? (
        <EmptyState title="Select a pipeline" description="Forecasts require a pipeline context." />
      ) : forecastQuery.isLoading ? (
        <LoadingState />
      ) : !data ? null : (
        <>
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-foreground">
            {data.disclaimer}
          </p>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="Open deals" value={String(data.openDealCount)} />
            <MetricCard label="Open pipeline" value={formatMoney(data.openPipelineValue)} />
            <MetricCard label="Sample size" value={String(t?.sampleSize ?? 0)} />
            <MetricCard
              label="Hist. win rate"
              value={
                typeof t?.inputs.historicalWinRate === "number"
                  ? `${Number(t.inputs.historicalWinRate).toFixed(1)}%`
                  : "—"
              }
            />
          </div>

          {data.available && data.scenarios ? (
            <section className="grid gap-3 sm:grid-cols-3">
              <ScenarioCard
                title="Conservative"
                value={formatMoney(data.scenarios.conservative)}
                hint="Lower-case estimate (0.7× expected weight)"
              />
              <ScenarioCard
                title="Expected"
                value={formatMoney(data.scenarios.expected)}
                hint="Central estimate from stage + history blend"
                emphasize
              />
              <ScenarioCard
                title="Higher-case"
                value={formatMoney(data.scenarios.higherCase)}
                hint="Upper-case estimate (1.3×, capped)"
              />
            </section>
          ) : (
            <EmptyState
              title="Insufficient history"
              description={data.message || methodQuery.data?.insufficientMessage}
            />
          )}

          {t ? (
            <section className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <h3 className="text-sm font-semibold">Forecast transparency</h3>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <Info label="Period" value={`${t.period.from} → ${t.period.to}`} />
                <Info label="Pipeline" value={t.pipelineName} />
                <Info label="Sample size (closed deals)" value={String(t.sampleSize)} />
                <Info
                  label="Historical data range"
                  value={`${t.historicalDataRange.from} → ${t.historicalDataRange.to}`}
                />
                <Info label="Methodology" value={`${t.methodology.name} (${t.methodology.code})`} />
                <Info
                  label="Deals included in period"
                  value={String(t.inputs.dealsIncludedInPeriod ?? "—")}
                />
              </dl>
              <div className="rounded-md bg-surface-muted p-3 text-xs text-foreground-muted">
                <p className="mb-1 font-medium text-foreground">Inputs</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>Open pipeline value: {formatMoney(Number(t.inputs.openPipelineValue ?? 0))}</li>
                  <li>Open deal count: {String(t.inputs.openDealCount ?? 0)}</li>
                  <li>Historical win rate: {String(t.inputs.historicalWinRate ?? 0)}%</li>
                  <li>Min closed sample required: {String(t.inputs.minClosedSample ?? 10)}</li>
                </ul>
                <p className="mt-2 font-medium text-foreground">Methodology</p>
                <p className="mt-0.5">{t.methodology.description}</p>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ScenarioCard({
  title,
  value,
  hint,
  emphasize,
}: {
  title: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={
        emphasize
          ? "rounded-lg border border-brand/40 bg-brand-soft/40 p-4"
          : "rounded-lg border border-border bg-surface p-4"
      }
    >
      <p className="text-xs font-medium text-foreground-muted">{title}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-foreground-subtle">{hint}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
