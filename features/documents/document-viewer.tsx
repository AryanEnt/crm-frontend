"use client";

import * as React from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { formatSize } from "@/features/leads/lead-screenshot-field";
import { crmApi, type CrmDocument } from "@/lib/api/crm";
import { formatRelative } from "@/lib/relative-time";
import { previewKind } from "./preview-kind";

/** Shows a document in the app: PDFs, images, text and media inline, a download prompt for the rest. */
export function DocumentViewer({ doc, onClose }: { doc: CrmDocument | null; onClose: () => void }) {
  const [now] = React.useState(() => Date.now());
  return (
    <Modal open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="max-w-4xl">
        {doc ? (
          <>
            <ModalHeader>
              <ModalTitle className="truncate pr-6">{doc.name}</ModalTitle>
              <ModalDescription>
                {[
                  doc.uploadedByName ? `Added by ${doc.uploadedByName}` : null,
                  formatRelative(doc.uploadedDate || doc.createdAt, now),
                  doc.sizeBytes ? formatSize(doc.sizeBytes) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </ModalDescription>
            </ModalHeader>
            <Preview key={doc.id} doc={doc} />
            <ModalFooter>
              {previewKind(doc) !== "none" ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={crmApi.viewDocumentUrl(doc.id)} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open in new tab
                  </a>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <a href={crmApi.downloadDocumentUrl(doc.id)} download={doc.name}>
                  <Download className="size-3.5" aria-hidden />
                  Download
                </a>
              </Button>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function Preview({ doc }: { doc: CrmDocument }) {
  const [failed, setFailed] = React.useState(false);
  const src = crmApi.viewDocumentUrl(doc.id);
  const kind = failed ? "none" : previewKind(doc);

  switch (kind) {
    case "image":
      return (
        <div className="flex max-h-[70vh] justify-center overflow-auto rounded-md bg-surface-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={doc.name} onError={() => setFailed(true)} className="h-auto max-w-full object-contain" />
        </div>
      );
    case "pdf":
    case "text":
      return (
        <iframe
          src={src}
          title={doc.name}
          className="h-[70vh] w-full rounded-md border border-border bg-surface"
        />
      );
    case "video":
      return (
        <video src={src} controls onError={() => setFailed(true)} className="max-h-[70vh] w-full rounded-md bg-surface-muted">
          <track kind="captions" />
        </video>
      );
    case "audio":
      return (
        <div className="rounded-md bg-surface-muted p-6">
          <audio src={src} controls onError={() => setFailed(true)} className="w-full" />
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-12 text-center">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
            <FileText className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">
            {failed ? "This file couldn't be shown here" : "No preview for this file type"}
          </p>
          <p className="max-w-sm text-[13px] text-foreground-muted">
            Download it to open it in the app it was made with.
          </p>
        </div>
      );
  }
}
