"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/console/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-provider";
import { notificationHref, slaPayload } from "@/features/notifications/notification-copy";
import { crmApi, type InAppNotification } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;
const PREVIEW = 8;
const TOAST_SEEN_KEY = "aurora.notifications.toasted";

function inboxParams(unread: boolean, limit = PREVIEW): URLSearchParams {
  const p = new URLSearchParams({ limit: String(limit), offset: "0" });
  if (unread) p.set("unread", "true");
  return p;
}

function readToastSeen(): string[] {
  try {
    const raw = sessionStorage.getItem(TOAST_SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeToastSeen(ids: string[]) {
  try {
    sessionStorage.setItem(TOAST_SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* ignore */
  }
}

export function NotificationsMenu() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const enabled = Boolean(user?.id);
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "unread">("unread");

  const countQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => crmApi.unreadNotificationCount(),
    enabled,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery({
    queryKey: ["notifications", "preview", tab],
    queryFn: () => crmApi.listNotifications(inboxParams(tab === "unread")),
    enabled: enabled && open,
    refetchInterval: open ? REFRESH_MS : false,
  });

  const unread = countQuery.data?.unread ?? 0;
  const items = listQuery.data?.data ?? [];

  const markRead = useMutation({
    mutationFn: (id: string) => crmApi.markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const markAll = useMutation({
    mutationFn: () => crmApi.markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const prevUnread = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    const next = countQuery.data?.unread;
    if (next == null) return;
    const prev = prevUnread.current;
    prevUnread.current = next;
    if (prev == null || next <= prev || document.visibilityState !== "visible") return;
    const seen = new Set(readToastSeen());
    const newest = items.find((n) => !n.readAt && !seen.has(n.id));
    if (newest) {
      writeToastSeen([...seen, newest.id]);
      toast.info(newest.title, { description: newest.body, duration: 5_000 });
    } else if (next > prev) {
      toast.info("New notification", { description: "A lead has exceeded its stage SLA.", duration: 5_000 });
    }
  }, [countQuery.data?.unread, enabled, items]);

  const openLead = (n: InAppNotification) => {
    const href = notificationHref(n);
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          tooltip={false}
          className="relative"
        >
          <Bell />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-0 p-0"
        aria-label="Notifications"
      >
        <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <p className="text-caption text-ink-muted">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              Mark all as read
            </Button>
          ) : null}
        </div>
        <div className="px-3 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
            <TabsList aria-label="Notification filters">
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto px-1 py-1">
          {listQuery.isPending ? (
            <p className="px-2 py-6 text-center text-caption text-ink-muted">Loading…</p>
          ) : listQuery.isError ? (
            <p className="px-2 py-6 text-center text-caption text-danger">Couldn't load notifications.</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-6 text-center text-caption text-ink-muted">
              {tab === "unread" ? "No unread notifications." : "No notifications yet."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((n) => (
                <NotificationPreview key={n.id} n={n} onOpen={() => openLead(n)} />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-line px-3 py-2">
          <Link
            href="/notifications"
            className="block rounded-sm py-1 text-center text-caption font-medium text-ink-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationPreview({ n, onOpen }: { n: InAppNotification; onOpen: () => void }) {
  const sla = slaPayload(n);
  const unread = !n.readAt;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          unread && "bg-brand-soft/40",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            unread ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink-muted",
          )}
          aria-hidden
        >
          <CircleAlert className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-medium text-ink">{n.title}</span>
            {unread ? (
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
            ) : null}
          </span>
          <span className="mt-0.5 line-clamp-2 text-caption text-ink-muted">{n.body}</span>
          <span className="mt-1 block text-caption text-ink-muted">
            {sla.leadName}
            {sla.stageName ? ` · ${sla.stageName}` : ""}
            {" · "}
            {formatRelative(n.createdAt, Date.now())}
          </span>
        </span>
      </button>
    </li>
  );
}
