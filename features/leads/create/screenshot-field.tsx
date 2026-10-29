"use client";

import * as React from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crmApi, type LeadImageExtract } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { MAX_SCREENSHOT_BYTES, formatSize, imageFromList, namedImage } from "@/features/leads/lead-screenshot-field";

const NOT_AN_IMAGE = "Choose an image, such as a PNG or JPG screenshot.";
const TOO_BIG = "That image is over 10 MB. Use a smaller screenshot.";

type Found = { fullName?: string; phone?: string; email?: string };

function cleanExtract(x: LeadImageExtract): Found {
  const found: Found = {};
  if (x.fullName?.trim()) found.fullName = x.fullName.trim();
  if (x.phone?.trim()) found.phone = x.phone.trim();
  if (x.email?.trim()) found.email = x.email.trim();
  return found;
}

export function ScreenshotField({
  file,
  onChange,
  pasteTarget,
  onPasted,
  extractEnabled,
  onApplyExtract,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Ctrl/Cmd+V with an image anywhere inside this element attaches it. */
  pasteTarget: React.RefObject<HTMLElement | null>;
  onPasted?: () => void;
  extractEnabled: boolean;
  onApplyExtract: (found: Found) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [found, setFound] = React.useState<Found | null>(null);
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const take = (next: File | null) => {
    setFound(null);
    if (!next) {
      setError(null);
      onChange(null);
      return;
    }
    if (!next.type.startsWith("image/")) return setError(NOT_AN_IMAGE);
    if (next.size > MAX_SCREENSHOT_BYTES) return setError(TOO_BIG);
    setError(null);
    onChange(namedImage(next));
  };
  const onPastedImage = React.useEffectEvent((image: File) => {
    take(image);
    onPasted?.();
  });

  React.useEffect(() => {
    const target = pasteTarget.current;
    if (!target) return;
    const onPaste = (event: ClipboardEvent) => {
      const image = imageFromList(event.clipboardData?.items);
      if (!image) return;
      event.preventDefault();
      onPastedImage(image);
    };
    target.addEventListener("paste", onPaste);
    return () => target.removeEventListener("paste", onPaste);
  }, [pasteTarget]);

  const remove = () => {
    take(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const extract = async () => {
    if (!file) return;
    setExtracting(true);
    setError(null);
    try {
      const result = cleanExtract(await crmApi.extractLeadFromImage(file));
      if (Object.keys(result).length === 0) setError("Couldn't find a name, phone or email in this screenshot.");
      else setFound(result);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't read the screenshot.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="flex items-baseline justify-between gap-2 text-cell font-semibold text-ink">
        Screenshot
        <span className="text-caption font-normal text-ink-muted">Optional</span>
      </span>
      {file && preview ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={preview} alt="Screenshot preview" className="size-14 shrink-0 rounded-control object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-cell font-medium text-ink">{file.name}</p>
            <p className="text-caption text-ink-muted">{formatSize(file.size)} · attached when you create the lead</p>
          </div>
          <button
            type="button"
            aria-label="Remove screenshot"
            onClick={remove}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby={`${id}-label ${id}-hint`}
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
            const dropped = imageFromList(e.dataTransfer.files);
            if (!dropped && e.dataTransfer.files.length > 0) return setError(NOT_AN_IMAGE);
            take(dropped);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-3.5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20",
            dragOver ? "border-brand bg-brand-soft" : "border-brand-border bg-brand-soft/40 hover:border-brand hover:bg-brand-soft/70",
          )}
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <ImagePlus aria-hidden className="size-4" />
          </span>
          <span id={`${id}-hint`} className="min-w-0 text-cell text-ink-secondary">
            Paste, drop or <span className="font-medium text-brand-ink underline-offset-2 hover:underline">browse</span>
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
        onChange={(e) => take(e.target.files?.[0] ?? null)}
      />

      {file && extractEnabled && !found ? (
        <Button type="button" variant="outline" size="sm" className="self-start rounded-full" onClick={() => void extract()} disabled={extracting}>
          {extracting ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
          {extracting ? "Reading screenshot…" : "Fill details from screenshot"}
        </Button>
      ) : null}

      {found ? (
        <div role="status" className="rounded-card border border-brand-border bg-brand-soft px-3 py-2.5 text-cell text-ink">
          <p className="font-medium">Found in the screenshot</p>
          <ul className="mt-1 space-y-0.5 text-ink-secondary">
            {found.fullName ? <li>Name: {found.fullName}</li> : null}
            {found.phone ? <li>Phone: {found.phone}</li> : null}
            {found.email ? <li>Email: {found.email}</li> : null}
          </ul>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => {
                onApplyExtract(found);
                setFound(null);
              }}
            >
              Use these details
            </Button>
            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setFound(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
