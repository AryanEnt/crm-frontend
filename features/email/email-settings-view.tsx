"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Unplug,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi, type EmailAccount } from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";

type TestStatus = { kind: "idle" } | { kind: "success" } | { kind: "error"; message: string };

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

export function EmailSettingsView() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [disconnectTarget, setDisconnectTarget] = React.useState<EmailAccount | null>(null);

  const query = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });

  React.useEffect(() => {
    const g = params.get("gmail");
    if (g === "connected") toast.success("Gmail connected");
    if (g === "denied") toast.error("Gmail authorization was cancelled. Connect again when ready.");
    if (g === "error" || g === "invalid") {
      toast.error("Couldn't finish Gmail authorization. Try connecting again.");
    }
  }, [params]);

  const connectGoogle = useMutation({
    mutationFn: () =>
      emailApi.connectGoogle(
        typeof window !== "undefined" ? `${window.location.origin}/settings/email` : undefined,
      ),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err: Error) => {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't start Gmail connect. Check Email sync setup with your admin.",
      );
    },
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
  const accounts = query.data?.accounts ?? [];
  const hasGmail = accounts.some((a) => a.provider === "gmail");
  const hasImap = accounts.some((a) => a.provider === "imap");
  const invite = params.get("invite") || "";
  const configured = Boolean(integration?.configured);
  const showImapForm = configured && Boolean(integration?.imapConfigured) && !hasImap;
  const showGmailOption = configured && Boolean(integration?.oauthConfigured) && !hasGmail;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Email accounts</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foreground-muted">
          Connect the mailbox you send from. Everything syncs into your CRM timeline automatically.
        </p>
      </header>

      {invite && showImapForm ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">You’re invited to connect</p>
            <p className="mt-0.5 text-[13px] text-foreground-muted">
              Your team lead asked you to link your company mailbox. Use the same login as Thunderbird — they never
              see your password.
            </p>
          </div>
        </div>
      ) : null}

      {!configured ? (
        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Email isn’t available yet</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Ask a Super Admin to finish Email sync setup before you connect a mailbox.
          </p>
        </div>
      ) : null}

      {accounts.length > 0 ? (
        <div className="mb-8 space-y-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              syncing={sync.isPending}
              onDisconnect={() => setDisconnectTarget(a)}
              onSync={() => sync.mutate(a.id)}
              onReconnect={() => (a.provider === "gmail" ? connectGoogle.mutate() : undefined)}
              reconnectPending={connectGoogle.isPending}
            />
          ))}
        </div>
      ) : null}

      {showImapForm ? <CompanyMailboxCard inviteToken={invite} /> : null}

      {showImapForm && showGmailOption ? (
        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
              Or, optionally
            </span>
          </div>
        </div>
      ) : null}

      {showGmailOption ? (
        <GmailOptionalRow
          onConnect={() => connectGoogle.mutate()}
          pending={connectGoogle.isPending}
          withDivider={!showImapForm && accounts.length > 0}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => {
          if (!open && !disconnect.isPending) setDisconnectTarget(null);
        }}
        title="Disconnect this mailbox?"
        description={
          disconnectTarget
            ? `${disconnectTarget.emailAddress} will stop syncing with Aurora. You can connect it again later. Existing emails already in the CRM stay available.`
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

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  leading,
  trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted [&_svg]:size-4">
            {leading}
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            "h-12 w-full rounded-xl border border-border bg-surface text-sm text-foreground shadow-xs transition-[border-color,box-shadow]",
            "placeholder:text-foreground-muted/70",
            leading ? "pl-11" : "px-3.5",
            trailing ? "pr-11" : "pr-3.5",
            "hover:border-border-strong",
            "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
          )}
        />
        {trailing ? <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function CompanyMailboxCard({ inviteToken }: { inviteToken: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [testStatus, setTestStatus] = React.useState<TestStatus>({ kind: "idle" });

  React.useEffect(() => {
    if (!inviteToken) return;
    void emailApi.peekInvite(inviteToken).then((r) => {
      if (r.invite?.emailAddress) setEmail(r.invite.emailAddress);
    });
  }, [inviteToken]);

  const setEmailValue = (v: string) => {
    setEmail(v);
    setTestStatus({ kind: "idle" });
  };
  const setPasswordValue = (v: string) => {
    setPassword(v);
    setTestStatus({ kind: "idle" });
  };

  const connectImap = useMutation({
    mutationFn: () =>
      emailApi.connectImap({
        emailAddress: email,
        password,
        inviteToken: inviteToken || undefined,
      }),
    onSuccess: () => {
      setPassword("");
      setTestStatus({ kind: "idle" });
      toast.success("Company mailbox connected");
      void qc.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: (err: Error) => {
      const message = err instanceof ApiError ? err.message : "Could not connect the mailbox";
      setTestStatus({ kind: "error", message });
      toast.error(message);
    },
  });

  const test = useMutation({
    mutationFn: () => emailApi.testImap({ emailAddress: email, password }),
    onSuccess: () => {
      setTestStatus({ kind: "success" });
    },
    onError: (err: Error) => {
      setTestStatus({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Connection test failed",
      });
    },
  });

  const canSubmit = email.trim().length > 3 && password.length > 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_rgb(0_0_0/0.04)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative space-y-6 px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
        <div className="flex items-start gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Company mailbox</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Recommended
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
              Use the same login as Thunderbird. Keep using Thunderbird as usual — Aurora syncs alongside it.
            </p>
          </div>
        </div>

        <form
          id="company-mailbox"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) connectImap.mutate();
          }}
        >
          <Field
            id="imap-email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmailValue}
            placeholder="you@entegrasources.com.np"
            autoComplete="email"
            leading={<Mail aria-hidden />}
          />
          <Field
            id="imap-password"
            label="Mailbox password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPasswordValue}
            autoComplete="current-password"
            leading={<Lock aria-hidden />}
            trailing={
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            }
          />

          <div className="min-h-5" aria-live="polite">
            {testStatus.kind === "success" ? (
              <p className="flex items-center gap-1.5 text-[13px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                Connection successful — you&apos;re good to connect.
              </p>
            ) : null}
            {testStatus.kind === "error" ? (
              <p className="flex items-start gap-1.5 text-[13px] text-destructive">
                <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{testStatus.message}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={!canSubmit || test.isPending || connectImap.isPending}
              onClick={() => test.mutate()}
              className="h-11 rounded-xl px-5 ring-1 ring-border hover:bg-surface-muted"
            >
              {test.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Test connection
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || connectImap.isPending || test.isPending}
              className="h-11 rounded-xl px-7 font-semibold shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
            >
              {connectImap.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Connect mailbox
            </Button>
          </div>
        </form>
      </div>

      <div className="relative flex items-start gap-2.5 border-t border-border bg-surface-muted/40 px-6 py-4 sm:px-8">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[13px] leading-relaxed text-foreground-muted">
          Your password is encrypted on the server and never shown again. Disconnect anytime without losing synced
          history.
        </p>
      </div>
    </section>
  );
}

function GmailOptionalRow({
  onConnect,
  pending,
  withDivider,
}: {
  onConnect: () => void;
  pending: boolean;
  withDivider?: boolean;
}) {
  return (
    <>
      {withDivider ? (
        <div className="relative mb-6 mt-2">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
              Or, optionally
            </span>
          </div>
        </div>
      ) : null}
      <div className="group flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-surface/60 p-5 transition-colors hover:bg-surface hover:shadow-sm">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-border">
          <GoogleG />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Add a Gmail account</p>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
              Optional
            </span>
          </div>
          <p className="mt-0.5 text-[13px] text-foreground-muted">
            Sign in with Google. Your Gmail password is never stored.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onConnect}
          className="rounded-xl"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Connect
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Button>
      </div>
    </>
  );
}

function AccountCard({
  account,
  syncing,
  onDisconnect,
  onSync,
  onReconnect,
  reconnectPending,
}: {
  account: EmailAccount;
  syncing: boolean;
  onDisconnect: () => void;
  onSync: () => void;
  onReconnect: () => void;
  reconnectPending: boolean;
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
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatarUrl} alt="" className="size-12 rounded-2xl object-cover ring-1 ring-border" />
          ) : account.provider === "imap" ? (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Building2 className="size-5" aria-hidden />
            </span>
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-border">
              <GoogleG />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              {account.provider === "imap" ? "Company mailbox" : "Gmail"}
            </p>
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" asChild>
            <Link href="/email">Open Email</Link>
          </Button>
          {needs && account.provider === "gmail" ? (
            <Button size="sm" className="rounded-xl" onClick={onReconnect} loading={reconnectPending}>
              Reconnect Gmail
            </Button>
          ) : needs && account.provider === "imap" ? (
            <Button size="sm" variant="outline" className="rounded-xl" asChild>
              <a href="#company-mailbox">Update login</a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onSync} loading={syncing} disabled={syncing}>
              <RefreshCw className="size-3.5" aria-hidden />
              Sync now
            </Button>
          )}
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
        </div>
      </div>
    </section>
  );
}

/** @deprecated Prefer GoogleG — kept for any residual imports. */
export function GmailMark() {
  return (
    <span className="flex size-11 items-center justify-center rounded-xl bg-white ring-1 ring-border" aria-hidden>
      <GoogleG />
    </span>
  );
}
