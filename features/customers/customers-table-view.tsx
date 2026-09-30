"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, EntityCell, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Customer } from "@/lib/api/crm";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { ScopeFilterControls, useScopeFilters } from "@/features/teams/scope-filters";
import { priorityBadgeClass, priorityFromString } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}

function followUpClass(next?: string | null) {
  if (!next) return "text-health-warn font-medium";
  if (new Date(next).getTime() < Date.now()) return "text-health-bad font-medium";
  return "text-foreground-subtle";
}

export function CustomersTableView() {
  const { can } = useAuth();
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const scopeFilters = useScopeFilters("customers:view");
  const scopeParams = scopeFilters.params;

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) p.set("q", search);
    for (const [key, value] of scopeParams) p.set(key, value);
    return p;
  }, [search, scopeParams]);

  const customersQuery = useQuery({
    queryKey: ["customers", params.toString()],
    queryFn: () => crmApi.listCustomers(params),
  });

  const columns = React.useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="Customer" />,
        cell: ({ row }) => (
          <EntityCell
            name={row.original.fullName}
            subtitle={row.original.email ?? row.original.phone ?? "No contact details"}
          />
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ? (
            <span className="font-mono text-caption tabular-nums text-ink-secondary">
              {row.original.phone}
            </span>
          ) : (
            <span className="text-ink-muted">Not added</span>
          ),
      },
      {
        accessorKey: "ownerName",
        header: "Owner",
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted">{row.original.ownerName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "pipelineName",
        header: "Pipeline",
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted">{row.original.pipelineName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "stageName",
        header: "Stage",
        cell: ({ row }) =>
          row.original.stageName ? (
            <StatusBadge tone="brand">{row.original.stageName}</StatusBadge>
          ) : (
            "—"
          ),
      },
      {
        id: "anzsco",
        header: "ANZSCO",
        cell: ({ row }) =>
          row.original.anzscoCode ? (
            <span className="text-meta">
              <span className="font-mono text-foreground-muted">{row.original.anzscoCode}</span>{" "}
              {row.original.anzscoTitle}
            </span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted">{row.original.source || "—"}</span>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const level = priorityFromString(row.original.priority);
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium capitalize",
                priorityBadgeClass[level],
              )}
            >
              {level}
            </span>
          );
        },
      },
      {
        accessorKey: "lastContactedAt",
        header: "Last contacted",
        cell: ({ row }) => (
          <span className="text-meta text-data">{formatWhen(row.original.lastContactedAt)}</span>
        ),
      },
      {
        accessorKey: "nextFollowUpAt",
        header: "Next follow-up",
        cell: ({ row }) => {
          const missing = !row.original.nextFollowUpAt;
          return (
            <span className={cn("text-xs text-data", followUpClass(row.original.nextFollowUpAt))}>
              {missing ? "None" : formatWhen(row.original.nextFollowUpAt)}
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-meta text-data">{formatWhen(row.original.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  if (customersQuery.isError) {
    return <ErrorState onRetry={() => void customersQuery.refetch()} />;
  }

  const hasFilters = !!search || scopeFilters.active;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Customers" }]}
        title="Customers"
        description="Accounts and contacts with ongoing relationship context."
        actions={
          can("customers:create") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New customer
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, phone…"
        onClear={() => {
          setSearch("");
          scopeFilters.reset();
        }}
      >
        <ScopeFilterControls filters={scopeFilters} />
      </FilterBar>

      <DataTable
        columns={columns}
        data={customersQuery.data?.data ?? []}
        loading={customersQuery.isLoading}
        searchValue={search}
        pageSize={10}
        itemLabel="customers"
        onRowClick={(customer) => router.push(`/customers/${customer.id}`)}
        emptyTitle={hasFilters ? "No customers match these filters" : "No customers yet"}
        emptyDescription={
          hasFilters
            ? "Clear filters or broaden search to find accounts."
            : "Add a customer or convert a qualified lead to open their 360."
        }
        emptyActionLabel={can("customers:create") && !hasFilters ? "New customer" : undefined}
        onEmptyAction={
          can("customers:create") && !hasFilters ? () => setCreateOpen(true) : undefined
        }
      />

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(customer) => {
          void customersQuery.refetch();
          if (customer?.id) router.push(`/customers/${customer.id}`);
        }}
      />
    </div>
  );
}
