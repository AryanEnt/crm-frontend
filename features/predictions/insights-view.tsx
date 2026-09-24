"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InsightCard, LeadInsightsPanel } from "@/features/predictions/insight-panels";
import { crmApi } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { useAuth } from "@/features/auth/auth-provider";

export function InsightsView() {
  const { can, user } = useAuth();
  const [pipelineId, setPipelineId] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState(user?.id ?? "all");
  const [leadId, setLeadId] = React.useState("");

  const catalogQuery = useQuery({
    queryKey: ["predictions-catalog"],
    queryFn: () => crmApi.predictionsCatalog(),
    enabled: can("predictions:view") || can("predictions:manage"),
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "insights"],
    queryFn: () => crmApi.listPipelines("sales"),
  });

  React.useEffect(() => {
    if (!pipelineId && pipelinesQuery.data?.length) {
      const preferred =
        pipelinesQuery.data.find((p) => p.isDefault) ?? pipelinesQuery.data[0];
      if (preferred) setPipelineId(preferred.id);
    }
  }, [pipelinesQuery.data, pipelineId]);

  const usersQuery = useQuery({
    queryKey: ["users", "insights"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const riskParams = React.useMemo(() => {
    const p = new URLSearchParams();
    if (pipelineId) p.set("pipelineId", pipelineId);
    return p;
  }, [pipelineId]);

  const riskQuery = useQuery({
    queryKey: ["pipeline-risk", riskParams.toString()],
    queryFn: () => crmApi.pipelineRisk(riskParams),
    enabled: !!pipelineId && (can("predictions:view") || can("predictions:manage")),
  });

  const workloadParams = React.useMemo(() => {
    const p = new URLSearchParams();
    if (ownerUserId && ownerUserId !== "all") p.set("ownerUserId", ownerUserId);
    return p;
  }, [ownerUserId]);

  const workloadQuery = useQuery({
    queryKey: ["workload-forecast", workloadParams.toString()],
    queryFn: () => crmApi.workloadForecast(workloadParams),
    enabled: can("predictions:view") || can("predictions:manage"),
  });

  if (catalogQuery.isError) {
    return <ErrorState onRetry={() => void catalogQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Insights" }]}
        title="Predictive insights"
        description="Explainable estimates from CRM signals — not guaranteed outcomes."
      />

      {catalogQuery.data ? (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground-muted">
          {catalogQuery.data.disclaimer} Strategies are versioned (
          {catalogQuery.data.strategies.map((s) => s.code).join(", ")}). Historical insights need at
          least {catalogQuery.data.minHistoricalSample} closed samples; otherwise you will see
          &ldquo;{catalogQuery.data.insufficientHistoricalData}&rdquo;
        </p>
      ) : (
        <LoadingState />
      )}

      <section className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Pipeline risk</Label>
          <Select value={pipelineId || "none"} onValueChange={(v) => setPipelineId(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select…</SelectItem>
              {(pipelinesQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Workload owner</Label>
          <Select value={ownerUserId || "all"} onValueChange={setOwnerUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Me (session)</SelectItem>
              {(usersQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Lead ID (score panel)</Label>
          <Input
            value={leadId}
            onChange={(e) => setLeadId(e.target.value.trim())}
            placeholder="Paste lead UUID…"
          />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {riskQuery.isLoading ? <LoadingState /> : null}
        {riskQuery.data ? <InsightCard result={riskQuery.data} /> : null}
        {workloadQuery.isLoading ? <LoadingState /> : null}
        {workloadQuery.data ? <InsightCard result={workloadQuery.data} /> : null}
      </div>

      {leadId ? (
        <LeadInsightsPanel leadId={leadId} />
      ) : (
        <EmptyState
          title="Inspect a lead"
          description="Paste a lead ID above, or open Insights from the leads table, to see scored signals and history."
        />
      )}
    </div>
  );
}
