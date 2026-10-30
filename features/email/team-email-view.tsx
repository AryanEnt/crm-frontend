"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, Mail, MoreHorizontal, RefreshCw, Search, Unplug, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/console/avatar";
import { TablePagination } from "@/components/ui/console/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { emailApi, type EmailThread, type TeamMailboxPerson } from "@/lib/api/email";
import { ApiError } from "@/types/api";
import { cn } from "@/lib/utils";

function relative(iso?: string | null) {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  const d = Date.now() - t;
  if (d < 60_000) return "Just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} hours ago`;
  return new Date(iso).toLocaleString();
}

function statusTone(s: string): "success" | "warning" | "danger" | "brand" | "neutral" {
  if (s === "connected") return "success";
  if (s === "syncing") return "brand";
  if (s === "needs_reauth" || s === "error") return "warning";
  return "neutral";
}

function providerLabel(p?: string) {
  if (p === "imap") return "Company mail";
  if (p === "gmail") return "Gmail";
  return "Not connected";
}

function matchesPerson(p: TeamMailboxPerson, q: string) {
  if (!q) return true;
  const hay = `${p.fullName} ${p.email} ${p.mailbox?.emailAddress ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function TeamEmailView() {
  const qc = useQueryClient();
  const [personQ, setPersonQ] = React.useState("");
  const [mailQ, setMailQ] = React.useState("");
  const [mailQDebounced, setMailQDebounced] = React.useState("");
  const [seId, setSeId] = React.useState("");
  const [mobileShowMail, setMobileShowMail] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const team = useQuery({ queryKey: ["email-team"], queryFn: () => emailApi.listTeamMailboxes() });

  React.useEffect(() => {
    const t = window.setTimeout(() => setMailQDebounced(mailQ.trim()), 300);
    return () => window.clearTimeout(t);
  }, [mailQ]);

  React.useEffect(() => {
    setPage(1);
  }, [seId, mailQDebounced, pageSize]);

  const activity = useQuery({
    queryKey: ["email-threads", "team", seId, mailQDebounced, page, pageSize],
    queryFn: () =>
      emailApi.listThreads({
        folder: "sent",
        q: mailQDebounced || undefined,
        salesExecutiveId: seId || undefined,
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      }),
    placeholderData: (prev) => prev,
  });

  const invite = useMutation({
    mutationFn: (p: TeamMailboxPerson) =>
      emailApi.createInvite({
        invitedUserId: p.userId,
        emailAddress: p.email,
        provider: "imap",
      }),
    onSuccess: async (data) => {
      try {
        await navigator.clipboard.writeText(data.url);
        toast.success("Connection link copied. Send it to the SE — they enter their own password.");
      } catch {
        toast.success(`Connection link: ${data.url}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : "Could not create a connection link");
    },
  });

  const sync = useMutation({
    mutationFn: (id: string) => emailApi.sync(id),
    onSuccess: () => {
      toast.success("Sync started");
      void qc.invalidateQueries({ queryKey: ["email-team"] });
      void qc.invalidateQueries({ queryKey: ["email-threads", "team"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => emailApi.disconnect(id),
    onSuccess: () => {
      toast.success("Mailbox disconnected");
      void qc.invalidateQueries({ queryKey: ["email-team"] });
    },
  });

  if (team.isLoading) return <LoadingState label="Loading team mailboxes…" />;
  if (team.isError) return <ErrorState onRetry={() => void team.refetch()} />;

  const overview = team.data?.overview;
  const people = team.data?.people ?? [];
  const personFilter = personQ.trim().toLowerCase();
  const filteredPeople = people.filter((p) => matchesPerson(p, personFilter));
  const selected = people.find((p) => p.userId === seId) ?? null;
  const threads = activity.data?.threads ?? [];
  const total = activity.data?.total ?? 0;

  const selectPerson = (id: string) => {
    setSeId(id);
    setMobileShowMail(true);
  };

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <PageHeader
        title="Team email"
        description="Connect assigned sales executives’ company mailboxes. You never collect their password — they authorize their own account."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Assigned people" value={String(overview?.assigned ?? 0)} />
        <MetricCard label="Connected" value={String(overview?.connected ?? 0)} />
        <MetricCard label="Not connected" value={String(overview?.disconnected ?? 0)} />
        <MetricCard label="Needs attention" value={String(overview?.syncFailures ?? 0)} />
      </div>

      <div className="flex min-h-[min(70vh,720px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:flex-row">
        {/* SE mailboxes */}
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col border-line lg:w-[340px] lg:border-r",
            mobileShowMail ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="shrink-0 space-y-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-cell font-semibold text-ink">Mailboxes</h2>
              <p className="text-caption text-ink-muted">Select a person to view their sent mail</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                className="h-9 pl-9 text-xs"
                placeholder="Search name or email…"
                value={personQ}
                onChange={(e) => setPersonQ(e.target.value)}
                aria-label="Search sales executives"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSeId("");
                  setMobileShowMail(true);
                }}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-caption font-medium transition-colors",
                  !seId
                    ? "bg-brand text-primary-foreground"
                    : "bg-surface-muted text-ink-secondary hover:text-ink",
                )}
              >
                <Users className="size-3.5" aria-hidden />
                All team
              </button>
            </div>
          </div>

          {people.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Mail}
                title="No assigned people"
                description="Team members will appear here once they are on your team."
              />
            </div>
          ) : filteredPeople.length === 0 ? (
            <p className="px-4 py-8 text-center text-caption text-ink-muted">No people match “{personQ.trim()}”.</p>
          ) : (
            <ul className="crm-scroll min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Sales executives">
              {filteredPeople.map((p) => (
                <MailboxRow
                  key={p.userId}
                  person={p}
                  selected={seId === p.userId}
                  onSelect={() => selectPerson(p.userId)}
                  onInvite={() => invite.mutate(p)}
                  inviting={invite.isPending}
                  onSync={() => p.mailbox && sync.mutate(p.mailbox.id)}
                  onDisconnect={() => {
                    if (p.mailbox && window.confirm(`Disconnect ${p.mailbox.emailAddress}?`)) {
                      disconnect.mutate(p.mailbox.id);
                    }
                  }}
                />
              ))}
            </ul>
          )}
          <p className="shrink-0 border-t border-line px-4 py-2 text-caption text-ink-muted">
            {filteredPeople.length === people.length
              ? `${people.length} ${people.length === 1 ? "person" : "people"}`
              : `${filteredPeople.length} of ${people.length}`}
          </p>
        </aside>

        {/* Sent mail */}
        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            mobileShowMail ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-line px-4 py-3">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
              aria-label="Back to mailboxes"
              onClick={() => setMobileShowMail(false)}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-cell font-semibold text-ink">
                {selected ? selected.fullName : "Recent sent activity"}
              </h2>
              <p className="truncate text-caption text-ink-muted">
                {selected
                  ? selected.mailbox
                    ? `${providerLabel(selected.mailbox.provider)} · Last sync ${relative(selected.mailbox.lastSyncAt)}`
                    : "Not connected — invite them to link company mail"
                  : "All assigned people · search subject or recipient"}
              </p>
            </div>
            <div className="relative w-full sm:ml-auto sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                className="h-9 pl-9 text-xs"
                placeholder="Search subject or recipient"
                value={mailQ}
                onChange={(e) => setMailQ(e.target.value)}
                aria-label="Search sent email"
              />
            </div>
          </div>

          {selected && !selected.mailbox ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <EmptyState
                icon={Mail}
                title={`${selected.fullName} isn’t connected`}
                description="Copy an invite link so they can authorize their company mailbox. You never see their password."
              />
              <Button size="sm" onClick={() => invite.mutate(selected)} disabled={invite.isPending}>
                <Link2 className="size-3.5" />
                Invite to connect
              </Button>
            </div>
          ) : activity.isLoading && threads.length === 0 ? (
            <LoadingState label="Loading activity…" />
          ) : threads.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState
                icon={Mail}
                title="No sent mail here"
                description={
                  mailQDebounced
                    ? "Try a different search."
                    : selected
                      ? "Once they send mail from the connected mailbox, it will show up here."
                      : "Select a person on the left, or wait for connected mailboxes to sync."
                }
              />
            </div>
          ) : (
            <>
              <ul className="crm-scroll min-h-0 flex-1 overflow-y-auto divide-y divide-line">
                {threads.map((t) => (
                  <ActivityRow key={t.id} thread={t} showOwner={!seId} />
                ))}
              </ul>
              <div className="shrink-0 border-t border-line px-2">
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  itemLabel="emails"
                />
              </div>
            </>
          )}
        </section>
      </div>

      <p className="text-caption text-ink-muted">
        Company mail uses IMAP/SMTP. Thunderbird can stay in use; sent mail syncs when the server exposes a Sent folder.
      </p>
    </div>
  );
}

