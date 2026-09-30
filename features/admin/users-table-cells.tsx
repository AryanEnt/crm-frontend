"use client";

import * as React from "react";
import type { AdminUser } from "@/lib/api/admin";
import { formatRelative, formatTimestamp } from "@/lib/relative-time";
import { Avatar } from "@/components/ui/console/avatar";
import { Badge, StatusIndicator } from "@/components/ui/console/badge";
import { Skeleton } from "@/components/ui/console/skeleton";
import { Tag } from "@/components/ui/console/tag";
import { tintFor, type Tint } from "@/components/ui/console/tints";
import { Tooltip } from "@/components/ui/console/tooltip";

const ROLE_TINTS: Record<string, Tint> = {
  super_admin: "violet",
  sales_manager: "indigo",
  sales_executive: "sky",
  sales_support: "emerald",
};

export function roleTint(code: string): Tint {
  return ROLE_TINTS[code] ?? tintFor(code);
}

/** Display-only: capitalises the first letter of each word ("lead user" -> "Lead User"). */
export function displayName(name: string) {
  return name.trim().replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function UserCell({ user }: { user: AdminUser }) {
  const name = displayName(user.fullName);
  return (
    <div className="flex min-w-0 items-center gap-2.5 comfortable:gap-3">
      <Avatar name={user.fullName} size="sm" className="comfortable:size-8 comfortable:text-caption" />
      <div className="flex min-w-0 items-baseline gap-2 comfortable:block">
        <Tooltip content={name} onlyWhenTruncated>
          <p className="max-w-[55%] shrink-0 truncate font-medium text-ink comfortable:max-w-none">{name}</p>
        </Tooltip>
        <Tooltip content={user.email} onlyWhenTruncated>
          <p className="min-w-0 truncate text-caption text-ink-muted">{user.email}</p>
        </Tooltip>
      </div>
    </div>
  );
}

export function RoleBadge({ user }: { user: AdminUser }) {
  return <Badge tint={roleTint(user.roleCode)}>{user.roleName}</Badge>;
}

export function StatusCell({ active }: { active: boolean }) {
  return <StatusIndicator tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</StatusIndicator>;
}

export function TeamCell({
  teamIds,
  teamNames,
  loading,
}: {
  teamIds: string[] | undefined;
  teamNames: ReadonlyMap<string, string>;
  loading: boolean;
}) {
  if (!teamIds?.length) return <span className="italic text-ink-muted">No team</span>;
  if (loading) return <Skeleton className="h-5 w-20 rounded-sm" />;
  const names = teamIds.map((id) => teamNames.get(id) ?? "Unknown team");
  const [first, ...rest] = names;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Tag className="max-w-40">{first}</Tag>
      {rest.length ? (
        <Tooltip content={rest.join(", ")}>
          <span className="text-caption text-ink-muted">+{rest.length}</span>
        </Tooltip>
      ) : null}
    </div>
  );
}

export function PhoneCell({ phone }: { phone?: string }) {
  if (!phone) return <span className="text-ink-muted">Not added</span>;
  return <span className="font-mono text-caption tabular-nums text-ink-secondary">{phone}</span>;
}

export function LastActiveCell({ value, now }: { value?: string | null; now: number }) {
  if (!value) return <span className="text-ink-muted">Never</span>;
  return (
    <Tooltip content={formatTimestamp(value)}>
      <time dateTime={value} className="tabular-nums text-ink-secondary">
        {formatRelative(value, now)}
      </time>
    </Tooltip>
  );
}

/** Mirrors the real row layout so the table doesn't jump when data arrives. */
export function UserRowSkeleton({ show }: { show: (column: string) => boolean }) {
  return (
    <tr className="[&>td]:border-b [&>td]:border-line last:[&>td]:border-b-0">
      <td className="h-(--table-row-height) w-10 pl-4 pr-0">
        <Skeleton className="size-4 rounded-sm" />
      </td>
      <td className="h-(--table-row-height) px-3">
        <div className="flex items-center gap-2.5 comfortable:gap-3">
          <Skeleton className="size-6 rounded-full comfortable:size-8" />
          <div className="flex items-center gap-2 comfortable:block comfortable:space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-40" />
          </div>
        </div>
      </td>
      {show("role") ? (
        <td className="px-3">
          <Skeleton className="h-5 w-24 rounded-full" />
        </td>
      ) : null}
      {show("status") ? (
        <td className="px-3">
          <Skeleton className="h-3 w-14" />
        </td>
      ) : null}
      {show("team") ? (
        <td className="px-3">
          <Skeleton className="h-5 w-20 rounded-sm" />
        </td>
      ) : null}
      {show("phone") ? (
        <td className="hidden px-3 lg:table-cell">
          <Skeleton className="h-3 w-24" />
        </td>
      ) : null}
      {show("lastActive") ? (
        <td className="hidden px-3 lg:table-cell">
          <Skeleton className="h-3 w-12" />
        </td>
      ) : null}
      <td className="w-12 pr-4" />
    </tr>
  );
}

function csvValue(value: string) {
  const plainPhone = /^\+?[\d\s()-]+$/.test(value);
  const safe = !plainPhone && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Client-side CSV of the given rows (what the admin currently sees); no API involved. */
export function downloadUsersCsv(users: AdminUser[], teamNames: ReadonlyMap<string, string>) {
  const header = ["Name", "Email", "Role", "Status", "Team", "Phone", "Last login"];
  const rows = users.map((user) => [
    user.fullName,
    user.email,
    user.roleName,
    user.isActive ? "Active" : "Inactive",
    (user.teamIds ?? []).map((id) => teamNames.get(id) ?? id).join("; "),
    user.phone ?? "",
    user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
