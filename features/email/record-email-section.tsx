"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Paperclip, Reply, Forward, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { emailApi, type EmailAccount, type EmailMessage, type EmailThread } from "@/lib/api/email";
import { EmailComposer, type ComposerContext } from "@/features/email/email-composer";
import { cn } from "@/lib/utils";

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function statusCopy(m: EmailMessage) {
  if (m.status === "sending") return "Sending";
  if (m.status === "sent") return "Sent";
  if (m.status === "delivered") return "Delivered";
  if (m.status === "failed") return "Failed to send";
  if (m.status === "draft") return "Draft";
  if (m.status === "scheduled") return "Scheduled";
  return "Received";
}

/** Emails linked to a lead or customer — compose, browse threads, reply in place. */
export function RecordEmailSection({
  leadId,
  customerId,
  defaultTo,
}: {
  leadId?: string;
  customerId?: string;
  defaultTo?: string | null;
}) {
  const { can } = useAuth();
  const canCompose = can("email:send");
  const accountsQ = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });
  const account = accountsQ.data?.accounts?.[0] ?? null;

  const [folder, setFolder] = React.useState("all");
  const [compose, setCompose] = React.useState<ComposerContext | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  const params: Record<string, string | undefined> = {
    leadId,
    customerId,
    folder: folder === "all" ? undefined : folder,
    limit: "40",
  };
  const list = useQuery({
    queryKey: ["email-threads", params],
    queryFn: () => emailApi.listThreads(params),
  });

  const threads = list.data?.threads ?? [];
  const startCompose = () =>
    setCompose({
      leadId,
      customerId,
      to: defaultTo ? [defaultTo] : [],
      mode: "compose",
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Emails</p>
          <p className="text-caption text-ink-muted">
            Messages sent from CRM for this lead, including document emails from Clients.
          </p>
        </div>
        {canCompose ? (
          <Button size="sm" onClick={startCompose} disabled={!account && !accountsQ.isLoading}>
            <Mail className="size-3.5" aria-hidden />
            Compose
          </Button>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Email folder"
        className="inline-flex h-8 items-center rounded-full bg-surface-muted p-0.5"
      >
        {(["all", "sent", "inbox", "drafts"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={folder === f}
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.75rem] font-medium capitalize transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              folder === f ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
            onClick={() => setFolder(f)}
          >
            {f === "inbox" ? "Received" : f[0]!.toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <LoadingState compact label="Loading emails…" />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No emails linked yet"
          description={
            canCompose
              ? "Send from Compose, or use Email documents on the Clients stage — both are saved here."
              : "Emails associated with this lead will appear here."
          }
          actionLabel={canCompose && account ? "Compose email" : undefined}
          onAction={canCompose && account ? startCompose : undefined}
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-column border border-line bg-surface">
          {threads.map((t) => {
            const open = openId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  className={cn(
                    "w-full px-3.5 py-2.5 text-left transition-colors",
                    open ? "bg-surface-muted/50" : "hover:bg-surface-muted/40",
                  )}
                  onClick={() => setOpenId(open ? null : t.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{t.subject || "(no subject)"}</p>
                      <p className="truncate text-caption text-ink-muted">
                        {t.participants.slice(0, 3).join(", ")}
                      </p>
                      {t.lastMessagePreview ? (
                        <p className="mt-0.5 truncate text-caption text-ink-subtle">{t.lastMessagePreview}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-ink-muted">
                      {formatWhen(t.lastMessageAt)}
                    </span>
                  </div>
                </button>
                {open ? (
                  <ThreadMessages thread={t} account={account} onReply={(ctx) => setCompose(ctx)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <EmailComposer
        open={!!compose}
        onOpenChange={(o) => {
          if (!o) setCompose(null);
        }}
        context={compose ?? {}}
        account={account}
      />
    </div>
  );
}

function ThreadMessages({
  thread,
  account,
  onReply,
}: {
  thread: EmailThread;
  account?: EmailAccount | null;
  onReply: (ctx: ComposerContext) => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["email-thread", thread.id],
    queryFn: () => emailApi.getThread(thread.id),
  });
  const star = useMutation({
    mutationFn: () => emailApi.patchThread(thread.id, { starred: !thread.starred }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-threads"] }),
  });

  if (detail.isLoading) {
    return (
      <div className="px-3.5 pb-3">
        <LoadingState compact label="Loading messages…" />
      </div>
    );
  }
  const messages = detail.data?.messages ?? [];

  return (
    <div className="space-y-2.5 border-t border-line bg-surface-muted/25 px-3.5 py-3">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => star.mutate()} aria-label="Star thread">
          <Star className={cn("size-3.5", thread.starred && "fill-warning text-warning")} />
        </Button>
      </div>
      {messages.map((m) => (
        <article
          key={m.id}
          className={cn(
            "rounded-card border border-line bg-surface px-3 py-2.5",
            m.direction === "outbound" && "ml-4",
            m.direction === "inbound" && "mr-4",
            m.status === "failed" && "border-danger/40",
            m.status === "draft" && "border-dashed",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {m.fromName || m.from}{" "}
                <span className="font-normal text-ink-muted">→ {m.to.join(", ")}</span>
              </p>
              <p className="text-[0.6875rem] text-ink-muted">
                {statusCopy(m)} · {formatWhen(m.sentAt || m.receivedAt || m.createdAt)}
              </p>
            </div>
            {m.hasAttachments ? <Paperclip className="size-3.5 shrink-0 text-ink-muted" aria-hidden /> : null}
          </div>
          <div
            className="prose prose-sm mt-2 max-w-none text-sm text-ink"
            dangerouslySetInnerHTML={{ __html: m.bodyHtml || m.bodyText.replace(/\n/g, "<br/>") }}
          />
          {m.status === "failed" ? (
            <p className="mt-2 text-caption text-danger">
              Failed to send. Ask your Team Lead to check the mailbox connection in Team Email.
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onReply({
                  mode: "reply",
                  threadId: thread.id,
                  inReplyTo: m.id,
                  to: m.direction === "inbound" ? [m.from] : m.to,
                  subject: m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
                  leadId: thread.leadId ?? undefined,
                  customerId: thread.customerId ?? undefined,
                })
              }
            >
              <Reply className="size-3.5" />
              Reply
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                onReply({
                  mode: "forward",
                  to: [],
                  subject: m.subject.startsWith("Fwd:") ? m.subject : `Fwd: ${m.subject}`,
                  leadId: thread.leadId ?? undefined,
                  customerId: thread.customerId ?? undefined,
                })
              }
            >
              <Forward className="size-3.5" />
              Forward
            </Button>
          </div>
        </article>
      ))}
      {!account ? (
        <p className="text-caption text-ink-muted">
          Company mailbox is not connected. Ask your Team Lead to link it in Team Email.
        </p>
      ) : null}
    </div>
  );
}
