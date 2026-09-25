"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  adminApi,
  type CustomFieldDefinition,
  type CustomFieldOptionInput,
} from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";

const ENTITIES = ["lead", "customer", "deal", "activity"] as const;
const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "single_select",
  "multi_select",
  "url",
  "email",
  "phone",
] as const;

type FormState = {
  entity: string;
  name: string;
  internalKey: string;
  fieldType: string;
  description: string;
  helpText: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: string;
  pipelineId: string;
  stageId: string;
  options: CustomFieldOptionInput[];
};

const emptyForm = (): FormState => ({
  entity: "lead",
  name: "",
  internalKey: "",
  fieldType: "text",
  description: "",
  helpText: "",
  isRequired: false,
  isActive: true,
  displayOrder: "0",
  pipelineId: "",
  stageId: "",
  options: [],
});

function needsOptions(fieldType: string) {
  return fieldType === "single_select" || fieldType === "multi_select";
}

export function CustomFieldsAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [activeOnly, setActiveOnly] = React.useState(false);
  const [requiredFilter, setRequiredFilter] = React.useState<"all" | "required" | "optional">("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<CustomFieldDefinition | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState<CustomFieldDefinition | null>(null);

  const canManage = can("custom_fields:manage");
  const canView = can("custom_fields:view") || canManage;
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "custom-fields"],
    queryFn: () => crmApi.listPipelines(undefined, true),
    enabled: formOpen,
  });
  const scopeStages =
    pipelinesQuery.data?.find((p) => p.id === form.pipelineId)?.stages.filter((s) => s.isActive) ?? [];

  const query = useQuery({
    queryKey: ["custom-fields", search, entityFilter, typeFilter, activeOnly],
    queryFn: () =>
      adminApi.listCustomFields({
        q: search || undefined,
        entity: entityFilter !== "all" ? entityFilter : undefined,
        fieldType: typeFilter !== "all" ? typeFilter : undefined,
        activeOnly,
      }),
    enabled: canView,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const opts = needsOptions(form.fieldType) ? form.options.filter((o) => o.label.trim()) : [];
      if (edit) {
        return adminApi.updateCustomField(edit.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          helpText: form.helpText.trim(),
          isRequired: form.isRequired,
          isActive: form.isActive,
          displayOrder: Number(form.displayOrder) || 0,
          pipelineId: form.pipelineId,
          stageId: form.stageId,
          options: needsOptions(form.fieldType) ? opts : undefined,
        });
      }
      return adminApi.createCustomField({
        entity: form.entity,
        name: form.name.trim(),
        internalKey: form.internalKey.trim(),
        fieldType: form.fieldType,
        description: form.description.trim(),
        helpText: form.helpText.trim(),
        isRequired: form.isRequired,
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder) || 0,
        pipelineId: form.pipelineId || undefined,
        stageId: form.stageId || undefined,
        options: opts,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["custom-fields"] });
      setFormOpen(false);
      setEdit(null);
      toast.success(edit ? "Custom field updated" : "Custom field created");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't save. Check required fields and try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCustomField(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["custom-fields"] });
      setDeleteTarget(null);
      toast.success("Custom field deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't delete. Try again."),
  });

  const openCreate = () => {
    setEdit(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: CustomFieldDefinition) => {
    setEdit(item);
    setForm({
      entity: item.entity,
      name: item.name,
      internalKey: item.internalKey,
      fieldType: item.fieldType,
      description: item.description,
      helpText: item.helpText,
      isRequired: item.isRequired,
      isActive: item.isActive,
      displayOrder: String(item.displayOrder),
      pipelineId: item.pipelineId ?? "",
      stageId: item.stageId ?? "",
      options: (item.options ?? []).map((o, i) => ({
        label: o.label,
        value: o.value,
        position: o.position ?? i,
      })),
    });
    setFormOpen(true);
  };

  const columns = React.useMemo<ColumnDef<CustomFieldDefinition>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Field" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-foreground-muted">{row.original.internalKey}</p>
          </div>
        ),
      },
      { accessorKey: "entity", header: "Entity" },
      {
        id: "scope",
        header: "Applies to",
        cell: ({ row }) => {
          if (!row.original.pipelineName) return "All pipelines";
          if (!row.original.stageName) return row.original.pipelineName;
          return `${row.original.pipelineName} · ${row.original.stageName}`;
        },
      },
      { accessorKey: "fieldType", header: "Type" },
      {
        accessorKey: "displayOrder",
        header: "Order",
      },
      {
        accessorKey: "isRequired",
        header: "Required",
        cell: ({ row }) => (row.original.isRequired ? "Yes" : "No"),
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
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setDeleteTarget(row.original)}
              >
                Delete
              </Button>
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
        description="Custom fields require custom_fields:view."
      />
    );
  }

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;

  const items = (query.data ?? []).filter((f) => {
    if (requiredFilter === "required") return f.isRequired;
    if (requiredFilter === "optional") return !f.isRequired;
    return true;
  });

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "Setup" },
          { label: "Custom Fields" },
        ]}
        title="Custom Fields"
        description="Extend leads, customers, deals, and activities with structured data."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              New field
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search fields…"
        onClear={() => {
          setSearch("");
          setEntityFilter("all");
          setTypeFilter("all");
          setActiveOnly(false);
          setRequiredFilter("all");
        }}
      >
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITIES.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={requiredFilter}
          onValueChange={(v) => setRequiredFilter(v as "all" | "required" | "optional")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Required" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="required">Required</SelectItem>
            <SelectItem value="optional">Optional</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-foreground-muted">
          <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(v === true)} />
          Active only
        </label>
      </FilterBar>

      {!items.length && !search && entityFilter === "all" ? (
        <EmptyState
          title="No custom fields"
          description="Add fields to capture data unique to your organization."
          actionLabel={canManage ? "Create first field" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <DataTable columns={columns} data={items} searchValue={search} pageSize={10} />
      )}

      <Modal open={formOpen} onOpenChange={setFormOpen}>
        <ModalContent className="max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>{edit ? "Edit custom field" : "New custom field"}</ModalTitle>
            <ModalDescription>Internal key cannot be changed after creation.</ModalDescription>
          </ModalHeader>
          <div className="space-y-3 py-2">
            {!edit ? (
              <>
                <div className="space-y-1.5">
                  <Label>Entity</Label>
                  <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Internal key</Label>
                  <Input
                    value={form.internalKey}
                    onChange={(e) => setForm({ ...form, internalKey: e.target.value })}
                    placeholder="my_field_key"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Field type</Label>
                  <Select
                    value={form.fieldType}
                    onValueChange={(v) => setForm({ ...form, fieldType: v, options: [] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-xs text-foreground-muted">
                {form.entity} · {form.fieldType} · {form.internalKey}
              </p>
            )}
            {form.entity !== "activity" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Pipeline</Label>
                  <Select
                    value={form.pipelineId || "all"}
                    onValueChange={(v) =>
                      setForm({ ...form, pipelineId: v === "all" ? "" : v, stageId: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All pipelines" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All pipelines</SelectItem>
                      {(pipelinesQuery.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stage</Label>
                  <Select
                    value={form.stageId || "all"}
                    onValueChange={(v) => setForm({ ...form, stageId: v === "all" ? "" : v })}
                    disabled={!form.pipelineId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stages</SelectItem>
                      {scopeStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
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
              <Label>Help text</Label>
              <Input
                value={form.helpText}
                onChange={(e) => setForm({ ...form, helpText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display order</Label>
              <Input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isRequired}
                onCheckedChange={(v) => setForm({ ...form, isRequired: v === true })}
              />
              Required on forms
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
              />
              Active
            </label>
            {needsOptions(form.fieldType) ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <Label>Options</Label>
                {form.options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Label"
                      value={opt.label}
                      onChange={(e) => {
                        const options = [...form.options];
                        options[idx] = {
                          ...options[idx],
                          label: e.target.value,
                          value: options[idx].value || e.target.value.toLowerCase().replace(/\s+/g, "_"),
                        };
                        setForm({ ...form, options });
                      }}
                    />
                    <Input
                      placeholder="Value"
                      value={opt.value}
                      onChange={(e) => {
                        const options = [...form.options];
                        options[idx] = { ...options[idx], value: e.target.value };
                        setForm({ ...form, options });
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          ...form,
                          options: form.options.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      options: [...form.options, { label: "", value: "", position: form.options.length }],
                    })
                  }
                >
                  Add option
                </Button>
              </div>
            ) : null}
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={
                !form.name.trim() || (!edit && (!form.internalKey.trim() || !form.entity))
              }
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
        title="Delete custom field?"
        description={`Remove "${deleteTarget?.name}"? Existing stored values may become orphaned.`}
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
