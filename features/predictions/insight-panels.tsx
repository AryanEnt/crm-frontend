"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type PredictionResult, type PredictionSignal } from "@/lib/api/crm";

export function InsightCard({ result }: { result: PredictionResult }) {
  const blocked =
    !result.available &&
    (result.insufficientHistoricalData ||
      (result.message || "").includes("Insufficient") ||
      (result.explanation?.summary || "").includes("Insufficient"));

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold capitalize">
          {result.insightType.replaceAll("_", " ")}
        </h3>
        <span className="text-[11px] text-foreground-subtle">
          {result.strategyCode} · v{result.strategyVersion}
        </span>
      </div>

      {blocked ? (
        <p className="text-sm font-medium text-warning">Insufficient historical data.</p>
      ) : (
        <>
          <p className="text-kpi text-brand">
            {result.score != null ? Math.round(result.score) : "—"}
          </p>
          <p className="mt-0.5 text-sm text-foreground">{result.label}</p>
        </>
      )}

      <p className="mt-2 text-xs text-foreground-muted">{result.explanation?.summary}</p>

      {result.explanation?.neutralNotes?.length ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-foreground-subtle">
          {result.explanation.neutralNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <SignalList title="Positive signals" signals={result.explanation?.positiveSignals ?? []} tone="positive" />
      <SignalList title="Negative signals" signals={result.explanation?.negativeSignals ?? []} tone="negative" />

      <p className="mt-3 text-[10px] leading-snug text-foreground-subtle">{result.disclaimer}</p>
      <p className="mt-1 text-[10px] text-foreground-subtle">
        Computed {new Date(result.computedAt).toLocaleString()}
      </p>
    </article>
  );
}

function SignalList({
  title,
  signals,
  tone,
}: {
  title: string;
  signals: PredictionSignal[];
  tone: "positive" | "negative";
}) {
  if (!signals.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] font-medium text-foreground-muted">{title}</p>
      <ul className="space-y-1">
        {signals.map((s) => (
          <li
            key={`${s.code}-${s.label}-${s.impact}`}
            className={
              tone === "positive"
                ? "rounded border border-emerald-200/60 bg-emerald-50/50 px-2 py-1 text-xs"
                : "rounded border border-rose-200/60 bg-rose-50/50 px-2 py-1 text-xs"
            }
          >
            <span className="font-medium">{s.label}</span>
            {s.detail ? <span className="text-foreground-muted"> — {s.detail}</span> : null}
            {s.impact !== 0 ? (
              <span className="ml-1 tabular-nums text-foreground-subtle">
                ({s.impact > 0 ? "+" : ""}
                {s.impact})
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeadInsightsPanel({ leadId }: { leadId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const enabled = can("predictions:view") || can("predictions:manage");

  const query = useQuery({
    queryKey: ["lead-insights", leadId],
    queryFn: () => crmApi.leadInsights(leadId),
    enabled: enabled && !!leadId,
  });

  const historyQuery = useQuery({
    queryKey: ["lead-score-history", leadId],
    queryFn: () => crmApi.leadScoreHistory(leadId),
    enabled: enabled && !!leadId,
  });

  const refresh = useMutation({
    mutationFn: () => crmApi.scoreLead(leadId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lead-insights", leadId] });
      void qc.invalidateQueries({ queryKey: ["lead-score-history", leadId] });
      toast.success("Lead score refreshed");
    },
    onError: (err: Error) => toast.error(err.message || "Could not refresh score"),
  });

  if (!enabled) return null;
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const { leadScore, insights, disclaimer } = query.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Lead score & insights</h3>
          <p className="text-[11px] text-foreground-subtle">{disclaimer}</p>
        </div>
        {(can("predictions:manage") || can("predictions:view")) && (
          <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            Refresh score
          </Button>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <InsightCard result={leadScore} />
        {insights.map((ins) => (
          <InsightCard key={ins.insightType} result={ins} />
        ))}
      </div>
      {(historyQuery.data?.length ?? 0) > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-3">
          <h4 className="mb-2 text-xs font-semibold text-foreground-muted">Score history</h4>
          <ul className="space-y-1 text-xs">
            {historyQuery.data!.slice(0, 8).map((h) => (
              <li key={h.id} className="flex justify-between gap-2">
                <span className="font-medium tabular-nums text-brand">
                  {Math.round(h.score)}
                </span>
                <span className="text-foreground-subtle">
                  {h.strategyCode} · {new Date(h.computedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function DealInsightsPanel({ dealId }: { dealId: string }) {
  const { can } = useAuth();
  const enabled = can("predictions:view") || can("predictions:manage");

  const query = useQuery({
    queryKey: ["deal-insights", dealId],
    queryFn: () => crmApi.dealInsights(dealId),
    enabled: enabled && !!dealId,
  });

  if (!enabled) return null;
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-foreground-subtle">{query.data.disclaimer}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {query.data.insights.map((ins) => (
          <InsightCard key={ins.insightType} result={ins} />
        ))}
      </div>
    </div>
  );
}
