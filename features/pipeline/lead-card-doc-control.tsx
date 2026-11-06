"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, Eye, FileText, Loader2, Replace } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  pickLatestCardDoc,
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

/** Compact board-card file control: upload, view, download, or replace (PDF/JPG/PNG). */
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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [busy, setBusy] = React.useState<"upload" | "replace" | null>(null);
  const canManage = canEdit && canAttachLeadScreenshot(can, user);
  const tone = config.tone ?? "success";

  const docsQuery = useQuery({
    queryKey: leadDocumentsKey(lead.id),
    queryFn: () => crmApi.listDocuments(new URLSearchParams({ leadId: lead.id, limit: "50", offset: "0" })),
  });

  const doc = pickLatestCardDoc(docsQuery.data?.data ?? [], config.match);
  const hasDoc = Boolean(doc);
  const loading = docsQuery.isLoading || docsQuery.isFetching;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: leadDocumentsKey(lead.id) }),
      qc.invalidateQueries({ queryKey: ["documents"] }),
      qc.invalidateQueries({ queryKey: ["timeline"] }),
      qc.invalidateQueries({ queryKey: ["lead", lead.id] }),
    ]);
  };

  const upload = async (file: File | undefined, replace: boolean) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file || !canManage) return;
    const err = validateCardDocFile(file, config.label);
    if (err) {
      toast.error(err);
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("name", file.name.trim() || config.label);
    body.append("type", config.type);
    body.append("category", config.category);
    body.append("leadId", lead.id);

    setBusy(replace ? "replace" : "upload");
    try {
      if (replace && doc) {
        await crmApi.uploadDocument(body, doc.id);
        toast.success(`${config.label} replaced`);
      } else {
        await crmApi.uploadDocument(body);
        toast.success(`${config.label} added`);
      }
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : `Couldn't upload the ${config.label.toLowerCase()}.`,
      );
    } finally {
      setBusy(null);
    }
  };

  const openPicker = (mode: "upload" | "replace") => {
    if (!canManage || busy) return;
    inputRef.current?.setAttribute("data-mode", mode);
    inputRef.current?.click();
  };

  const chipLabel = hasDoc
    ? doc!.name || config.label
    : loading
      ? `Checking ${config.label.toLowerCase()}…`
      : config.addLabel;

  const chipTitle = hasDoc
    ? [doc!.name, doc!.sizeBytes ? formatSize(doc!.sizeBytes) : null, "View, download, or replace"]
        .filter(Boolean)
        .join(" · ")
    : `Attach the ${config.label.toLowerCase()} (PDF, JPG, or PNG)`;

  if (!canManage && !hasDoc) return null;

  if (!canManage && hasDoc) {
    return (
      <div
        className="mt-2"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title={chipTitle}
          onClick={() => setViewing(doc)}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium",
            TONE_READONLY[tone],
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label={`View ${config.label.toLowerCase()}: ${doc!.name}`}
        >
          <FileText className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{chipLabel}</span>
        </button>
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
      {hasDoc ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={Boolean(busy)}
              title={chipTitle}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[0.6875rem] font-medium",
                TONE_FILLED[tone],
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-60",
              )}
              aria-label={`${config.label}: ${doc!.name}`}
            >
              {busy ? (
                <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
              ) : (
                <FileText className="size-3 shrink-0" aria-hidden />
              )}
              <span className="truncate">{busy === "replace" ? "Replacing…" : chipLabel}</span>
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem
              onSelect={() => {
                setMenuOpen(false);
                setViewing(doc);
              }}
            >
              <Eye className="size-3.5" aria-hidden />
              View
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={crmApi.downloadDocumentUrl(doc!.id)} download={doc!.name}>
                <Download className="size-3.5" aria-hidden />
                Download
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={Boolean(busy)}
              onSelect={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                openPicker("replace");
              }}
            >
              <Replace className="size-3.5" aria-hidden />
              Replace…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          type="button"
          disabled={Boolean(busy) || loading}
          title={chipTitle}
          onClick={() => openPicker("upload")}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-left text-[0.6875rem] font-medium",
            "border-line text-ink-muted hover:border-line-strong hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-60",
          )}
          aria-label={config.addLabel}
        >
          {busy === "upload" || loading ? (
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileText className="size-3 shrink-0" aria-hidden />
          )}
          <span className="truncate">{busy === "upload" ? "Uploading…" : chipLabel}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={cardDocAcceptAttr()}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const mode = inputRef.current?.getAttribute("data-mode") === "replace" ? "replace" : "upload";
          void upload(event.target.files?.[0], mode === "replace");
        }}
      />

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
