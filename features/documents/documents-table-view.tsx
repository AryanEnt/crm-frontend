"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QuickCreateDrawer,
  FormFieldSlot,
  CrmFormSection,
  CRM_FIELD_INPUT_CLASS,
  SearchableSelect,
} from "@/components/forms";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type CrmDocument } from "@/lib/api/crm";

const DOC_STATUSES = [
  "requested",
  "uploaded",
  "verified",
  "rejected",
  "missing",
  "expired",
] as const;

const statusTone = (s: string) => {
  switch (s) {
    case "verified":
      return "success" as const;
    case "uploaded":
      return "brand" as const;
    case "requested":
    case "missing":
      return "warning" as const;
    case "rejected":
    case "expired":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
};

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

export function DocumentsTableView({
  customerId,
  dealId,
  compact,
}: {
  customerId?: string;
  dealId?: string;
  compact?: boolean;
} = {}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (status !== "all") p.set("status", status);
    if (customerId) p.set("customerId", customerId);
    if (dealId) p.set("dealId", dealId);
    if (search) p.set("q", search);
    return p;
  }, [status, customerId, dealId, search]);

  const query = useQuery({
    queryKey: ["documents", params.toString()],
    queryFn: () => crmApi.listDocuments(params),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["documents"] });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => crmApi.verifyDocument(id),
    onSuccess: () => {
      invalidate();
      toast.success("Document verified");
    },
    onError: (err: Error) => toast.error(err.message || "Could not verify document"),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      crmApi.rejectDocument(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success("Document rejected");
    },
    onError: (err: Error) => toast.error(err.message || "Could not reject document"),
  });

  const columns = React.useMemo<ColumnDef<CrmDocument>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-[11px] text-foreground-muted">
              {row.original.type || row.original.category || "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => row.original.customerName ?? "—",
      },
      {
        accessorKey: "dealTitle",
        header: "Deal",
        cell: ({ row }) => row.original.dealTitle ?? "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={statusTone(row.original.status)}>
            {row.original.status}
          </StatusBadge>
        ),
      },
      {
        id: "dates",
        header: "Dates",
        cell: ({ row }) => (
          <div className="text-[11px] text-foreground-muted space-y-0.5">
            <div>Req: {formatWhen(row.original.requestedDate)}</div>
            <div>Up: {formatWhen(row.original.uploadedDate)}</div>
            <div>Exp: {formatWhen(row.original.expiryDate)}</div>
          </div>
        ),
      },
      {
        id: "people",
        header: "By",
        cell: ({ row }) => (
          <div className="text-[11px] text-foreground-muted space-y-0.5">
            <div>↑ {row.original.uploadedByName ?? "—"}</div>
            <div>✓ {row.original.verifiedByName ?? "—"}</div>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {d.fileKey ? (
                <Button size="sm" variant="ghost" asChild>
                  <a href={crmApi.downloadDocumentUrl(d.id)} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </Button>
              ) : null}
              {can("documents:edit") && (d.status === "uploaded" || d.status === "rejected") ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate(d.id)}
                >
                  Verify
                </Button>
              ) : null}
              {can("documents:edit") &&
              (d.status === "uploaded" || d.status === "verified") ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={rejectMutation.isPending}
                  onClick={() => {
                    const reason = window.prompt("Rejection reason");
                    if (reason) rejectMutation.mutate({ id: d.id, reason });
                  }}
                >
                  Reject
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [can, verifyMutation, rejectMutation],
  );

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <PageHeader
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Documents" }]}
          title="Documents"
          description="Request, upload, and verify files against CRM records."
          actions={
            <div className="flex gap-2">
              {can("documents:create") ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                    <Plus className="size-3.5" />
                    Request
                  </Button>
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <FileUp className="size-3.5" />
                    Upload
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
      ) : can("documents:create") ? (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
            Request
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        </div>
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search documents…"
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {DOC_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={query.data?.data ?? []}
        loading={query.isLoading}
      />

      <RequestDocumentDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        defaultCustomerId={customerId}
        defaultDealId={dealId}
        onDone={invalidate}
      />
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultCustomerId={customerId}
        defaultDealId={dealId}
        onDone={invalidate}
      />
    </div>
  );
}

function RequestDocumentDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  defaultDealId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCustomerId?: string;
  defaultDealId?: string;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [customerId, setCustomerId] = React.useState(defaultCustomerId ?? "");
  const [dealId, setDealId] = React.useState(defaultDealId ?? "");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? "");
      setDealId(defaultDealId ?? "");
      setName("");
      setType("");
      setExpiryDate("");
    }
  }, [open, defaultCustomerId, defaultDealId]);

  return (
    <QuickCreateDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Request document"
      description="Creates a requested placeholder on the record."
      className="shadow-[-6px_0_24px_rgba(42,40,56,0.06)] sm:max-w-[460px]"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 text-[13px]"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 text-[13px]"
            loading={loading}
            onClick={() => {
              void (async () => {
                if (!name.trim() || !type.trim()) {
                  toast.error("Name and type are required");
                  return;
                }
                setLoading(true);
                try {
                  await crmApi.requestDocument({
                    name: name.trim(),
                    type: type.trim(),
                    customerId: customerId || null,
                    dealId: dealId || null,
                    expiryDate: expiryDate || null,
                  });
                  onOpenChange(false);
                  onDone();
                  toast.success("Document requested");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not request document");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Request
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <CrmFormSection title="Document">
          <FormFieldSlot label="Name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Document name"
              className={CRM_FIELD_INPUT_CLASS}
              autoFocus
            />
          </FormFieldSlot>
          <FormFieldSlot label="Type" required>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="passport, contract…"
              className={CRM_FIELD_INPUT_CLASS}
            />
          </FormFieldSlot>
        </CrmFormSection>
        <CrmFormSection title="Link to" divided>
          {!defaultCustomerId ? (
            <FormFieldSlot label="Customer">
              <SearchableSelect
                value={customerId || null}
                onChange={(v) => setCustomerId(v ?? "")}
                onSearch={async (q) => {
                  const res = await crmApi.listCustomers(
                    new URLSearchParams({ limit: "20", q: q || "" }),
                  );
                  return (res.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.fullName,
                    meta: c.email ?? undefined,
                  }));
                }}
                placeholder="Search customer…"
                emptyText="No matching customers found."
                className={CRM_FIELD_INPUT_CLASS}
              />
            </FormFieldSlot>
          ) : null}
          {!defaultDealId ? (
            <FormFieldSlot label="Deal ID (optional)">
              <Input
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className={CRM_FIELD_INPUT_CLASS}
                placeholder="Deal UUID"
              />
            </FormFieldSlot>
          ) : null}
          <FormFieldSlot label="Expiry date">
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className={CRM_FIELD_INPUT_CLASS}
            />
          </FormFieldSlot>
        </CrmFormSection>
      </div>
    </QuickCreateDrawer>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  defaultDealId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCustomerId?: string;
  defaultDealId?: string;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [customerId, setCustomerId] = React.useState(defaultCustomerId ?? "");
  const [dealId, setDealId] = React.useState(defaultDealId ?? "");
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCustomerId(defaultCustomerId ?? "");
      setDealId(defaultDealId ?? "");
    }
  }, [open, defaultCustomerId, defaultDealId]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Upload document</ModalTitle>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>File</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              aria-required="true"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={file?.name ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} />
          </div>
          {!defaultCustomerId ? (
            <div className="space-y-1.5">
              <Label>Customer ID</Label>
              <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
            </div>
          ) : null}
          {!defaultDealId ? (
            <div className="space-y-1.5">
              <Label>Deal ID (optional)</Label>
              <Input value={dealId} onChange={(e) => setDealId(e.target.value)} />
            </div>
          ) : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!file || (!customerId && !dealId && !defaultCustomerId && !defaultDealId)}
            onClick={() => {
              void (async () => {
                if (!file) return;
                setLoading(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  form.append("name", name || file.name);
                  form.append("type", type);
                  if (customerId || defaultCustomerId) {
                    form.append("customerId", customerId || defaultCustomerId!);
                  }
                  if (dealId || defaultDealId) {
                    form.append("dealId", dealId || defaultDealId!);
                  }
                  await crmApi.uploadDocument(form);
                  onOpenChange(false);
                  setFile(null);
                  setName("");
                  setType("");
                  onDone();
                  toast.success("Document uploaded");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not upload document");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
