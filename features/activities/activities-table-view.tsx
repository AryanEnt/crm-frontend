"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { crmApi, type Activity } from "@/lib/api/crm";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { formatInTimezone } from "@/lib/timezone";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";

const ACTIVITY_STATUSES = ["upcoming", "due", "overdue", "completed", "cancelled"];

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
  const [typeCode, setTypeCode] = React.useState("all");
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && ACTIVITY_STATUSES.includes(fromUrl) ? fromUrl : "all";
  });
  const [createOpen, setCreateOpen] = React.useState(false);
  const scopeFilters = useScopeFilters("activities:view");
  const scopeParams = scopeFilters.params;

  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    for (const [key, value] of scopeParams) p.set(key, value);
    if (typeCode !== "all") p.set("type", typeCode);
    if (status !== "all") p.set("status", status);
    return p;
  }, [scopeParams, typeCode, status]);

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
          scopeFilters.reset();
          setTypeCode("all");
          setStatus("all");
        }}
      >
        <ScopeFilterControls filters={scopeFilters} />
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
            {ACTIVITY_STATUSES.map((s) => (
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
