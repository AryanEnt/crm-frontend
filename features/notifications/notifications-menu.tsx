"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, Bell, CircleAlert, UserPlus, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { activityHref } from "@/features/activities/activity-href";
import { crmApi, type Activity } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { IconButton } from "@/components/ui/console/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/console/dropdown-menu";

const PREFIX = "aurora.notifications.seen.";
const EVENT = "aurora-notifications";
const MAX_SEEN = 500;
const MAX_SHOWN = 8;
const REFRESH_MS = 60_000;
const HOUR = 3_600_000;
const DUE_SOON_MS = 24 * HOUR;
const ASSIGNED_WINDOW_MS = 7 * 24 * HOUR;

type Kind = "overdue" | "due" | "assigned";

type Notification = {
  /** Includes the kind and due time, so a rescheduled or newly overdue item counts as unread again. */
  key: string;
  kind: Kind;
  title: string;
  detail: string;
  href: string;
};

const KIND_ICON: Record<Kind, LucideIcon> = {
  overdue: CircleAlert,
  due: AlarmClock,
  assigned: UserPlus,
};

function read(userId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + userId);
  } catch {
    return null;
  }
}

function write(userId: string, keys: string[]) {
  try {
    window.localStorage.setItem(PREFIX + userId, JSON.stringify(keys.slice(-MAX_SEEN)));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function formatUntil(value: string, now: number) {
  const diff = new Date(value).getTime() - now;
  if (diff < HOUR) return `in ${Math.max(1, Math.round(diff / 60_000))}m`;
  return `in ${Math.round(diff / HOUR)}h`;
}

function related(a: Activity) {
  return a.leadName || a.dealTitle || a.customerName || "";
}

function withRelated(text: string, a: Activity) {
  const name = related(a);
  return name ? `${name} · ${text}` : text;
}

function buildNotifications(
  overdue: Activity[],
  upcoming: Activity[],
  userId: string,
  now: number,
): Notification[] {
  const items: Notification[] = [];
  const seen = new Set<string>();

  for (const a of [...overdue].sort((x, y) => (y.dueAt ?? "").localeCompare(x.dueAt ?? ""))) {
    seen.add(a.id);
    items.push({
      key: `activity:${a.id}:overdue:${a.dueAt ?? ""}`,
      kind: "overdue",
      title: a.title,
      detail: withRelated(`Overdue, due ${a.dueAt ? formatRelative(a.dueAt, now) : "earlier"}`, a),
      href: activityHref(a),
    });
  }

  for (const a of upcoming) {
    if (seen.has(a.id) || !a.dueAt) continue;
    const dueIn = new Date(a.dueAt).getTime() - now;
    if (dueIn < 0 || dueIn > DUE_SOON_MS) continue;
    seen.add(a.id);
    items.push({
      key: `activity:${a.id}:due:${a.dueAt}`,
      kind: "due",
      title: a.title,
      detail: withRelated(`Due ${formatUntil(a.dueAt, now)}`, a),
      href: activityHref(a),
    });
  }

  for (const a of upcoming) {
    if (seen.has(a.id) || !a.createdByUserId || a.createdByUserId === userId) continue;
    if (now - new Date(a.createdAt).getTime() > ASSIGNED_WINDOW_MS) continue;
    seen.add(a.id);
    items.push({
      key: `activity:${a.id}:assigned`,
      kind: "assigned",
      title: a.title,
      detail: withRelated(`Assigned by ${a.createdByName ?? "a teammate"} ${formatRelative(a.createdAt, now)}`, a),
      href: activityHref(a),
    });
  }

  return items;
}

/** Bell menu built from the signed-in user's open follow-ups; read state is kept per user in this browser. */
export function NotificationsMenu() {
  const { user, can } = useAuth();
  const router = useRouter();
  const userId = user?.id ?? "";
  const enabled = Boolean(userId) && can("activities:view");

  const overdueQuery = useQuery({
    queryKey: ["notifications", "overdue", userId],
    queryFn: () =>
      crmApi.listActivities(
        new URLSearchParams({ status: "overdue", ownerUserId: userId, limit: "20", offset: "0" }),
      ),
    enabled,
    refetchInterval: REFRESH_MS,
  });
  const upcomingQuery = useQuery({
    queryKey: ["notifications", "upcoming", userId],
    queryFn: () =>
      crmApi.listActivities(
        new URLSearchParams({ status: "upcoming", ownerUserId: userId, limit: "50", offset: "0" }),
      ),
    enabled,
    refetchInterval: REFRESH_MS,
  });

  const now = Math.max(overdueQuery.dataUpdatedAt, upcomingQuery.dataUpdatedAt);
  const notifications = React.useMemo(
    () =>
      buildNotifications(
        overdueQuery.data?.data ?? [],
        upcomingQuery.data?.data ?? [],
        userId,
        now,
      ),
    [overdueQuery.data, upcomingQuery.data, userId, now],
  );

  const raw = React.useSyncExternalStore(
    subscribe,
    () => (userId ? read(userId) : null),
    () => null,
  );
  const seenKeys = React.useMemo(() => parse(raw), [raw]);
  const unread = React.useMemo(() => {
    const seen = new Set(seenKeys);
    return notifications.filter((n) => !seen.has(n.key));
  }, [notifications, seenKeys]);

  // Items that were unread when the menu opened keep their highlight until it closes.
  const [highlighted, setHighlighted] = React.useState<ReadonlySet<string>>(new Set());

  const onOpenChange = (open: boolean) => {
    if (!open || !userId) return;
    setHighlighted(new Set(unread.map((n) => n.key)));
    if (unread.length > 0) write(userId, [...seenKeys, ...unread.map((n) => n.key)]);
  };

  const unreadCount = unread.length;
  const shown = notifications.slice(0, MAX_SHOWN);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger>
        <IconButton
          label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          tooltip={false}
          className="relative"
        >
          <Bell />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Notifications" className="w-80">
        <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
          <span className="text-overline text-ink-muted">Notifications</span>
          {notifications.length > 0 ? (
            <span className="text-caption tabular-nums text-ink-muted">{notifications.length}</span>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-center text-caption text-ink-muted">
            {overdueQuery.isPending && enabled ? "Loading…" : "You're all caught up."}
          </p>
        ) : (
          shown.map((n) => (
            <DropdownMenuItem
              key={n.key}
              icon={KIND_ICON[n.kind]}
              onSelect={() => router.push(n.href)}
              className="h-auto items-start py-1.5"
            >
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{n.title}</span>
                  <span className="block truncate text-caption text-ink-muted">{n.detail}</span>
                </span>
                {highlighted.has(n.key) ? (
                  <span aria-label="Unread" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                ) : null}
              </span>
            </DropdownMenuItem>
          ))
        )}
        {enabled ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => router.push("/activities?status=overdue")}
              className="justify-center text-caption text-ink-secondary"
            >
              View all follow-ups
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
