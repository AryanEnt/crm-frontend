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
        <StatusBadge tone={ok ? "success" : "warning"}>{ok ? "Ready" : "Needs setup"}</StatusBadge>
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
        title="Email sync"
        description="Health of Google sign-in, mailbox access, and automatic inbox updates. Individual mailboxes stay on each user’s Email accounts page."
      />
      {!h.configured ? (
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">Email sync is not set up</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Add Google Client ID and Client Secret on the API server, then set the redirect URI to
            your public API URL ending in /api/v1/email/google/callback. Optional: a Pub/Sub topic
            for push inbox updates.
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-surface px-5">
        <Row label="Google sign-in" ok={h.oauthConfigured} />
        <Row label="Mailbox access" ok={h.gmailApiEnabled} />
        <Row
          label="Push inbox updates"
          ok={h.pubSubConfigured}
          extra={h.pubSubConfigured ? "Connected" : undefined}
        />
        <Row
          label="Live sync"
          ok={h.pushSyncHealthy}
          extra={h.pushSyncHealthy ? "Healthy" : "Needs attention"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-foreground-subtle">Connected accounts</p>
          <p className="mt-1 text-kpi">{h.connectedAccounts}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-foreground-subtle">Accounts needing attention</p>
          <p className="mt-1 text-kpi">{h.needsAttention}</p>
        </div>
      </div>
    </div>
  );
}
