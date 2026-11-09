"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Eye, FilePlus2, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/auth-provider";
import { DocumentViewer } from "@/features/documents/document-viewer";
import { canAttachLeadScreenshot } from "@/features/leads/can-attach-screenshot";
import { leadDocumentsKey } from "@/features/leads/lead-attachments";
import { formatSize } from "@/features/leads/lead-screenshot-field";
import { crmApi, type CrmDocument, type LeadBoardCard } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import {
  cardDocAcceptAttr,
  listCardDocs,
  validateCardDocFile,
  type LeadCardDocControlConfig,
} from "./card-doc-file";

export type { LeadCardDocControlConfig };

const TONE_FILLED = {
  success: "border-success/35 bg-success-soft/70 text-success hover:border-success/55",
  brand: "border-brand/35 bg-brand-soft/70 text-brand hover:border-brand/55",
} as const;

const TONE_READONLY = {
  success: "border-success/35 bg-success-soft/70 text-success",
  brand: "border-brand/35 bg-brand-soft/70 text-brand",
} as const;

/** Compact board-card file control: upload one or more PDF/JPG/PNG, then view or download each. */
export function LeadCardDocControl({
  lead,
  canEdit,
  config,
}: {
  lead: LeadBoardCard;
  canEdit: boolean;
  config: LeadCardDocControlConfig;
}) {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const canManage = canEdit && canAttachLeadScreenshot(can, user);
  const canDelete =
    can("documents:delete") || (canEdit && user?.roleCode === "sales_executive");
  const tone = config.tone ?? "success";

  const docsQuery = useQuery({
    queryKey: leadDocumentsKey(lead.id),
    queryFn: () => crmApi.listDocuments(new URLSearchParams({ leadId: lead.id, limit: "50", offset: "0" })),
  });

  const matched = listCardDocs(docsQuery.data?.data ?? [], config.match);
  const count = matched.length;
  const hasDocs = count > 0;
  const initialLoading = docsQuery.isLoading && !docsQuery.data;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: leadDocumentsKey(lead.id) }),
      qc.invalidateQueries({ queryKey: ["documents"] }),
      qc.invalidateQueries({ queryKey: ["timeline"] }),
      qc.invalidateQueries({ queryKey: ["lead", lead.id] }),
    ]);
  };

  const uploadFiles = async (picked: File[]) => {
    if (picked.length === 0) return;
    if (!canManage) {
      toast.error("Couldn't receive file", { description: "You don't have permission to upload here." });
      return;
    }

    const list = picked;
    for (const file of list) {
      const err = validateCardDocFile(file, config.label);
      if (err) {
        toast.error("Couldn't receive file", { description: `${file.name} — ${err}` });
        return;
      }
    }

    const toastId = toast.loading(
      list.length === 1 ? `Receiving ${list[0]!.name}…` : `Receiving ${list.length} files…`,
      { description: lead.fullName },
    );

    setBusy(true);
    let ok = 0;
    let lastError: string | null = null;
    const receivedNames: string[] = [];
    try {
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        body.append("name", file.name.trim() || config.label);
        body.append("type", config.type);
        body.append("category", config.category);
        body.append("leadId", lead.id);
        try {
          await crmApi.uploadDocument(body);
          ok += 1;
          receivedNames.push(file.name.trim() || config.label);
        } catch (e) {
          lastError = e instanceof Error && e.message ? e.message : `Couldn't upload ${file.name}`;
        }
      }
      await refresh();
      if (ok === list.length) {
        toast.success(ok === 1 ? `${config.label} received` : `${ok} files received`, {
          id: toastId,
          description:
            ok === 1
              ? `${receivedNames[0]} · ${lead.fullName}`
              : `${receivedNames.slice(0, 2).join(", ")}${ok > 2 ? ` +${ok - 2} more` : ""} · ${lead.fullName}`,
        });
      } else if (ok > 0) {
        toast.error(`${ok} of ${list.length} files received`, {
          id: toastId,
          description: lastError ?? "Some files could not be saved. Try again.",
        });
      } else {
        toast.error(`Couldn't receive ${config.label.toLowerCase()}`, {
          id: toastId,
          description: lastError ?? "The upload failed. Check the file and try again.",
        });
      }
    } catch (e) {
      toast.error(`Couldn't receive ${config.label.toLowerCase()}`, {
        id: toastId,
        description: e instanceof Error && e.message ? e.message : "Something went wrong. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (d: CrmDocument) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete “${d.name}”?`)) return;
    setDeletingId(d.id);
    const toastId = toast.loading(`Deleting ${d.name}…`);
    try {
      await crmApi.deleteDocument(d.id);
      if (viewing?.id === d.id) setViewing(null);
      await refresh();
      toast.success("File deleted", { id: toastId, description: d.name });
    } catch (err) {
      toast.error("Couldn't delete file", {
        id: toastId,
        description: err instanceof Error && err.message ? err.message : "Try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const chipLabel = !hasDocs
    ? initialLoading
      ? `Checking ${config.label.toLowerCase()}…`
      : config.addLabel
    : count === 1
      ? matched[0]!.name || config.label
      : `${config.label} · ${count}`;

  const chipTitle = !hasDocs
    ? `Attach ${config.label.toLowerCase()} files (PDF, JPG, or PNG)`
    : count === 1
      ? [matched[0]!.name, matched[0]!.sizeBytes ? formatSize(matched[0]!.sizeBytes) : null, "View, download, or add more"]
          .filter(Boolean)
          .join(" · ")
      : `${count} ${config.label.toLowerCase()} files — view, download, or add more`;

  const fileInput = canManage ? (
    <input
      id={inputId}
      ref={inputRef}
      type="file"
      multiple
      accept={cardDocAcceptAttr()}
      className="hidden"
      tabIndex={-1}
      onChange={(event) => {
        const picked = event.target.files ? Array.from(event.target.files) : [];
        event.target.value = "";
        void uploadFiles(picked);
      }}
    />
  ) : null;

  if (!canManage && !hasDocs) return null;

  if (!canManage && hasDocs) {
    return (
      <div
        className="mt-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {count === 1 ? (
          <button
            type="button"
            title={chipTitle}
            onClick={() => setViewing(matched[0]!)}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
              TONE_READONLY[tone],
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`View ${config.label.toLowerCase()}: ${matched[0]!.name}`}
          >
            <FileText className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{chipLabel}</span>
          </button>
        ) : (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={chipTitle}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
                  TONE_READONLY[tone],
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label={`${config.label}: ${count} files`}
              >
                <FileText className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{chipLabel}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>{config.label}</DropdownMenuLabel>
              {matched.map((d) => (
                <DocMenuRow
                  key={d.id}
                  doc={d}
                  deleting={deletingId === d.id}
                  canDelete={canDelete}
                  onView={() => {
                    setMenuOpen(false);
                    setViewing(d);
                  }}
                  onDelete={() => void removeDoc(d)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
      </div>
    );
  }

  return (
    <div
      className="mt-2"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {fileInput}

      {hasDocs ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              title={chipTitle}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
                TONE_FILLED[tone],
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-60",
              )}
              aria-label={`${config.label}: ${count} file${count === 1 ? "" : "s"}`}
            >
              {busy ? (
                <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileText className="size-3 shrink-0" aria-hidden />
              )}
              <span className="truncate">{busy ? "Uploading…" : chipLabel}</span>
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>{config.label}</DropdownMenuLabel>
            {matched.map((d) => (
              <DocMenuRow
                key={d.id}
                doc={d}
                deleting={deletingId === d.id}
                canDelete={canDelete}
                onView={() => {
                  setMenuOpen(false);
                  setViewing(d);
                }}
                onDelete={() => void removeDoc(d)}
              />
            ))}
            <DropdownMenuSeparator />
            {/* Native label keeps the file dialog in the same user gesture (dnd-safe). */}
            <DropdownMenuItem asChild disabled={busy} onSelect={(e) => e.preventDefault()}>
              <label htmlFor={inputId} className="cursor-pointer">
                <Plus className="size-3.5" aria-hidden />
                Add another…
              </label>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <label
          htmlFor={busy || initialLoading ? undefined : inputId}
          title={chipTitle}
          aria-label={config.addLabel}
          aria-disabled={busy || initialLoading}
          className={cn(
            "inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-left text-[0.6875rem] font-medium",
            "border-line text-ink-muted hover:border-line-strong hover:text-ink",
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
            (busy || initialLoading) && "pointer-events-none cursor-not-allowed opacity-60",
          )}
        >
          {busy || initialLoading ? (
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FilePlus2 className="size-3 shrink-0" aria-hidden />
          )}
          <span className="truncate">{busy ? "Uploading…" : chipLabel}</span>
        </label>
      )}

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function DocMenuRow({
  doc,
  deleting,
  canDelete,
  onView,
  onDelete,
}: {
  doc: CrmDocument;
  deleting?: boolean;
  canDelete?: boolean;
  onView: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5">
      <DropdownMenuItem className="min-w-0 flex-1" onSelect={onView} title={doc.name}>
        <Eye className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{doc.name}</span>
      </DropdownMenuItem>
      <a
        href={crmApi.downloadDocumentUrl(doc.id)}
        download={doc.name}
        aria-label={`Download ${doc.name}`}
        title="Download"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="size-3.5" aria-hidden />
      </a>
      {canDelete ? (
        <button
          type="button"
          aria-label={`Delete ${doc.name}`}
          title="Delete"
          disabled={deleting}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-danger/10 hover:text-danger disabled:opacity-60"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.();
          }}
        >
          {deleting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-3.5" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
