"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/console/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi, type DomainProvider, type DomainProviderInput } from "@/lib/api/email";
import { IMAP_PROVIDER_OPTIONS, presetFor, providerLabel, type ImapProviderKind } from "@/lib/email-providers";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";

const QUERY_KEY = ["email-domain-providers"];

function serverSummary(d: DomainProvider): string {
  return d.imapHost === d.smtpHost ? d.imapHost : `${d.imapHost} · ${d.smtpHost}`;
}

/** Admin list of company domain → mail provider mappings used to pick servers for new mailboxes. */
export function MailDomainsSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: () => emailApi.listDomainProviders() });
  const [editing, setEditing] = React.useState<DomainProvider | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<DomainProvider | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => emailApi.deleteDomainProvider(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      setDeleting(null);
      toast.success("Mail domain removed");
    },
    onError: (err: Error) => toast.error(err instanceof ApiError ? err.message : "Could not remove the mail domain"),
  });

  const items = q.data?.items ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Mail domains</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Which provider hosts each company email domain. New mailboxes pick their server from here; existing
            mailboxes keep the settings they were saved with.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Add domain
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        {q.isLoading ? (
          <p className="px-5 py-4 text-sm text-foreground-muted">Loading…</p>
        ) : q.isError ? (
          <p className="px-5 py-4 text-sm text-danger">Could not load mail domains.</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-4 text-sm text-foreground-muted">
            No domains yet. Until one is added, team leads have to choose the provider by hand.
          </p>
        ) : (
          <ul>
            {items.map((d) => (
              <li key={d.id} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">@{d.domain}</p>
                  <p className="truncate text-xs text-foreground-muted">
                    {d.provider === "imap" ? "Custom" : providerLabel(d.provider)} · {serverSummary(d)}
                  </p>
                </div>
                <StatusBadge tone={d.isActive ? "success" : "neutral"}>{d.isActive ? "Active" : "Off"}</StatusBadge>
                <Button type="button" variant="ghost" size="icon" aria-label={`Edit @${d.domain}`} onClick={() => setEditing(d)}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove @${d.domain}`}
                  onClick={() => setDeleting(d)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <DomainProviderDialog
          key={editing === "new" ? "new" : editing.id}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => void qc.invalidateQueries({ queryKey: QUERY_KEY })}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove @${deleting?.domain ?? ""}?`}
        description="Mailboxes already connected keep working. New mailboxes on this domain will need a provider chosen by hand."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </section>
  );
}

function DomainProviderDialog({
  existing,
  onClose,
  onSaved,
}: {
  existing: DomainProvider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const custom0 = existing?.provider === "imap";
  const [domain, setDomain] = React.useState(existing?.domain ?? "");
  const [provider, setProvider] = React.useState<ImapProviderKind>(existing?.provider ?? "migadu");
  const [imapHost, setImapHost] = React.useState(custom0 ? existing.imapHost : "");
  const [imapPort, setImapPort] = React.useState(String(existing?.imapPort ?? 993));
  const [imapSecure, setImapSecure] = React.useState(existing?.imapSecure ?? true);
  const [smtpHost, setSmtpHost] = React.useState(custom0 ? existing.smtpHost : "");
  const [smtpPort, setSmtpPort] = React.useState(String(existing?.smtpPort ?? 465));
  const [smtpSecure, setSmtpSecure] = React.useState(existing?.smtpSecure ?? true);
  const [isActive, setIsActive] = React.useState(existing?.isActive ?? true);
  const [error, setError] = React.useState<string | null>(null);

  const custom = provider === "imap";
  const preset = custom ? null : presetFor(provider);

  const body = (): DomainProviderInput => ({
    domain: domain.trim(),
    provider,
    isActive,
    ...(custom
      ? {
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort) || undefined,
          imapSecure,
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort) || undefined,
          smtpSecure,
        }
      : {}),
  });

  const save = useMutation({
    mutationFn: () => (existing ? emailApi.updateDomainProvider(existing.id, body()) : emailApi.createDomainProvider(body())),
    onSuccess: (saved) => {
      onSaved();
      onClose();
      toast.success(`@${saved.domain} uses ${saved.provider === "imap" ? "a custom server" : providerLabel(saved.provider)}`);
    },
    onError: (err: Error) => setError(err instanceof ApiError ? err.message : "Could not save the mail domain"),
  });

  const canSubmit = domain.trim().length > 0 && (!custom || (imapHost.trim() && smtpHost.trim()));

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title={existing ? `Edit @${existing.domain}` : "Add mail domain"}
      description="Mailboxes on this domain sign in with the full email address."
      dismissible={!save.isPending}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label required>Domain</Label>
          <Input
            className="h-10"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label required>Provider</Label>
          <div className="flex flex-wrap gap-1.5">
            {IMAP_PROVIDER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setProvider(o.value)}
                className={cn(
                  "h-7 rounded-full px-2.5 text-caption font-medium",
                  provider === o.value
                    ? "bg-brand text-primary-foreground"
                    : "bg-surface text-ink-secondary ring-1 ring-line hover:text-ink",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {preset ? (
            <p className="text-caption text-ink-muted">
              IMAP {preset.imapHost}:{preset.imapPort} · SMTP {preset.smtpHost}:{preset.smtpPort} · SSL/TLS
            </p>
          ) : null}
        </div>

        {custom ? (
          <div className="space-y-3 rounded-xl border border-line bg-surface-muted/40 p-3">
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <div className="space-y-1.5">
                <Label required>IMAP host</Label>
                <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="mail.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-caption text-ink-secondary">
              <input type="checkbox" checked={imapSecure} onChange={(e) => setImapSecure(e.target.checked)} />
              IMAP SSL/TLS
            </label>
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <div className="space-y-1.5">
                <Label required>SMTP host</Label>
                <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-caption text-ink-secondary">
              <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
              SMTP SSL/TLS
            </label>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Use this mapping for new mailboxes
        </label>

        {error ? <p className="text-caption text-danger">{error}</p> : null}
      </div>
    </Dialog>
  );
}
