"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type LeadSource } from "@/lib/api/admin";

type FormState = {
  name: string;
  description: string;
  isActive: boolean;
  position: string;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  isActive: true,
  position: "0",
});

export function LeadSourcesAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [activeOnly, setActiveOnly] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<LeadSource | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState<LeadSource | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<LeadSource | null>(null);

  const canManage = can("lead_sources:manage");
  const canView = can("lead_sources:view") || canManage;

  const query = useQuery({
    queryKey: ["lead-sources", search, activeOnly],
    queryFn: () => adminApi.listLeadSources({ q: search || undefined, activeOnly }),
    enabled: canView,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        isActive: form.isActive,
        position: Number(form.position) || 0,
      };
      if (edit) return adminApi.updateLeadSource(edit.id, body);
      return adminApi.createLeadSource(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lead-sources"] });
      setFormOpen(false);
      setEdit(null);
      toast.success(edit ? "Lead source updated" : "Lead source created");
    },
    onError: (err: Error) => toast.error(err.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteLeadSource(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lead-sources"] });
      setDeleteTarget(null);
      toast.success("Lead source removed");
    },
    onError: (err: Error) => toast.error(err.message || "Delete failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (item: LeadSource) =>
      adminApi.updateLeadSource(item.id, { isActive: false }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lead-sources"] });
      setDeactivateTarget(null);
      toast.success("Lead source deactivated");
    },
    onError: (err: Error) => toast.error(err.message || "Update failed"),
  });

  const openCreate = () => {
    setEdit(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: LeadSource) => {
    setEdit(item);
    setForm({
      name: item.name,
      description: item.description,
      isActive: item.isActive,
      position: String(item.position),
    });
    setFormOpen(true);
  };

  const columns = React.useMemo<ColumnDef<LeadSource>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-foreground-muted">{row.original.code}</p>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm text-foreground-muted line-clamp-2">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "position",
        header: "Order",
        cell: ({ row }) => row.original.position,
      },
      {
        accessorKey: "usageCount",
        header: "Usage",
        cell: ({ row }) => row.original.usageCount,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "neutral"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          canManage ? (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                Edit
              </Button>
              {row.original.usageCount > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={!row.original.isActive}
                  onClick={() => setDeactivateTarget(row.original)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(row.original)}
                >
                  Delete
                </Button>
              )}
            </div>
          ) : null,
      },
    ],
    [canManage],
  );

  if (!canView) {
    return (
      <ErrorState
        title="Access denied"
        description="Lead source configuration requires lead_sources:view."
      />
    );
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const items = query.data ?? [];

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "CRM Configuration" },
          { label: "Lead Sources" },
        ]}
        title="Lead Sources"
        description="Define where leads and customers originate. Sources appear in create forms across the CRM."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              New source
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sources…"
        onClear={() => {
          setSearch("");
          setActiveOnly(false);
        }}
      >
        <label className="flex items-center gap-2 text-xs text-foreground-muted">
          <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)} />
          Active only
        </label>
      </FilterBar>

      {!items.length && !search ? (
        <EmptyState
          title="No lead sources yet"
          description="Add sources so your team can track acquisition channels consistently."
          actionLabel={canManage ? "Create first source" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <DataTable columns={columns} data={items} searchValue={search} pageSize={10} />
      )}

      <Modal open={formOpen} onOpenChange={setFormOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{edit ? "Edit lead source" : "New lead source"}</ModalTitle>
            <ModalDescription>Name is shown on lead and customer forms.</ModalDescription>
          </ModalHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display order</Label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
              />
              Active
            </label>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={!form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete lead source?"
        description={`Remove "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="Deactivate lead source?"
        description={`"${deactivateTarget?.name}" is in use (${deactivateTarget?.usageCount} records). Deactivate instead of deleting.`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
        onConfirm={() => {
          if (deactivateTarget) deactivateMutation.mutate(deactivateTarget);
        }}
      />
    </div>
  );
}
