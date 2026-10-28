"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Button as ConsoleButton } from "@/components/ui/console/button";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  DataTable,
  SortableHeader,
  createSelectColumn,
} from "@/components/ui/data-table";
import { BulkActionBar } from "@/components/ui/console/data-table";
import { ColumnsMenu } from "@/components/ui/console/toolbar";
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
import { leadHref } from "@/features/activities/activity-href";
import { bulkLeadMovedMessage, invalidateLeadViews } from "@/features/activities/lead-moved";
import { DEFAULT_TIMEZONE, formatInTimezone } from "@/lib/timezone";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";
import { useColumnVisibility } from "@/lib/column-visibility";
import { bulkMessage, runBulk } from "@/lib/bulk";

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
  const timezone = user?.timezone || DEFAULT_TIMEZONE;
  const [search, setSearch] = React.useState("");
  const searchParams = useSearchParams();
  const [typeCode, setTypeCode] = React.useState(() => searchParams.get("type") || "all");
  const [status, setStatus] = React.useState(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl && ACTIVITY_STATUSES.includes(fromUrl) ? fromUrl : "all";
  });
  // Follow URL changes (e.g. clicking a Calls target) without fighting an in-page filter change.
  const urlType = searchParams.get("type") || "all";
  const [syncedType, setSyncedType] = React.useState(urlType);
  if (urlType !== syncedType) {
    setSyncedType(urlType);
    setTypeCode(urlType);
  }
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Activity[]>([]);
  const [selectionResetKey, setSelectionResetKey] = React.useState(0);
  const [bulkPending, setBulkPending] = React.useState<"completed" | "cancelled" | null>(null);
  const scopeFilters = useScopeFilters("activities:view");
  const scopeParams = scopeFilters.params;

  const canEdit = can("activities:edit");

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
      createSelectColumn<Activity>(),
      {
        accessorKey: "title",
        header: ({ column }) => <SortableHeader column={column} title="Title" />,
        enableHiding: false,
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
          if (a.leadId) {
            return (
              <Link href={leadHref(a.leadId)} className="text-xs hover:text-brand-dark">
                {a.leadName ?? "Open lead"}
              </Link>
            );
          }
          return <span className="text-xs text-ink-muted">{a.customerName || a.dealTitle || "—"}</span>;
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

  const columnPrefs = useColumnVisibility("activities", columns);

  const setStatusForSelected = async (next: "completed" | "cancelled") => {
    setBulkPending(next);
    const updated: Activity[] = [];
    const result = await runBulk(selected, async (activity) => {
      updated.push(await crmApi.updateActivity(activity.id, { status: next }));
    });
    setBulkPending(null);
    if (result.ok > 0) {
      await qc.invalidateQueries({ queryKey: ["activities"] });
      setSelectionResetKey((k) => k + 1);
    }
    const moved = bulkLeadMovedMessage(updated);
    if (moved) invalidateLeadViews(qc);
    const message = bulkMessage(result, "activity", next === "completed" ? "completed" : "cancelled");
    if (result.failed > 0) toast.error(message, { description: moved });
    else toast.success(message, { description: moved });
  };

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
        trailing={<ColumnsMenu {...columnPrefs.menu} />}
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

      {canEdit ? (
        <BulkActionBar count={selected.length} onClear={() => setSelectionResetKey((k) => k + 1)}>
          <ConsoleButton
            size="sm"
            variant="secondary"
            loading={bulkPending === "completed"}
            disabled={bulkPending !== null}
            onClick={() => void setStatusForSelected("completed")}
          >
            <Check aria-hidden />
            Mark complete
          </ConsoleButton>
          <ConsoleButton
            size="sm"
            variant="secondary"
            loading={bulkPending === "cancelled"}
            disabled={bulkPending !== null}
            onClick={() => void setStatusForSelected("cancelled")}
          >
            <X aria-hidden />
            Cancel
          </ConsoleButton>
        </BulkActionBar>
      ) : null}

      <DataTable
        columns={columns}
        columnVisibility={columnPrefs.columnVisibility}
        data={filtered}
        loading={activitiesQuery.isLoading}
        searchValue={search}
        onRowSelectionChange={setSelected}
        selectionResetKey={selectionResetKey}
        itemLabel="activities"
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
