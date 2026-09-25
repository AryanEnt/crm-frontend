"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
} from "@/components/ui/drawer";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type SystemActivityEvent } from "@/lib/api/admin";

export function SystemActivityAdminView() {
  const { can } = useAuth();
  const [search, setSearch] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [entityType, setEntityType] = React.useState("");
  const [result, setResult] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const canView = can("system:view");

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) p.set("q", search);
    if (eventType) p.set("eventType", eventType);
    if (entityType) p.set("entityType", entityType);
    if (result) p.set("result", result);
    return p;
  }, [search, eventType, entityType, result]);

  const listQuery = useQuery({
    queryKey: ["system-activity", params.toString()],
    queryFn: () => adminApi.listSystemActivity(params),
    enabled: canView,
  });

  const detailQuery = useQuery({
    queryKey: ["system-activity", selectedId],
    queryFn: () => adminApi.getSystemActivity(selectedId!),
    enabled: Boolean(selectedId),
  });

  const columns = React.useMemo<ColumnDef<SystemActivityEvent>[]>(
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
        accessorKey: "eventType",
        header: "Event",
        cell: ({ row }) => <StatusBadge tone="brand">{row.original.eventType}</StatusBadge>,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left text-sm font-medium hover:text-brand"
            onClick={() => setSelectedId(row.original.id)}
          >
            {row.original.title}
          </button>
        ),
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => (
          <span className="text-foreground-muted">
            {row.original.entityType}
            {row.original.entityLabel ? ` · ${row.original.entityLabel}` : ""}
          </span>
        ),
      },
      {
        accessorKey: "result",
        header: "Result",
        cell: ({ row }) => (
          <StatusBadge tone={row.original.result === "success" ? "success" : "danger"}>
            {row.original.result}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "actorName",
        header: "Actor",
        cell: ({ row }) => row.original.actorName ?? "System",
      },
    ],
    [],
  );

  if (!canView) {
    return (
      <ErrorState title="Access denied" description="System activity requires system:view." />
    );
  }

  if (listQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState onRetry={() => void listQuery.refetch()} />;

  const items = listQuery.data?.data ?? [];
  const detail = detailQuery.data;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "System Activity" },
        ]}
        title="System Activity"
        description="Operational events recorded by the platform — automations, conversions, and integrations."
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, entity…"
        onClear={() => {
          setSearch("");
          setEventType("");
          setEntityType("");
          setResult("");
        }}
      >
        <InputFilter placeholder="Event type" value={eventType} onChange={setEventType} />
        <InputFilter placeholder="Entity type" value={entityType} onChange={setEntityType} />
        <Select value={result || "all"} onValueChange={(v) => setResult(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {!items.length && !search ? (
        <EmptyState
          title="No system events yet"
          description="Events appear as users and automations change CRM data."
        />
      ) : (
        <DataTable columns={columns} data={items} loading={listQuery.isFetching} pageSize={10} />
      )}

      <Drawer open={Boolean(selectedId)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DrawerContent side="right" className="sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>{detail?.title ?? "Event detail"}</DrawerTitle>
            <DrawerDescription>{detail?.eventType}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-3 text-sm">
            {detailQuery.isLoading ? (
              <LoadingState compact />
            ) : detail ? (
              <>
                <DetailRow label="When" value={new Date(detail.createdAt).toLocaleString()} />
                <DetailRow label="Result" value={detail.result} />
                <DetailRow label="Actor" value={detail.actorName ?? "System"} />
                <DetailRow label="Entity" value={`${detail.entityType} ${detail.entityLabel}`} />
                {detail.description ? (
                  <div>
                    <p className="text-xs font-medium text-foreground-muted">Description</p>
                    <p className="mt-1">{detail.description}</p>
                  </div>
                ) : null}
                {detail.metadata && Object.keys(detail.metadata).length ? (
                  <div>
                    <p className="text-xs font-medium text-foreground-muted">Metadata</p>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface-muted p-2 text-xs">
                      {JSON.stringify(detail.metadata, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </>
            ) : (
              <ErrorState title="Couldn't load this event" onRetry={() => void detailQuery.refetch()} />
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground-muted">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function InputFilter({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="h-8 w-[140px] rounded-md border border-border bg-surface px-2 text-xs"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
