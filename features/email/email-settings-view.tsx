"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { emailApi, type EmailAccount } from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";

function statusTone(s: string): "success" | "warning" | "danger" | "brand" | "neutral" {
  if (s === "connected") return "success";
  if (s === "syncing") return "brand";
  if (s === "needs_reauth" || s === "error") return "warning";
  return "neutral";
}

function statusLabel(s: string) {
  switch (s) {
    case "connected":
      return "Connected";
    case "syncing":
      return "Syncing";
    case "needs_reauth":
      return "Reconnect needed";
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

/** Status of company IMAP mailboxes only — no Gmail/Google connect. */
export function EmailSettingsView() {
  const qc = useQueryClient();
  const { user, can } = useAuth();
  const isSe = user?.roleCode === "sales_executive";
  const canManageTeamMail = user?.roleCode === "sales_manager" || can("email:manage");
  const [disconnectTarget, setDisconnectTarget] = React.useState<EmailAccount | null>(null);

  const query = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => emailApi.disconnect(id),
    onSuccess: () => {
      toast.success("Mailbox disconnected");
      setDisconnectTarget(null);
      void qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't disconnect the mailbox");
    },
  });

  const sync = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      toast.success("Inbox sync started");
      void qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start sync");
    },
  });

  if (query.isLoading) return <LoadingState label="Loading email accounts…" />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const integration = query.data?.integration;
  // Company IMAP only — ignore any leftover Gmail rows in the UI.
  const accounts = (query.data?.accounts ?? []).filter((a) => a.provider !== "gmail");
  const configured = Boolean(integration?.configured);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Email accounts</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foreground-muted">
          {isSe
            ? "Your Team Lead connects your company mailbox under Team Email."
            : "Company mailboxes are connected under Team Email. This page only shows your own linked mailbox status."}
        </p>
      </header>

      {!configured ? (
        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Email isn’t available yet</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Ask a Super Admin to finish Email sync setup before mailboxes can be connected.
          </p>
        </div>
      ) : null}

      {configured && accounts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">No company mailbox on this account</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {isSe
              ? "Please contact your Team Lead. They connect your mailbox from Team Email — you do not enter a password here."
              : "Connect sales executive (and your own) company IMAP mailboxes from Team Email."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {canManageTeamMail ? (
              <Button className="rounded-xl" asChild>
                <Link href="/email/team">Open Team Email</Link>
              </Button>
            ) : null}
            <Button className="rounded-xl" variant="outline" asChild>
              <Link href="/email">Back to Email</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <div className="mb-8 space-y-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              syncing={sync.isPending}
              readOnly={isSe}
              onDisconnect={() => setDisconnectTarget(a)}
              onSync={() => sync.mutate(a.id)}
            />
          ))}
          {canManageTeamMail ? (
            <p className="text-sm text-foreground-muted">
              Manage team mailboxes in{" "}
              <Link href="/email/team" className="font-medium text-brand hover:underline">
                Team Email
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => {
          if (!open && !disconnect.isPending) setDisconnectTarget(null);
        }}
        title="Disconnect this mailbox?"
        description={
          disconnectTarget
            ? `${disconnectTarget.emailAddress} will stop syncing with Aurora. You can connect it again later from Team Email. Existing emails already in the CRM stay available.`
            : undefined
        }
        confirmLabel="Disconnect"
        cancelLabel="Keep connected"
        destructive
        loading={disconnect.isPending}
        onConfirm={() => {
          if (disconnectTarget) disconnect.mutate(disconnectTarget.id);
        }}
      />
    </div>
  );
}

function AccountCard({
  account,
  syncing,
  readOnly,
  onDisconnect,
  onSync,
}: {
  account: EmailAccount;
  syncing: boolean;
  readOnly?: boolean;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const needs = account.connectionStatus === "needs_reauth" || account.connectionStatus === "error";
  const healthy = account.connectionStatus === "connected" || account.connectionStatus === "syncing";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.04)]",
        needs ? "border-warning-border" : "border-border",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4 px-6 py-5 sm:px-8">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Company mailbox</p>
            <p className="truncate text-base font-semibold tracking-tight text-foreground">
              {account.displayName || account.emailAddress}
            </p>
            <p className="truncate text-sm text-foreground-muted">{account.emailAddress}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone(account.connectionStatus)}>{statusLabel(account.connectionStatus)}</StatusBadge>
              {healthy ? (
                <span className="inline-flex items-center gap-1 text-[13px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Sync active
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-[13px] text-foreground-muted">Last synced {relative(account.lastSyncAt)}</p>
            {account.lastSyncError ? (
              <p className="mt-1 max-w-md text-[13px] text-destructive">{account.lastSyncError}</p>
            ) : null}
            {readOnly && needs ? (
              <p className="mt-2 text-[13px] text-foreground-muted">
                Ask your Team Lead to update the mailbox login in Team Email.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" asChild>
            <Link href="/email">Open Email</Link>
          </Button>
          {(!readOnly || healthy) && !needs ? (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onSync} loading={syncing} disabled={syncing}>
              <RefreshCw className="size-3.5" aria-hidden />
              Sync now
            </Button>
          ) : null}
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onDisconnect}
            >
              <Unplug className="size-3.5" aria-hidden />
              Disconnect
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
