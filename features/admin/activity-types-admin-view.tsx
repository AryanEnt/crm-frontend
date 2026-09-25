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
import { TableSkeleton } from "@/components/ui/skeleton";
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
import { adminApi, type AdminActivityType } from "@/lib/api/admin";

type FormState = {
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  position: string;
  requiresDatetime: boolean;
  requiresDuration: boolean;
  requiresOutcome: boolean;
  requiresNotes: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  icon: "calendar",
  color: "#0E7490",
  isActive: true,
  position: "0",
  requiresDatetime: false,
  requiresDuration: false,
  requiresOutcome: false,
  requiresNotes: false,
});

export function ActivityTypesAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<AdminActivityType | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminActivityType | null>(null);

  const canManage = can("activity_types:manage");
  const canView = can("activity_types:view") || canManage;

  const query = useQuery({
    queryKey: ["admin-activity-types"],
    queryFn: () => adminApi.listAdminActivityTypes(),
    enabled: canView,
  });

  const filtered = React.useMemo(() => {
    const items = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
        color: form.color.trim(),
        isActive: form.isActive,
        position: Number(form.position) || 0,
        requiresDatetime: form.requiresDatetime,
        requiresDuration: form.requiresDuration,
        requiresOutcome: form.requiresOutcome,
        requiresNotes: form.requiresNotes,
      };
      if (edit) return adminApi.updateAdminActivityType(edit.id, body);
      return adminApi.createAdminActivityType(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-activity-types"] });
      void qc.invalidateQueries({ queryKey: ["activity-types"] });
      setFormOpen(false);
      setEdit(null);
      toast.success(edit ? "Activity type updated" : "Activity type created");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't save. Check required fields and try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminActivityType(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-activity-types"] });
      void qc.invalidateQueries({ queryKey: ["activity-types"] });
      setDeleteTarget(null);
      toast.success("Activity type deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't delete. Try again."),
  });

  const openCreate = () => {
    setEdit(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: AdminActivityType) => {
    setEdit(item);
    setForm({
      name: item.name,
      description: item.description,
      icon: item.icon,
      color: item.color,
      isActive: item.isActive,
      position: String(item.position),
      requiresDatetime: item.requiresDatetime,
      requiresDuration: item.requiresDuration,
      requiresOutcome: item.requiresOutcome,
      requiresNotes: item.requiresNotes,
    });
    setFormOpen(true);
  };

  const columns = React.useMemo<ColumnDef<AdminActivityType>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: row.original.color || "#0E7490" }}
            />
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-foreground-muted">{row.original.code}</p>
            </div>
          </div>
        ),
      },
      {
        id: "requirements",
        header: "Form rules",
        cell: ({ row }) => {
          const flags = [
            row.original.requiresDatetime && "Date/time",
            row.original.requiresDuration && "Duration",
            row.original.requiresOutcome && "Outcome",
            row.original.requiresNotes && "Notes req.",
          ].filter(Boolean);
          return (
            <span className="text-xs text-foreground-muted">
              {flags.length ? flags.join(" · ") : "Default"}
            </span>
          );
        },
      },
      { accessorKey: "position", header: "Order" },
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
          canManage && !row.original.isSystem ? (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleteTarget(row.original)}
              >
                Delete
              </Button>
            </div>
          ) : row.original.isSystem ? (
            <span className="text-xs text-foreground-muted">System</span>
          ) : null,
      },
    ],
    [canManage],
  );

  if (!canView) {
    return (
      <ErrorState
        title="Access denied"
        description="Activity types require activity_types:view."
      />
    );
  }

  if (query.isLoading) return <TableSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "Setup" },
          { label: "Activity types" },
        ]}
        title="Activity types"
        description="Define call, meeting, and follow-up types used when logging work."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              New type
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search types…"
        onClear={() => setSearch("")}
      />

      {!filtered.length && !search ? (
        <EmptyState
          title="No activity types"
          description="Create types for calls, meetings, and follow-ups."
          actionLabel={canManage ? "Create type" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} searchValue={search} pageSize={10} />
      )}

      <Modal open={formOpen} onOpenChange={setFormOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{edit ? "Edit activity type" : "New activity type"}</ModalTitle>
            <ModalDescription>Code is generated from the name on create.</ModalDescription>
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={form.color.startsWith("#") ? form.color : "#0E7490"}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Display order</Label>
              <Input
                type="number"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <fieldset className="space-y-2 rounded-md border border-border p-3">
              <legend className="px-1 text-xs font-medium text-foreground-muted">
                Quick-create form
              </legend>
              {(
                [
                  ["requiresDatetime", "Require date/time"],
                  ["requiresDuration", "Require start & end (duration)"],
                  ["requiresOutcome", "Require outcome"],
                  ["requiresNotes", "Require notes"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form[key]}
                    onCheckedChange={(v) => setForm({ ...form, [key]: v === true })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
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
        title="Delete activity type?"
        description={`Remove "${deleteTarget?.name}"? Existing activities keep their historical type.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
