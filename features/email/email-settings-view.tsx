"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi, type EmailAccount } from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function statusTone(s: string): "success" | "warning" | "danger" | "brand" | "neutral" {
  if (s === "connected") return "success";
  if (s === "syncing") return "brand";
  if (s === "needs_reauth" || s === "error") return "warning";
  return "neutral";
}

function statusLabel(s: string) {
  switch (s) {
    case "connected":
      return "Gmail connected";
    case "syncing":
      return "Syncing";
    case "needs_reauth":
      return "Reconnect Gmail";
    case "error":
      return "Sync problem";
    default:
      return "Not connected";
  }
}

function relative(iso?: string | null) {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  const d = Date.now() - t;
  if (d < 60_000) return "Just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} hours ago`;
  return new Date(iso).toLocaleString();
}

export function EmailSettingsView() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const query = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });

  React.useEffect(() => {
    const g = params.get("gmail");
    if (g === "connected") toast.success("Gmail connected");
    if (g === "denied") toast.error("Gmail authorization was cancelled");
    if (g === "error" || g === "invalid") toast.error("Could not complete Gmail authorization");
  }, [params]);

  const connect = useMutation({
    mutationFn: () =>
      emailApi.connectGoogle(
        typeof window !== "undefined" ? `${window.location.origin}/settings/email` : undefined,
      ),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not start Gmail connect");
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => emailApi.disconnect(id),
    onSuccess: () => {
      toast.success("Gmail disconnected");
      void qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
  });

  const sync = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      toast.success("Sync started");
      void qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
  });

  if (query.isLoading) return <LoadingState label="Loading email accounts…" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const integration = query.data?.integration;
  const accounts = query.data?.accounts ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email & Calendar"
        description="Connect your own Gmail. Aurora never stores your password."
      />

      {!integration?.configured ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold">Gmail integration is not configured</h2>
          <p className="mt-1 max-w-lg text-sm text-foreground-muted">
            A Super Admin needs to add Google OAuth credentials before accounts can be connected.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-3">
              <GmailMark />
              <div>
                <p className="text-sm font-semibold">Google Gmail</p>
                <p className="mt-0.5 text-sm text-foreground-muted">
                  Send and receive emails directly from Aurora
                </p>
                <p className="mt-1 text-xs text-foreground-subtle">Your password is never stored</p>
              </div>
            </div>
            {accounts.length === 0 ? (
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                Connect Gmail
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {accounts.length === 0 && integration?.configured ? (
        <EmptyState
          icon={Mail}
          title="Connect your Gmail"
          description="Send and receive emails directly from Aurora."
          actionLabel="Connect Gmail"
          onAction={() => connect.mutate()}
        />
      ) : null}

      {accounts.map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          onDisconnect={() => {
            if (window.confirm("Disconnect this Gmail account from Aurora?")) {
              disconnect.mutate(a.id);
            }
          }}
          onSync={() => sync.mutate(a.id)}
          onReconnect={() => connect.mutate()}
        />
      ))}
    </div>
  );
}

function AccountCard({
  account,
  onDisconnect,
  onSync,
  onReconnect,
}: {
  account: EmailAccount;
  onDisconnect: () => void;
  onSync: () => void;
  onReconnect: () => void;
}) {
  const needs = account.connectionStatus === "needs_reauth";
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.avatarUrl}
              alt=""
              className="size-10 rounded-full object-cover"
            />
          ) : (
            <GmailMark />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">Gmail</p>
            <p className="text-sm font-semibold">{account.displayName || account.emailAddress}</p>
            <p className="text-sm text-foreground-muted">{account.emailAddress}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
              <span>✓ Sending enabled</span>
              <span>✓ Receiving enabled</span>
              <span>{account.connectionStatus === "connected" ? "✓ Sync active" : statusLabel(account.connectionStatus)}</span>
            </div>
            <p className="mt-2 text-xs text-foreground-subtle">Last synced: {relative(account.lastSyncAt)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge tone={statusTone(account.connectionStatus)}>
            {statusLabel(account.connectionStatus)}
          </StatusBadge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/email">Open Email</Link>
            </Button>
            {needs ? (
              <Button size="sm" onClick={onReconnect}>
                Reconnect Gmail
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onSync}>
                Sync now
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDisconnect}>
              <Unplug className="size-3.5" />
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GmailMark() {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-lg border border-border bg-white"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <path fill="#4285F4" d="M2 4.5A2.5 2.5 0 0 1 4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15Z" opacity=".08" />
        <path fill="#EA4335" d="M20 6.2v11.3c0 .8-.7 1.5-1.5 1.5H5.5c-.3 0-.5-.1-.7-.2L12 12.3 20 6.2Z" />
        <path fill="#34A853" d="M20 6.2 12 12.3 4 6.2V5.5C4 4.7 4.7 4 5.5 4h13c.8 0 1.5.7 1.5 1.5v.7Z" />
        <path fill="#FBBC04" d="M4 6.2v11.3c0 .10.0.1.1.2L12 12.3 4 6.2Z" />
        <path fill="#C5221F" d="M20 6.2 12 12.3l8 5.2V6.2Z" />
      </svg>
    </span>
  );
}
