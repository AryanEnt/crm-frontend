"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi } from "@/lib/api/email";

function Row({ label, ok, extra }: { label: string; ok: boolean; extra?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-2">
        {extra ? <span className="text-xs text-foreground-muted">{extra}</span> : null}
        <StatusBadge tone={ok ? "success" : "warning"}>{ok ? "Configured" : "Not configured"}</StatusBadge>
      </span>
    </div>
  );
}

export function GmailAdminView() {
  const q = useQuery({ queryKey: ["email-health"], queryFn: () => emailApi.health() });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  const h = q.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gmail integration"
        description="System health for Google OAuth, Gmail API, and push sync. User mailboxes are not shown here."
      />
      {!h.configured ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">Gmail integration is not configured</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and optionally GMAIL_PUBSUB_TOPIC on the API
            server. Redirect URI: PUBLIC_API_URL/api/v1/email/google/callback
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-surface px-5">
        <Row label="OAuth" ok={h.oauthConfigured} />
        <Row label="Gmail API" ok={h.gmailApiEnabled} />
        <Row label="Pub/Sub" ok={h.pubSubConfigured} extra={h.pubSubConfigured ? "Connected" : undefined} />
        <Row label="Push sync" ok={h.pushSyncHealthy} extra={h.pushSyncHealthy ? "Healthy" : "Attention"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-foreground-subtle">Connected accounts</p>
          <p className="mt-1 text-2xl font-semibold">{h.connectedAccounts}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-foreground-subtle">Accounts requiring attention</p>
          <p className="mt-1 text-2xl font-semibold">{h.needsAttention}</p>
        </div>
      </div>
    </div>
  );
}
