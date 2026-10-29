"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, ImageIcon, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { DocumentViewer } from "@/features/documents/document-viewer";
import { canAttachLeadScreenshot } from "@/features/leads/can-attach-screenshot";
import { crmApi, type CrmDocument } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { MAX_SCREENSHOT_BYTES, formatSize, namedImage } from "./lead-screenshot-field";

const hasFile = (d: CrmDocument) => Boolean(d.fileKey);
const isImage = (d: CrmDocument) =>
  d.mimeType.startsWith("image/") ||
  d.type.toLowerCase() === "screenshot" ||
  d.category.toLowerCase() === "screenshot";
const isScreenshot = (d: CrmDocument) =>
  d.type.toLowerCase() === "screenshot" || d.category.toLowerCase() === "screenshot";

export const leadDocumentsKey = (leadId: string) => ["documents", "lead", leadId];

/** Screenshots and files attached to a lead, with an in-app viewer and quick screenshot upload. */
export function LeadAttachments({ leadId }: { leadId: string }) {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [now] = React.useState(() => Date.now());
  const canUpload = canAttachLeadScreenshot(can, user);
  const canDeleteDoc = (d: CrmDocument) =>
    can("documents:delete") || (user?.roleCode === "sales_executive" && isScreenshot(d));

  const docsQuery = useQuery({
    queryKey: leadDocumentsKey(leadId),
    queryFn: () => crmApi.listDocuments(new URLSearchParams({ leadId, limit: "50", offset: "0" })),
  });

  const docs = (docsQuery.data?.data ?? []).filter(hasFile);
  const images = docs.filter(isImage);
  const files = docs.filter((d) => !isImage(d));

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: leadDocumentsKey(leadId) }),
      qc.invalidateQueries({ queryKey: ["documents"] }),
      qc.invalidateQueries({ queryKey: ["timeline"] }),
    ]);
  };

  const upload = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image, such as a PNG or JPG screenshot.");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error("That image is over 10 MB. Use a smaller screenshot.");
      return;
    }
    const named = namedImage(file);
    const body = new FormData();
    body.append("file", named);
    body.append("name", named.name || "Screenshot");
    body.append("type", "screenshot");
    body.append("category", "screenshot");
    body.append("leadId", leadId);
    setUploading(true);
    try {
      await crmApi.uploadDocument(body);
      await refresh();
      toast.success("Screenshot added");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't upload the screenshot.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (d: CrmDocument) => {
    if (!window.confirm(`Delete “${d.name}”?`)) return;
    setDeletingId(d.id);
    try {
      await crmApi.deleteDocument(d.id);
      if (viewing?.id === d.id) setViewing(null);
      await refresh();
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't delete.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {docsQuery.isLoading ? (
        <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-label="Loading attachments">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-md" />
          ))}
        </div>
      ) : docsQuery.isError ? (
        <p className="text-caption text-danger">
          Couldn&apos;t load attachments.{" "}
          <button type="button" className="font-medium underline" onClick={() => void docsQuery.refetch()}>
            Try again
          </button>
        </p>
      ) : docs.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-muted">
            <ImageIcon className="size-4" aria-hidden />
          </span>
          <p className="text-[13px] text-foreground-muted">No screenshots or files on this lead yet.</p>
        </div>
      ) : (
        <>
          {images.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[12px] text-foreground-subtle">
                <span className="font-semibold text-foreground">*</span> Screenshot
              </p>
              <ul className="grid grid-cols-3 gap-2">
                {images.map((d) => (
                  <li key={d.id} className="relative">
                    {canDeleteDoc(d) ? (
                      <button
                        type="button"
                        aria-label={`Delete ${d.name}`}
                        disabled={deletingId === d.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void remove(d);
                        }}
                        className="absolute right-1 top-1 z-10 inline-flex size-6 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      >
                        {deletingId === d.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <X className="size-3.5" aria-hidden />
                        )}
                      </button>
                    ) : (
                      <span
                        className="pointer-events-none absolute right-1 top-1 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[12px] font-semibold leading-none text-white"
                        aria-label="Screenshot"
                      >
                        *
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewing(d)}
                      title={`${d.name} (screenshot)`}
                      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={crmApi.viewDocumentUrl(d.id)}
                        alt={d.name}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-medium text-white">
                        {formatRelative(d.uploadedDate || d.createdAt, now)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {files.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {files.map((d) => (
                <li key={d.id} className="flex items-center gap-1 px-1.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => setViewing(d)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText className="size-4 shrink-0 text-foreground-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{d.name}</span>
                      <span className="block text-[12px] text-foreground-subtle">
                        {[d.sizeBytes ? formatSize(d.sizeBytes) : null, d.uploadedByName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                  <a
                    href={crmApi.downloadDocumentUrl(d.id)}
                    download={d.name}
                    aria-label={`Download ${d.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                  {canDeleteDoc(d) ? (
                    <button
                      type="button"
                      aria-label={`Delete ${d.name}`}
                      disabled={deletingId === d.id}
                      onClick={() => void remove(d)}
                      className="inline-flex size-8 items-center justify-center rounded-md text-foreground-muted hover:bg-danger/10 hover:text-danger"
                    >
                      {deletingId === d.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <X className="size-4" aria-hidden />
                      )}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {canUpload ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {uploading ? "Uploading…" : "Add screenshot"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </>
      ) : null}

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
