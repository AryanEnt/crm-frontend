"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, FileText, FileUp, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
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
} from "@/components/forms";
import { LeadCombobox } from "@/components/forms/entity-pickers";
import { DatePicker } from "@/components/ui/date-picker";
import { formTriggerClass } from "@/components/ui/dropdown-styles";
import { leadHref } from "@/features/activities/activity-href";
import { useAuth } from "@/features/auth/auth-provider";
import { DocumentVisibilityPicker } from "@/features/documents/document-visibility-picker";
import { crmApi, type CrmDocument } from "@/lib/api/crm";
import { useColumnVisibility } from "@/lib/column-visibility";
import { DocumentViewer } from "./document-viewer";
import { bulkMessage, runBulk } from "@/lib/bulk";

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

type DocumentLink = { leadId?: string; customerId?: string; dealId?: string };

export function DocumentsTableView({
  leadId,
  customerId,
  dealId,
  compact,
}: DocumentLink & { compact?: boolean } = {}) {
  const fixedLink: DocumentLink = { leadId, customerId, dealId };
  const { can } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<CrmDocument[]>([]);
  const [selectionResetKey, setSelectionResetKey] = React.useState(0);
  const [bulkPending, setBulkPending] = React.useState(false);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (status !== "all") p.set("status", status);
    if (leadId) p.set("leadId", leadId);
    if (customerId) p.set("customerId", customerId);
    if (dealId) p.set("dealId", dealId);
    if (search) p.set("q", search);
    return p;
  }, [status, leadId, customerId, dealId, search]);

  const query = useQuery({
    queryKey: ["documents", params.toString()],
    queryFn: () => crmApi.listDocuments(params),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["documents"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteDocument(id),
    onSuccess: () => {
      invalidate();
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Could not delete document"),
    onSettled: () => setDeletingId(null),
  });

  const canDelete = can("documents:delete");

  const columns = React.useMemo<ColumnDef<CrmDocument>[]>(
    () => [
      ...(canDelete ? [createSelectColumn<CrmDocument>()] : []),
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Name" />,
        enableHiding: false,
        cell: ({ row }) => (
          <div>
            {row.original.fileKey ? (
              <button
                type="button"
                onClick={() => setViewing(row.original)}
                className="rounded-sm text-left font-medium hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.original.name}
              </button>
            ) : (
              <p className="font-medium">{row.original.name}</p>
            )}
            <p className="text-[11px] text-foreground-muted">
              {row.original.type || row.original.category || "—"}
            </p>
          </div>
        ),
      },
      {
        id: "lead",
        header: "Lead",
        cell: ({ row }) => {
          const d = row.original;
          if (d.leadId) {
            return (
              <Link href={leadHref(d.leadId)} className="hover:text-brand">
                {d.leadName ?? "Open lead"}
              </Link>
            );
          }
          return <span className="text-foreground-muted">{d.customerName || d.dealTitle || "—"}</span>;
        },
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
          <div className="text-[11px] text-foreground-muted">
            {row.original.uploadedByName ?? "—"}
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
                  <a href={crmApi.downloadDocumentUrl(d.id)} download={d.name} aria-label={`Download ${d.name}`}>
                    <Download className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                  loading={deletingId === d.id}
                  onClick={() => {
                    if (!window.confirm(`Delete “${d.name}”?`)) return;
                    setDeletingId(d.id);
                    deleteMutation.mutate(d.id);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canDelete, deleteMutation, deletingId],
  );

  const columnPrefs = useColumnVisibility("documents", columns);

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selected.length} document${selected.length === 1 ? "" : "s"}?`)) return;
    setBulkPending(true);
    const result = await runBulk(selected, (d) => crmApi.deleteDocument(d.id));
    setBulkPending(false);
    if (result.ok > 0) {
      invalidate();
      setSelectionResetKey((k) => k + 1);
    }
    const message = bulkMessage(result, "document", "deleted");
    if (result.failed > 0) toast.error(message);
    else toast.success(message);
  };

  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <PageHeader
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Documents" }]}
          title="Documents"
          description="Upload and share files with your team."
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
        trailing={<ColumnsMenu {...columnPrefs.menu} />}
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

      {canDelete ? (
        <BulkActionBar count={selected.length} onClear={() => setSelectionResetKey((k) => k + 1)}>
          <ConsoleButton
            size="sm"
            variant="secondary"
            loading={bulkPending}
            disabled={bulkPending}
            onClick={() => void deleteSelected()}
          >
            <Trash2 aria-hidden />
            Delete
          </ConsoleButton>
        </BulkActionBar>
      ) : null}

      <DataTable
        columns={columns}
        columnVisibility={columnPrefs.columnVisibility}
        data={query.data?.data ?? []}
        loading={query.isLoading}
        searchValue={search}
        onRowSelectionChange={setSelected}
        selectionResetKey={selectionResetKey}
        itemLabel="documents"
      />

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      <RequestDocumentDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        fixedLink={fixedLink}
        onDone={invalidate}
      />
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        fixedLink={fixedLink}
        onDone={invalidate}
      />
    </div>
  );
}

const hasFixedLink = (l: DocumentLink) => Boolean(l.leadId || l.customerId || l.dealId);

/** The fixed record when the view is embedded on one, otherwise the picked lead. */
function linkBody(fixed: DocumentLink, pickedLeadId: string): DocumentLink {
  return hasFixedLink(fixed) ? fixed : { leadId: pickedLeadId || undefined };
}

function RequestDocumentDialog({
  open,
  onOpenChange,
  fixedLink,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedLink: DocumentLink;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [leadId, setLeadId] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [viewerUserIds, setViewerUserIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(open);

  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setLeadId("");
      setName("");
      setType("");
      setExpiryDate("");
      setViewerUserIds([]);
    }
  }

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
                const link = linkBody(fixedLink, leadId);
                setLoading(true);
                try {
                  await crmApi.requestDocument({
                    name: name.trim(),
                    type: type.trim(),
                    leadId: link.leadId ?? null,
                    customerId: link.customerId ?? null,
                    dealId: link.dealId ?? null,
                    expiryDate: expiryDate || null,
                    viewerUserIds,
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
          {!hasFixedLink(fixedLink) ? (
            <FormFieldSlot label="Lead">
              <LeadCombobox
                value={leadId || null}
                onChange={(v) => setLeadId(v ?? "")}
                triggerClassName={formTriggerClass}
              />
              <p className="text-[12px] text-foreground-subtle">Optional — leave empty for a shared team file.</p>
            </FormFieldSlot>
          ) : null}
          <FormFieldSlot label="Expiry date">
            <DatePicker
              aria-label="Expiry date"
              value={expiryDate}
              onChange={setExpiryDate}
              placeholder="No expiry"
              clearable
            />
          </FormFieldSlot>
        </CrmFormSection>
        <CrmFormSection title="Visible to" divided>
          <DocumentVisibilityPicker value={viewerUserIds} onChange={setViewerUserIds} />
        </CrmFormSection>
      </div>
    </QuickCreateDrawer>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadFileDropzone({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const preview = React.useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const take = (next: File | null) => {
    onChange(next);
    if (!next && inputRef.current) inputRef.current.value = "";
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-12 shrink-0 rounded object-cover" />
        ) : (
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-muted">
            <FileText className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
          <p className="text-[12px] text-foreground-subtle">{formatFileSize(file.size)}</p>
        </div>
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Remove file"
          onClick={() => take(null)}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          take(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-md border border-dashed px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver
            ? "border-brand bg-brand-soft"
            : "border-border bg-surface hover:border-brand hover:bg-surface-muted",
        )}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-muted">
          <FileUp className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-foreground">Drop a file here or browse</span>
          <span className="block text-[12px] text-foreground-subtle">PDF, images, Word, Excel — any file type</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => take(e.target.files?.[0] ?? null)}
      />
    </>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  fixedLink,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fixedLink: DocumentLink;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [leadId, setLeadId] = React.useState("");
  const [viewerUserIds, setViewerUserIds] = React.useState<string[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(open);

  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setLeadId("");
      setViewerUserIds([]);
      setFile(null);
      setName("");
      setType("");
    }
  }
  const link = linkBody(fixedLink, leadId);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Upload document</ModalTitle>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>File</Label>
            <UploadFileDropzone
              file={file}
              onChange={(next) => {
                setFile(next);
                if (next && !name.trim()) setName(next.name);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={file?.name ?? "Document name"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="passport, contract…"
            />
          </div>
          {!hasFixedLink(fixedLink) ? (
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <LeadCombobox value={leadId || null} onChange={(v) => setLeadId(v ?? "")} />
              <p className="text-[12px] text-foreground-subtle">Optional — leave empty for a shared team file.</p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Visible to</Label>
            <DocumentVisibilityPicker value={viewerUserIds} onChange={setViewerUserIds} />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!file}
            onClick={() => {
              void (async () => {
                if (!file) return;
                setLoading(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  form.append("name", name || file.name);
                  form.append("type", type);
                  if (link.leadId) form.append("leadId", link.leadId);
                  if (link.customerId) form.append("customerId", link.customerId);
                  if (link.dealId) form.append("dealId", link.dealId);
                  form.append("viewerUserIds", JSON.stringify(viewerUserIds));
                  await crmApi.uploadDocument(form);
                  onOpenChange(false);
                  setFile(null);
                  setName("");
                  setType("");
                  setLeadId("");
                  setViewerUserIds([]);
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
