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
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/console/textarea";
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
import { DatePicker } from "@/components/ui/date-picker";
import { leadHref } from "@/features/activities/activity-href";
import { useAuth } from "@/features/auth/auth-provider";
import {
  DocumentVisibilityPicker,
  defaultShareValue,
  type DocumentShareValue,
} from "@/features/documents/document-visibility-picker";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type CrmDocument } from "@/lib/api/crm";
import { useColumnVisibility } from "@/lib/column-visibility";
import { formatRelative } from "@/lib/relative-time";
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

type DocumentLink = { leadId?: string; customerId?: string; dealId?: string };

function uploaderRoleLabel(role: string | null | undefined) {
  if (role === "sales_manager") return "Team Lead";
  if (role === "super_admin") return "Admin";
  if (role === "sales_executive") return "Sales Executive";
  return role || null;
}

function shareSummary(d: CrmDocument): string {
  switch (d.shareScope) {
    case "all_teams":
      return "All teams";
    case "selected_teams":
      return d.sharedTeamNames?.length
        ? d.sharedTeamNames.join(", ")
        : `${d.sharedTeamIds?.length ?? 0} team(s)`;
    case "all_team_ses":
      return d.sharedTeamNames?.length
        ? `All SEs · ${d.sharedTeamNames.join(", ")}`
        : "All SEs on team";
    case "selected_ses":
      return `${d.sharedUserIds?.length ?? d.viewerUserIds?.length ?? 0} SE(s)`;
    default:
      return "Private";
  }
}

function canDeleteDocument(
  doc: CrmDocument,
  opts: { canDeletePerm: boolean; roleCode?: string; userId?: string },
): boolean {
  if (!opts.canDeletePerm) return false;
  if (opts.roleCode === "sales_manager") return doc.uploadedBy === opts.userId;
  return true;
}

function validateShare(share: DocumentShareValue, roleCode: string | undefined): string | null {
  if (roleCode === "super_admin" && share.shareScope === "selected_teams" && share.teamIds.length === 0) {
    return "Select at least one team";
  }
  if (roleCode === "sales_manager" && share.shareScope === "selected_ses" && share.viewerUserIds.length === 0) {
    return "Select at least one Sales Executive";
  }
  return null;
}

function appendShareFields(form: FormData, share: DocumentShareValue) {
  form.append("shareScope", share.shareScope);
  if (share.teamIds.length > 0) form.append("teamIds", JSON.stringify(share.teamIds));
  if (share.viewerUserIds.length > 0) form.append("viewerUserIds", JSON.stringify(share.viewerUserIds));
}

