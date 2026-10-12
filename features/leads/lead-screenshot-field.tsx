"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function namedImage(file: File): File {
  if (file.name.trim()) return file;
  const ext = (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  return new File([file], `screenshot.${ext}`, { type: file.type });
}

export function imageFromList(list: DataTransferItemList | FileList | null | undefined): File | null {
  if (!list || list.length === 0) return null;
  if (list instanceof FileList) {
    return Array.from(list).find((file) => file.type.startsWith("image/")) ?? null;
  }
  for (const item of Array.from(list)) {
    if (item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

export function LeadScreenshotField({
  file,
  onChange,
  formId,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  formId: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const onChangeRef = React.useRef(onChange);
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const take = React.useCallback((next: File | null) => {
    if (!next) {
      setError(null);
      onChangeRef.current(null);
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("Choose an image, such as a PNG or JPG screenshot.");
      return;
    }
    if (next.size > MAX_SCREENSHOT_BYTES) {
      setError("That image is over 10 MB. Use a smaller screenshot.");
      return;
    }
    setError(null);
    onChangeRef.current(namedImage(next));
  }, []);

  React.useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const onPaste = (event: Event) => {
      const pasted = imageFromList((event as ClipboardEvent).clipboardData?.items);
      if (!pasted) return;
      event.preventDefault();
      take(pasted);
    };
    form.addEventListener("paste", onPaste);
    return () => form.removeEventListener("paste", onPaste);
  }, [formId, take]);

  const clear = () => {
    take(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="size-12 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
            <p className="text-[12px] text-foreground-subtle">{formatSize(file.size)} · attached when you create the lead</p>
          </div>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Remove screenshot"
            onClick={clear}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const dropped = imageFromList(event.dataTransfer.files);
            if (!dropped && event.dataTransfer.files.length > 0) {
              setError("Choose an image, such as a PNG or JPG screenshot.");
              return;
            }
            take(dropped);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-md border border-dashed px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragOver
              ? "border-brand bg-brand-soft"
              : "border-border bg-surface hover:border-brand hover:bg-surface-muted",
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground-muted">
            <ImagePlus className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-foreground">Add a screenshot</span>
            <span className="block text-[12px] text-foreground-subtle">Drop it here, paste, or browse</span>
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => take(event.target.files?.[0] ?? null)}
      />

      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-[12px] leading-snug text-foreground-subtle">
          A WhatsApp, email, or form screenshot. Skip this if you don&apos;t have one.
        </p>
      )}
    </div>
  );
}
