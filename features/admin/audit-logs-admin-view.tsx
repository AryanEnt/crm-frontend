"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { adminApi, type AuditLog } from "@/lib/api/admin";

export function AuditLogsAdminView() {
  const [search, setSearch] = React.useState("");
  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) p.set("q", search);
    return p;
  }, [search]);

  const query = useQuery({
    queryKey: ["audit-logs", params.toString()],
    queryFn: () => adminApi.listAuditLogs(params),
  });

  const columns = React.useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortableHeader column={column} title="When" />,
        cell: ({ row }) => (
          <span className="text-xs text-foreground-subtle">
            {new Date(row.original.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "actorName",
        header: "Actor",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.actorName ?? "System"}</p>
            <p className="text-xs text-foreground-muted">{row.original.actorEmail}</p>
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => <StatusBadge tone="brand">{row.original.action}</StatusBadge>,
      },
      {
        accessorKey: "resourceType",
        header: "Resource",
        cell: ({ row }) => (
          <span className="text-foreground-muted">
            {row.original.resourceType}
            {row.original.resourceId ? ` · ${row.original.resourceId.slice(0, 8)}` : ""}
          </span>
        ),
      },
    ],
    [],
  );

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Control Center", href: "/" }, { label: "Audit Logs" }]}
        title="Audit Logs"
        description="Administrative changes are recorded for accountability."
      />
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search actions, actors…"
        onClear={() => setSearch("")}
      />
      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        loading={query.isLoading}
        searchValue={search}
        pageSize={10}
      />
    </div>
  );
}
