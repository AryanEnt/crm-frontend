"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type Activity } from "@/lib/api/crm";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { formatInTimezone } from "@/lib/timezone";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

const statusTone = (s: string) =>
  s === "overdue"
    ? "warning"
    : s === "completed"
      ? "success"
      : s === "cancelled"
        ? "neutral"
        : "brand";

export function ActivitiesTableView() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const timezone = user?.timezone || "UTC";
  const [search, setSearch] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState("all");
  const [typeCode, setTypeCode] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const isTeamLead = user?.roleCode === "sales_manager";
  const isOwnOnly =
    user?.roleCode === "sales_executive" || user?.roleCode === "sales_support";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);

  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "activities"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: !isTeamLead && !isOwnOnly && can("users:view"),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (isOwnOnly && user?.id) {
      p.set("ownerUserId", user.id);
    } else if (isTeamLead) {
      if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
    } else if (ownerUserId !== "all") {
      p.set("ownerUserId", ownerUserId);
    }
    if (typeCode !== "all") p.set("type", typeCode);
    if (status !== "all") p.set("status", status);
    return p;
  }, [ownerUserId, typeCode, status, isTeamLead, isOwnOnly, salesExecutiveId, user?.id]);

  const activitiesQuery = useQuery({
    queryKey: ["activities", params.toString()],
    queryFn: () => crmApi.listActivities(params),
  });

  const filtered = React.useMemo(() => {
    const data = activitiesQuery.data?.data ?? [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.customerName ?? "").toLowerCase().includes(q) ||
        (a.dealTitle ?? "").toLowerCase().includes(q),
    );
  }, [activitiesQuery.data, search]);

  const columns = React.useMemo<ColumnDef<Activity>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column} title="Title" />,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: "typeName",
        header: "Type",
        cell: ({ row }) => row.original.typeName ?? row.original.kind,
      },
      {
        id: "related",
        header: "Related",
        cell: ({ row }) => {
          const a = row.original;
          if (a.customerId) {
            return (
              <Link href={`/customers/${a.customerId}`} className="text-xs hover:text-brand-dark">
                {a.customerName}
              </Link>
            );
          }
          if (a.dealId) {
            return (
              <Link href={`/deals/${a.dealId}`} className="text-xs hover:text-brand-dark">
                {a.dealTitle}
              </Link>
            );
          }
          return a.leadName ?? "—";
        },
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => row.original.ownerName ?? "—",
      },
      {
        accessorKey: "displayStatus",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={statusTone(row.original.displayStatus)}>
            {row.original.displayStatus}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "dueAt",
        header: "When",
        cell: ({ row }) => (
          <span className="text-xs text-foreground-muted">
            {formatInTimezone(
              row.original.startAt || row.original.dueAt || row.original.createdAt,
              timezone,
            )}
          </span>
        ),
      },
    ],
    [timezone],
  );

  if (activitiesQuery.isError) {
    return <ErrorState onRetry={() => void activitiesQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Activities" }]}
        title="Activities"
        description={`Times shown in ${timezone}.`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/calendar">Calendar</Link>
            </Button>
            {can("activities:create") ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                New activity
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title or related…"
        onClear={() => {
          setSearch("");
          setOwnerUserId("all");
          setSalesExecutiveId("all");
          setTypeCode("all");
          setStatus("all");
        }}
      >
        {isOwnOnly ? (
          <div className="flex h-8 items-center rounded-md border border-border bg-surface-muted/50 px-2.5 text-xs text-foreground-muted">
            Owner: {user?.fullName ?? "You"}
          </div>
        ) : isTeamLead ? (
          <TeamMemberFilterChip value={salesExecutiveId} onChange={setSalesExecutiveId} />
        ) : (
          <Select value={ownerUserId} onValueChange={setOwnerUserId}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {(usersQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeCode} onValueChange={setTypeCode}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(typesQuery.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.code}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["upcoming", "due", "overdue", "completed", "cancelled"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        loading={activitiesQuery.isLoading}
        searchValue={search}
        pageSize={10}
        emptyTitle={search || status !== "all" || typeCode !== "all" ? "No activities match" : "No activities yet"}
        emptyDescription={
          search || status !== "all" || typeCode !== "all"
            ? "Clear filters to see more of your schedule."
            : "Log a call, meeting, or task to keep follow-ups on track."
        }
        emptyActionLabel={can("activities:create") && !search ? "New activity" : undefined}
        onEmptyAction={
          can("activities:create") && !search ? () => setCreateOpen(true) : undefined
        }
      />

      <ActivityQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["activities"] })}
      />
    </div>
  );
}
