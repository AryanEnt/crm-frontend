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
import { TablePagination } from "@/components/ui/console/data-table";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { LeadCombobox } from "@/components/forms/entity-pickers";
import { leadHref } from "@/features/activities/activity-href";
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

const PAGE_SIZES = [10, 25, 50];

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
  const [qDebounced, setQDebounced] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const [compose, setCompose] = React.useState<ComposerContext | null>(null);
  const [assocLead, setAssocLead] = React.useState("");
  const accountsQ = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
  });
  const account: EmailAccount | undefined = accountsQ.data?.accounts?.[0];
  const integration = accountsQ.data?.integration;

  const listParams = {
    folder,
    q: qDebounced || undefined,
    direction: direction || undefined,
    leadId: params.get("leadId") || undefined,
    customerId: params.get("customerId") || undefined,
    salesExecutiveId: can("email:view") && user?.roleCode === "sales_manager" ? params.get("se") || undefined : undefined,
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  };
  const list = useQuery({
    queryKey: ["email-threads", listParams],
    queryFn: () => emailApi.listThreads(listParams),
    placeholderData: (prev) => prev,
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
      emailApi.associate(selectedId, { leadId: assocLead || undefined }),
    onSuccess: () => {
      toast.success("Associated");
      void qc.invalidateQueries({ queryKey: ["email-threads"] });
      void qc.invalidateQueries({ queryKey: ["email-thread", selectedId] });
    },
  });

  const counts = list.data?.counts;
  const threads = list.data?.threads ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const thread = detail.data?.thread;
  const messages = detail.data?.messages ?? [];

  React.useEffect(() => {
    setPage(1);
  }, [folder, direction, pageSize]);

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  // Team leads can open SE threads without connecting their own mailbox (read-only).
  const canBrowseTeamMail =
    can("email:view") && (user?.roleCode === "sales_manager" || can("email:manage"));
  const teamOnly = !account && canBrowseTeamMail;

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

  if (!account && !canBrowseTeamMail) {
    return (
      <div className="space-y-4">
        <PageHeader title="Email" />
        <EmptyState
          icon={Mail}
          title="Connect your mailbox"
          description="Connect Gmail or your company email in Email accounts, then send from the CRM."
          actionLabel="Connect mailbox"
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
        description={
          teamOnly
            ? "Viewing team mailboxes — connect your own mailbox to send or reply"
            : account?.emailAddress
        }
        actions={
          account ? (
            <Button onClick={() => setCompose({ mode: "compose" })}>Compose email</Button>
          ) : (
            <Button variant="outline" onClick={() => (window.location.href = "/settings/email")}>
              Connect your mailbox
            </Button>
          )
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
                  setPage(1);
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

        <div
          className={cn(
            "flex min-h-[320px] min-w-0 flex-col border-border md:border-r",
            selectedId ? "hidden md:flex" : "flex",
          )}
        >
          {list.isLoading && threads.length === 0 ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState onRetry={() => void list.refetch()} />
          ) : threads.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={Mail}
              title={folder === "unmatched" ? "No unmatched email" : "No emails yet"}
              description="Emails associated with your leads will appear here."
              actionLabel="Compose email"
              onAction={() => setCompose({ mode: "compose" })}
            />
          ) : (
            <>
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === selectedId}
                    onClick={() => setSelectedId(t.id)}
                  />
                ))}
              </ul>
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizes={PAGE_SIZES}
                itemLabel="emails"
              />
            </>
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
                        {thread.leadName || thread.customerName}
                      </p>
                    )}
                    {thread.leadId ? (
                      <Link className="text-xs text-primary hover:underline" href={leadHref(thread.leadId)}>
                        Open lead
                      </Link>
                    ) : null}
                  </div>
                  <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelectedId("")}>
                    Back
                  </Button>
                </div>
                {thread.matchStatus !== "matched" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <LeadCombobox
                      className="w-full max-w-[260px]"
                      triggerClassName="h-8"
                      value={assocLead || null}
                      onChange={(id) => setAssocLead(id ?? "")}
                      placeholder="Link to a lead…"
                    />
                    <Button
                      size="sm"
                      onClick={() => associate.mutate()}
                      disabled={associate.isPending || !assocLead}
                    >
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
                    {account ? (
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
                              quoteHtml: m.bodyHtml || m.bodyText.replace(/\n/g, "<br/>"),
                              leadId: thread.leadId ?? undefined,
                              customerId: thread.customerId ?? undefined,
                            })
                          }
                        >
                          Reply
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {account ? (
        <EmailComposer
          open={!!compose}
          onOpenChange={(o) => {
            if (!o) setCompose(null);
          }}
          context={compose ?? {}}
          account={account}
          fullscreen
        />
      ) : null}
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
            {thread.leadName || thread.customerName || "Unmatched"}
            {thread.hasAttachments ? <Paperclip className="size-3" /> : null}
          </span>
        </span>
      </button>
    </li>
  );
}
