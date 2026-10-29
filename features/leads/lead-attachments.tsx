"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, ImageIcon, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-provider";
import { DocumentViewer } from "@/features/documents/document-viewer";
import { DocumentVisibilityPicker } from "@/features/documents/document-visibility-picker";
import { crmApi, type CrmDocument } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { MAX_SCREENSHOT_BYTES, formatSize, namedImage } from "./lead-screenshot-field";

const hasFile = (d: CrmDocument) => Boolean(d.fileKey);
const isImage = (d: CrmDocument) =>
  d.mimeType.startsWith("image/") ||
  d.type.toLowerCase() === "screenshot" ||
  d.category.toLowerCase() === "screenshot";

export const leadDocumentsKey = (leadId: string) => ["documents", "lead", leadId];

/** Screenshots and files attached to a lead, with an in-app viewer and quick screenshot upload. */
export function LeadAttachments({ leadId }: { leadId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = React.useState<CrmDocument | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [viewerUserIds, setViewerUserIds] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [now] = React.useState(() => Date.now());
  const canUpload = can("documents:create");

  const docsQuery = useQuery({
    queryKey: leadDocumentsKey(leadId),
    queryFn: () => crmApi.listDocuments(new URLSearchParams({ leadId, limit: "50", offset: "0" })),
  });

  const docs = (docsQuery.data?.data ?? []).filter(hasFile);
  const images = docs.filter(isImage);
  const files = docs.filter((d) => !isImage(d));

  const pickFile = (file: File | undefined) => {
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
    setPendingFile(namedImage(file));
    setViewerUserIds([]);
  };

  const upload = async () => {
    if (!pendingFile) return;
    const body = new FormData();
    body.append("file", pendingFile);
    body.append("name", pendingFile.name || "Screenshot");
    body.append("type", "screenshot");
    body.append("category", "screenshot");
    body.append("leadId", leadId);
    body.append("viewerUserIds", JSON.stringify(viewerUserIds));
    setUploading(true);
    try {
      await crmApi.uploadDocument(body);
      await qc.invalidateQueries({ queryKey: leadDocumentsKey(leadId) });
      setPendingFile(null);
      setViewerUserIds([]);
      toast.success("Screenshot added");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't upload the screenshot.");
    } finally {
      setUploading(false);
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
            <ul className="grid grid-cols-3 gap-2">
              {images.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(d)}
                    title={d.name}
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
            <ImagePlus className="size-3.5" />
            Add screenshot
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => pickFile(event.target.files?.[0])}
          />
        </>
      ) : null}

      <Modal open={Boolean(pendingFile)} onOpenChange={(open) => !open && !uploading && setPendingFile(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Add screenshot</ModalTitle>
          </ModalHeader>
          <div className="grid gap-3">
            <p className="truncate text-[13px] text-foreground-muted">{pendingFile?.name}</p>
            <div className="space-y-1.5">
              <Label>Visible to</Label>
              <DocumentVisibilityPicker value={viewerUserIds} onChange={setViewerUserIds} />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" disabled={uploading} onClick={() => setPendingFile(null)}>
              Cancel
            </Button>
            <Button loading={uploading} onClick={() => void upload()}>
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
