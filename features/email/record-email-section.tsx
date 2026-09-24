"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Paperclip, Reply, Forward, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
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

export function RecordEmailSection({
  leadId,
  customerId,
  defaultTo,
}: {
  leadId?: string;
  customerId?: string;
  defaultTo?: string | null;
}) {
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Email</h3>
        <Button
          size="sm"
          onClick={() =>
            setCompose({
              leadId,
              customerId,
              to: defaultTo ? [defaultTo] : [],
              mode: "compose",
            })
          }
        >
          Compose email
        </Button>
      </div>
      <div className="flex gap-1 rounded-lg bg-surface-muted p-0.5 text-xs">
        {["all", "sent", "inbox", "drafts"].map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 capitalize",
              folder === f ? "bg-surface font-medium shadow-sm" : "text-foreground-muted",
            )}
            onClick={() => setFolder(f)}
          >
            {f === "inbox" ? "Received" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {list.isLoading ? (
        <LoadingState />
      ) : (list.data?.threads ?? []).length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No emails yet"
          description="Emails associated with this record will appear here."
          actionLabel="Compose email"
          onAction={() =>
            setCompose({ leadId, customerId, to: defaultTo ? [defaultTo] : [] })
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {(list.data?.threads ?? []).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full px-3 py-2.5 text-left hover:bg-surface-muted/60"
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.subject || "(no subject)"}</p>
                    <p className="truncate text-xs text-foreground-muted">
                      {t.participants.slice(0, 3).join(", ")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground-subtle">
                      {t.lastMessagePreview}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-foreground-subtle">
                    {formatWhen(t.lastMessageAt)}
                  </span>
                </div>
              </button>
              {openId === t.id ? (
                <ThreadMessages
                  thread={t}
                  account={account}
                  onReply={(ctx) => setCompose(ctx)}
                />
              ) : null}
            </li>
          ))}
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

  if (detail.isLoading) return <div className="px-3 pb-3"><LoadingState /></div>;
  const messages = detail.data?.messages ?? [];

  return (
    <div className="space-y-3 border-t border-border bg-surface-muted/30 px-3 py-3">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => star.mutate()} aria-label="Star">
          <Star className={cn("size-3.5", thread.starred && "fill-warning text-warning")} />
        </Button>
      </div>
      {messages.map((m) => (
        <article
          key={m.id}
          className={cn(
            "rounded-lg border border-border bg-surface px-3 py-2.5",
            m.direction === "outbound" && "ml-6",
            m.direction === "inbound" && "mr-6",
            m.status === "failed" && "border-destructive/40",
            m.status === "draft" && "border-dashed",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {m.fromName || m.from}{" "}
                <span className="font-normal text-foreground-muted">→ {m.to.join(", ")}</span>
              </p>
              <p className="text-[11px] text-foreground-subtle">
                {statusCopy(m)} · {formatWhen(m.sentAt || m.receivedAt || m.createdAt)}
              </p>
            </div>
            {m.hasAttachments ? <Paperclip className="size-3.5 text-foreground-muted" /> : null}
          </div>
          <div
            className="prose prose-sm mt-2 max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: m.bodyHtml || m.bodyText.replace(/\n/g, "<br/>") }}
          />
          {m.status === "failed" ? (
            <p className="mt-2 text-xs text-destructive">
              Failed to send. Your Gmail connection needs attention.
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
        <p className="text-xs text-foreground-muted">
          Connect Gmail in Settings to reply from your own address.
        </p>
      ) : null}
    </div>
  );
}
