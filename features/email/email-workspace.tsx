"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  Send,
  FileText,
  Star,
  AlertCircle,
  Clock,
  Archive,
  Mail,
  Paperclip,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi, type EmailAccount, type EmailThread } from "@/lib/api/email";
import { EmailComposer, type ComposerContext } from "@/features/email/email-composer";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";

const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "starred", label: "Starred", icon: Star },
  { id: "unmatched", label: "Unmatched", icon: AlertCircle },
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "archived", label: "Archived", icon: Archive },
] as const;

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function EmailWorkspace() {
  const { can, user } = useAuth();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [folder, setFolder] = React.useState(params.get("folder") || "inbox");
  const [selectedId, setSelectedId] = React.useState(params.get("thread") || "");
  const [q, setQ] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [compose, setCompose] = React.useState<ComposerContext | null>(null);
  const [assocLead, setAssocLead] = React.useState("");
  const [assocCustomer, setAssocCustomer] = React.useState("");

  const accountsQ = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });
  const account: EmailAccount | undefined = accountsQ.data?.accounts?.[0];
  const integration = accountsQ.data?.integration;

  const listParams = {
    folder,
    q: q || undefined,
    direction: direction || undefined,
    leadId: params.get("leadId") || undefined,
    customerId: params.get("customerId") || undefined,
    salesExecutiveId: can("email:view") && user?.roleCode === "sales_manager" ? params.get("se") || undefined : undefined,
    limit: "50",
  };
  const list = useQuery({
    queryKey: ["email-threads", listParams],
    queryFn: () => emailApi.listThreads(listParams),
  });

  const detail = useQuery({
    queryKey: ["email-thread", selectedId],
    queryFn: () => emailApi.getThread(selectedId),
    enabled: !!selectedId,
  });

  React.useEffect(() => {
    const t = params.get("thread");
    if (t) setSelectedId(t);
  }, [params]);

  const associate = useMutation({
    mutationFn: () =>
      emailApi.associate(selectedId, {
        leadId: assocLead || undefined,
        customerId: assocCustomer || undefined,
      }),
    onSuccess: () => {
      toast.success("Associated");
      void qc.invalidateQueries({ queryKey: ["email-threads"] });
      void qc.invalidateQueries({ queryKey: ["email-thread", selectedId] });
    },
  });

  const counts = list.data?.counts;
  const threads = list.data?.threads ?? [];
  const thread = detail.data?.thread;
  const messages = detail.data?.messages ?? [];

  if (accountsQ.isLoading) return <LoadingState label="Loading mailbox…" />;

  if (!integration?.configured) {
    return (
      <div className="space-y-4">
        <PageHeader title="Email" description="CRM email workspace" />
        <EmptyState
          icon={Mail}
          title="Email is not available yet"
          description="Ask a Super Admin to finish Email sync setup, then connect your mailbox."
        />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <PageHeader title="Email" />
        <EmptyState
          icon={Mail}
          title="Connect your Gmail"
          description="Send and receive emails directly from Aurora."
          actionLabel="Connect Gmail"
          onAction={() => {
            window.location.href = "/settings/email";
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3">
      <PageHeader
        title="Email"
        description={account.emailAddress}
        actions={
          <Button onClick={() => setCompose({ mode: "compose" })}>Compose email</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle" />
          <Input
            className="pl-8"
            placeholder="Search sender, subject, or content"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search email"
          />
        </div>
        <select
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          aria-label="Direction"
        >
          <option value="">All directions</option>
          <option value="inbound">Received</option>
          <option value="outbound">Sent</option>
        </select>
        {direction ? (
          <button
            type="button"
            className="rounded-full bg-surface-muted px-2.5 py-1 text-xs"
            onClick={() => setDirection("")}
          >
            {direction === "inbound" ? "Received" : "Sent"} ×
          </button>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(280px,360px)_minmax(0,1fr)]">
        <nav className="border-b border-border p-2 md:border-b-0 md:border-r" aria-label="Mailbox folders">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const count = counts?.[f.id as keyof typeof counts] ?? 0;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFolder(f.id);
                  setSelectedId("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
                  folder === f.id
                    ? "bg-brand-soft text-foreground"
                    : "text-foreground-muted hover:bg-surface-muted",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5" />
                  {f.label}
                </span>
                {count > 0 ? (
                  <span className="text-[11px] text-foreground-subtle">{count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className={cn("min-h-[320px] border-border md:border-r", selectedId ? "hidden md:block" : "block")}>
          {list.isLoading ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : threads.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={Mail}
              title={folder === "unmatched" ? "No unmatched email" : "No emails yet"}
              description="Emails associated with your CRM Leads and Customers will appear here."
              actionLabel="Compose email"
              onAction={() => setCompose({ mode: "compose" })}
            />
          ) : (
            <ul className="divide-y divide-border">
              {threads.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  active={t.id === selectedId}
                  onClick={() => setSelectedId(t.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <section
          className={cn(
            "flex min-h-[320px] flex-col",
            !selectedId ? "hidden lg:flex" : "flex",
          )}
          aria-label="Conversation"
        >
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-foreground-muted">
              Select a conversation
            </div>
          ) : detail.isLoading ? (
            <LoadingState />
          ) : !thread ? (
            <ErrorState onRetry={() => void detail.refetch()} />
          ) : (
            <>
              <header className="border-b border-border px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{thread.subject || "(no subject)"}</h2>
                    {thread.matchStatus !== "matched" ? (
                      <StatusBadge tone="warning">
                        {thread.matchStatus === "needs_association"
                          ? "Needs association"
                          : "Unmatched"}
                      </StatusBadge>
                    ) : (
                      <p className="text-xs text-foreground-muted">
                        {thread.customerName || thread.leadName}
                      </p>
                    )}
                    {thread.customerId ? (
                      <Link className="text-xs text-primary hover:underline" href={`/customers/${thread.customerId}`}>
                        Open customer
                      </Link>
                    ) : null}
                  </div>
                  <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelectedId("")}>
                    Back
                  </Button>
                </div>
                {thread.matchStatus !== "matched" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Input
                      className="h-8 max-w-[160px]"
                      placeholder="Lead ID"
                      value={assocLead}
                      onChange={(e) => setAssocLead(e.target.value)}
                    />
                    <Input
                      className="h-8 max-w-[160px]"
                      placeholder="Customer ID"
                      value={assocCustomer}
                      onChange={(e) => setAssocCustomer(e.target.value)}
                    />
                    <Button size="sm" onClick={() => associate.mutate()} disabled={associate.isPending}>
                      Associate
                    </Button>
                  </div>
                ) : null}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => (
                  <article
                    key={m.id}
                    className={cn(
                      "rounded-lg border border-border px-3 py-2.5",
                      m.direction === "outbound" && "bg-brand-soft/40",
                    )}
                  >
                    <p className="text-sm font-medium">
                      {m.fromName || m.from}
                      <span className="ml-2 text-[11px] font-normal text-foreground-subtle">
                        {formatWhen(m.sentAt || m.receivedAt || m.createdAt)} · {m.status}
                      </span>
                    </p>
                    <div
                      className="mt-2 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: m.bodyHtml || m.bodyText.replace(/\n/g, "<br/>"),
                      }}
                    />
                    {m.hasAttachments ? (
                      <p className="mt-2 flex items-center gap-1 text-xs text-foreground-muted">
                        <Paperclip className="size-3" /> Attachments
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCompose({
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
                        Reply
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <EmailComposer
        open={!!compose}
        onOpenChange={(o) => {
          if (!o) setCompose(null);
        }}
        context={compose ?? {}}
        account={account}
        fullscreen
      />
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: EmailThread;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full gap-2 px-3 py-2.5 text-left hover:bg-surface-muted/70",
          active && "bg-brand-soft/50",
          thread.unreadCount > 0 && "font-medium",
        )}
      >
        <span
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            thread.unreadCount > 0 ? "bg-brand" : "bg-transparent",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm">
              {thread.participants[0] || "Conversation"}
            </span>
            <span className="shrink-0 text-[11px] text-foreground-subtle">
              {formatWhen(thread.lastMessageAt)}
            </span>
          </span>
          <span className="block truncate text-sm">{thread.subject || "(no subject)"}</span>
          <span className="block truncate text-xs text-foreground-muted">
            {thread.lastMessagePreview}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-subtle">
            {thread.customerName || thread.leadName || "Unmatched"}
            {thread.hasAttachments ? <Paperclip className="size-3" /> : null}
          </span>
        </span>
      </button>
    </li>
  );
}