function MailboxRow({
  person,
  selected,
  onSelect,
  onInvite,
  inviting,
  onSync,
  onDisconnect,
}: {
  person: TeamMailboxPerson;
  selected: boolean;
  onSelect: () => void;
  onInvite: () => void;
  inviting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const m = person.mailbox;
  const connected = Boolean(m);
  return (
    <li>
      <div
        className={cn(
          "group flex items-stretch gap-1 border-l-2 border-transparent transition-colors",
          selected && "border-l-brand bg-brand-soft/40",
          !selected && "hover:bg-surface-muted/60",
        )}
      >
        <button
          type="button"
          role="option"
          aria-selected={selected}
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
        >
          <span className="relative mt-0.5 shrink-0">
            <Avatar name={person.fullName} size="sm" />
            <span
              aria-hidden
              className={cn(
                "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface",
                connected
                  ? m?.connectionStatus === "connected" || m?.connectionStatus === "syncing"
                    ? "bg-success"
                    : "bg-warning"
                  : "bg-ink-muted/40",
              )}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-cell font-semibold text-ink">{person.fullName}</span>
            </span>
            <span className="mt-0.5 block truncate text-caption text-ink-muted">
              {m?.emailAddress || person.email || "No company address"}
            </span>
            <span className="mt-1.5 inline-flex">
              <StatusBadge tone={m ? statusTone(m.connectionStatus) : "neutral"}>
                {m ? m.connectionStatus.replaceAll("_", " ") : "Not connected"}
              </StatusBadge>
            </span>
            {m?.lastSyncError ? (
              <span className="mt-1 block line-clamp-2 text-caption text-danger">{m.lastSyncError}</span>
            ) : null}
          </span>
        </button>
        <div className="flex shrink-0 items-start py-2 pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${person.fullName}`}
                className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted opacity-100 hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {!m ? (
                <DropdownMenuItem disabled={inviting} onSelect={() => onInvite()}>
                  <Link2 className="size-3.5" aria-hidden />
                  Invite to connect
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => onSync()}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Retry sync
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-danger" onSelect={() => onDisconnect()}>
                    <Unplug className="size-3.5" aria-hidden />
                    Disconnect
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function ActivityRow({ thread, showOwner }: { thread: EmailThread; showOwner?: boolean }) {
  return (
    <li className="px-4 py-3 transition-colors hover:bg-surface-muted/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-cell font-medium text-ink">{thread.subject || "(no subject)"}</p>
        <p className="shrink-0 text-caption tabular-nums text-ink-muted">{relative(thread.lastMessageAt)}</p>
      </div>
      <p className="mt-0.5 line-clamp-1 text-caption text-ink-muted">{thread.lastMessagePreview}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
        {showOwner ? <span>{thread.ownerName || "SE"}</span> : null}
        {thread.leadId ? (
          <Link className="text-brand hover:underline" href={`/leads/${thread.leadId}`}>
            {thread.leadName || "Lead"}
          </Link>
        ) : null}
        {thread.customerId ? (
          <Link className="text-brand hover:underline" href={`/customers/${thread.customerId}`}>
            {thread.customerName || "Contact"}
          </Link>
        ) : null}
        <Link
          className="font-medium text-ink-secondary hover:text-ink hover:underline"
          href={`/email?thread=${encodeURIComponent(thread.id)}&folder=sent${
            thread.ownerUserId ? `&se=${encodeURIComponent(thread.ownerUserId)}` : ""
          }`}
        >
          Open
        </Link>
      </div>
    </li>
  );
}