export function DocumentsTableView({
  leadId,
  customerId,
  dealId,
  compact,
}: DocumentLink & { compact?: boolean } = {}) {
  const fixedLink: DocumentLink = { leadId, customerId, dealId };
  const { can, user } = useAuth();
  const isAdmin = user?.roleCode === "super_admin";
  const isTeamLead = user?.roleCode === "sales_manager";
  const qc = useQueryClient();
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [shareScopeFilter, setShareScopeFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<CrmDocument[]>([]);
  const [selectionResetKey, setSelectionResetKey] = React.useState(0);
  const [bulkPending, setBulkPending] = React.useState(false);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const now = Date.now();

  const teamsQuery = useQuery({
    queryKey: ["document-filters", "teams"],
    enabled: isAdmin,
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({
      limit: "50",
      offset: "0",
      excludeScreenshots: "1",
    });
    if (status !== "all") p.set("status", status);
    if (leadId) p.set("leadId", leadId);
    if (customerId) p.set("customerId", customerId);
    if (dealId) p.set("dealId", dealId);
    if (search) p.set("q", search);
    if (typeFilter.trim()) p.set("type", typeFilter.trim());
    if (shareScopeFilter !== "all") p.set("shareScope", shareScopeFilter);
    if (isAdmin && teamFilter !== "all") p.set("teamId", teamFilter);
    if (createdFrom) p.set("createdFrom", createdFrom);
    if (isAdmin && source === "team_lead") p.set("uploadedByRole", "sales_manager");
    if (isAdmin && source === "me" && user?.id) p.set("uploadedBy", user.id);
    return p;
  }, [
    status,
    leadId,
    customerId,
    dealId,
    search,
    isAdmin,
    source,
    user?.id,
    shareScopeFilter,
    teamFilter,
    typeFilter,
    createdFrom,
  ]);

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

  const canDeletePerm = can("documents:delete");
  const canCreate = can("documents:create");
  const deleteOpts = { canDeletePerm, roleCode: user?.roleCode, userId: user?.id };

  const columns = React.useMemo<ColumnDef<CrmDocument>[]>(
    () => [
      ...(canDeletePerm ? [createSelectColumn<CrmDocument>()] : []),
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Title" />,
        enableHiding: false,
        cell: ({ row }) => {
          const d = row.original;
          const filename = d.originalFilename || d.name;
          return (
            <div>
              {d.fileKey ? (
                <button
                  type="button"
                  onClick={() => setViewing(d)}
                  className="rounded-sm text-left font-medium hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {d.name}
                </button>
              ) : (
                <p className="font-medium">{d.name}</p>
              )}
              <p className="text-[11px] text-foreground-muted">
                {filename}
                {d.mimeType ? ` · ${d.mimeType}` : ""}
                {d.sizeBytes ? ` · ${formatFileSize(d.sizeBytes)}` : ""}
              </p>
            </div>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-[13px] text-foreground">
            {row.original.type || row.original.category || "—"}
          </span>
        ),
      },
      {
        id: "share",
        header: "Sharing",
        cell: ({ row }) => (
          <span className="text-[13px] text-foreground">{shareSummary(row.original)}</span>
        ),
      },
      {
        id: "people",
        header: "Uploaded by",
        cell: ({ row }) => {
          const d = row.original;
          const role = uploaderRoleLabel(d.uploadedByRole);
          return (
            <div>
              <p className="text-[13px] text-foreground">{d.uploadedByName ?? "—"}</p>
              {role ? <p className="text-[11px] text-foreground-muted">{role}</p> : null}
            </div>
          );
        },
      },
      {
        id: "uploaded",
        header: "Uploaded",
        cell: ({ row }) => {
          const at = row.original.uploadedDate || row.original.createdAt;
          return (
            <span className="text-[13px] text-foreground-muted" title={at}>
              {at ? formatRelative(at, now) : "—"}
            </span>
          );
        },
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
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const d = row.original;
          const showDelete = canDeleteDocument(d, deleteOpts);
          return (
            <div className="flex flex-wrap justify-end gap-1">
              {d.fileKey ? (
                <Button size="sm" variant="ghost" asChild>
                  <a
                    href={crmApi.downloadDocumentUrl(d.id)}
                    download={d.originalFilename || d.name}
                    aria-label={`Download ${d.name}`}
                  >
                    <Download className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {showDelete ? (
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
    [canDeletePerm, deleteMutation, deletingId, deleteOpts, now],
  );

  const columnPrefs = useColumnVisibility("documents", columns);

  const deleteSelected = async () => {
    const deletable = selected.filter((d) => canDeleteDocument(d, deleteOpts));
    if (deletable.length === 0) {
      toast.error("You can only delete documents you are allowed to remove");
      return;
    }
    if (!window.confirm(`Delete ${deletable.length} document${deletable.length === 1 ? "" : "s"}?`)) return;
    setBulkPending(true);
    const result = await runBulk(deletable, (d) => crmApi.deleteDocument(d.id));
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

  const description = isAdmin
    ? "Upload and share files with teams, and review documents Team Leads upload."
    : isTeamLead
      ? "Share files with your Sales Executives, and open files Admin shared with your team."
      : "View and download documents shared with you or your team.";

  return (
    <div className="space-y-4">
      {!compact ? (
        <PageHeader
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Documents" }]}
          title="Documents"
          description={description}
          actions={
            <div className="flex gap-2">
              {canCreate ? (
                <>
                  {hasFixedLink(fixedLink) ? (
                    <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)}>
                      <Plus className="size-3.5" />
                      Request
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <FileUp className="size-3.5" />
                    Upload
                  </Button>
                </>
              ) : null}
            </div>
          }
        />
      ) : canCreate ? (
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
        searchPlaceholder="Search title or filename…"
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
        <Select value={shareScopeFilter} onValueChange={setShareScopeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sharing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sharing</SelectItem>
            <SelectItem value="all_teams">All teams</SelectItem>
            <SelectItem value="selected_teams">Selected teams</SelectItem>
            <SelectItem value="all_team_ses">All team SEs</SelectItem>
            <SelectItem value="selected_ses">Selected SEs</SelectItem>
            <SelectItem value="none">Private</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder="Type"
          className="h-8 w-[120px]"
        />
        {isAdmin ? (
          <>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="From" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="team_lead">From Team Leads</SelectItem>
                <SelectItem value="me">Shared by me</SelectItem>
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teams</SelectItem>
                {(teamsQuery.data?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        <DatePicker
          aria-label="Uploaded from"
          value={createdFrom}
          onChange={setCreatedFrom}
          placeholder="From date"
          clearable
        />
      </FilterBar>

      {canDeletePerm ? (
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
        emptyTitle="No documents yet"
        emptyDescription={
          canCreate
            ? "Upload a file and choose who on your teams can access it."
            : "Documents shared with you will appear here."
        }
        emptyActionLabel={canCreate ? "Upload document" : undefined}
        onEmptyAction={canCreate ? () => setUploadOpen(true) : undefined}
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
  const { user } = useAuth();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [share, setShare] = React.useState<DocumentShareValue>(() => defaultShareValue(user?.roleCode));
  const [loading, setLoading] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(open);

  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setName("");
      setType("");
      setExpiryDate("");
      setShare(defaultShareValue(user?.roleCode));
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
                const shareError = validateShare(share, user?.roleCode);
                if (shareError) {
                  toast.error(shareError);
                  return;
                }
                const link = linkBody(fixedLink, "");
                setLoading(true);
                try {
                  await crmApi.requestDocument({
                    name: name.trim(),
                    type: type.trim(),
                    leadId: link.leadId ?? null,
                    customerId: link.customerId ?? null,
                    dealId: link.dealId ?? null,
                    expiryDate: expiryDate || null,
                    shareScope: share.shareScope,
                    teamIds: share.teamIds,
                    viewerUserIds: share.viewerUserIds,
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
        <CrmFormSection title="Who can see this" divided>
          <DocumentVisibilityPicker value={share} onChange={setShare} />
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
          <span className="block text-[12px] text-foreground-subtle">
            PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, and images
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
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
  const { user } = useAuth();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [share, setShare] = React.useState<DocumentShareValue>(() => defaultShareValue(user?.roleCode));
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [openedAt, setOpenedAt] = React.useState(open);

  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setShare(defaultShareValue(user?.roleCode));
      setFile(null);
      setName("");
      setType("");
      setDescription("");
    }
  }
  const link = linkBody(fixedLink, "");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-lg">
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
                if (next && !name.trim()) setName(next.name.replace(/\.[^.]+$/, "") || next.name);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label required>Title</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={file?.name ?? "Document title"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes for recipients"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="policy, handbook, contract…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sharing</Label>
            <DocumentVisibilityPicker value={share} onChange={setShare} />
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
                if (!name.trim()) {
                  toast.error("Title is required");
                  return;
                }
                const shareError = validateShare(share, user?.roleCode);
                if (shareError) {
                  toast.error(shareError);
                  return;
                }
                setLoading(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  form.append("name", name.trim() || file.name);
                  form.append("type", type);
                  form.append("notes", description.trim());
                  if (link.leadId) form.append("leadId", link.leadId);
                  if (link.customerId) form.append("customerId", link.customerId);
                  if (link.dealId) form.append("dealId", link.dealId);
                  appendShareFields(form, share);
                  await crmApi.uploadDocument(form);
                  onOpenChange(false);
                  setFile(null);
                  setName("");
                  setType("");
                  setDescription("");
                  setShare(defaultShareValue(user?.roleCode));
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
