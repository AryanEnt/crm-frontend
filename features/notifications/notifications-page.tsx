"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notificationHref, slaPayload, SLA_TYPE, typeLabel } from "@/features/notifications/notification-copy";
import { crmApi, type InAppNotification } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function sinceIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<"all" | "unread">("unread");
  const [type, setType] = React.useState("all");
  const [range, setRange] = React.useState<"all" | "7" | "30">("all");
  const [offset, setOffset] = React.useState(0);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (tab === "unread") p.set("unread", "true");
    if (type !== "all") p.set("type", type);
    if (range !== "all") p.set("createdFrom", sinceIso(Number(range)));
    return p;
  }, [tab, type, range, offset]);

  const listQuery = useQuery({
    queryKey: ["notifications", "page", params.toString()],
    queryFn: () => crmApi.listNotifications(params),
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    setOffset(0);
  }, [tab, type, range]);

  const markRead = useMutation({
    mutationFn: (id: string) => crmApi.markNotificationRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markUnread = useMutation({
    mutationFn: (id: string) => crmApi.markNotificationUnread(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => crmApi.markAllNotificationsRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const hasMore = offset + items.length < total;
  const unreadOnPage = items.some((n) => !n.readAt);

  const openLead = (n: InAppNotification) => {
    const href = notificationHref(n);
    if (!n.readAt) markRead.mutate(n.id);
    if (href) router.push(href);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Notifications" }]}
        title="Notifications"
        description="Stage SLA alerts for leads that have stayed too long in one stage."
        actions={
          unreadOnPage || tab === "unread" ? (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
          <TabsList aria-label="Read status">
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-[150px]" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value={SLA_TYPE}>Stage SLA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as "all" | "7" | "30")}>
          <SelectTrigger className="h-8 w-[150px]" aria-label="Date">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any time</SelectItem>
            <SelectItem value="7">Past 7 days</SelectItem>
            <SelectItem value="30">Past 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {listQuery.isPending ? (
        <p className="py-10 text-center text-body text-ink-muted">Loading notifications…</p>
      ) : listQuery.isError ? (
        <ErrorState onRetry={() => void listQuery.refetch()} />
      ) : items.length === 0 && offset === 0 ? (
        <EmptyState
          icon={Bell}
          title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
          description="When a lead stays in a stage past its SLA, you'll see it here."
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={() => openLead(n)}
              onRead={() => markRead.mutate(n.id)}
              onUnread={() => markUnread.mutate(n.id)}
            />
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({
  n,
  onOpen,
  onRead,
  onUnread,
}: {
  n: InAppNotification;
  onOpen: () => void;
  onRead: () => void;
  onUnread: () => void;
}) {
  const sla = slaPayload(n);
  const unread = !n.readAt;
  const href = notificationHref(n);
  return (
    <li
      className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4", unread && "bg-brand-soft/25")}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink-muted",
        )}
        aria-hidden
      >
        <CircleAlert className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{n.title}</h2>
          <time className="text-caption text-ink-muted" dateTime={n.createdAt}>
            {formatRelative(n.createdAt, Date.now())}
          </time>
        </div>
        <p className="text-sm text-ink-secondary">{n.body}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-ink-muted sm:grid-cols-4">
          <div>
            <dt className="text-ink-muted">Lead</dt>
            <dd className="font-medium text-ink">{sla.leadName}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Stage</dt>
            <dd className="font-medium text-ink">{sla.stageName}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Time in stage</dt>
            <dd className="font-medium text-ink">{sla.daysInStage != null ? `${sla.daysInStage}d` : "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">SLA</dt>
            <dd className="font-medium text-ink">{sla.slaDays != null ? `${sla.slaDays}d` : "—"}</dd>
          </div>
        </dl>
        {sla.ownerName ? <p className="text-caption text-ink-muted">Assigned to {sla.ownerName}</p> : null}
        <p className="text-caption text-ink-muted">{typeLabel(n.type)}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {href ? (
            <Button size="sm" onClick={onOpen}>
              View lead
            </Button>
          ) : null}
          {unread ? (
            <Button size="sm" variant="outline" onClick={onRead}>
              Mark as read
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onUnread}>
              Mark as unread
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
