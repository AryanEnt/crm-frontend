"use client";

import { cn } from "@/lib/utils";
import { useSmartFormOptional } from "./smart-form";

export function DraftIndicator({ className }: { className?: string }) {
  const ctx = useSmartFormOptional();
  if (!ctx?.lastDraftSavedAt && !ctx?.isDirtyDraft) return null;

  const label = ctx.lastDraftSavedAt
    ? `Draft saved ${formatRelative(ctx.lastDraftSavedAt)}`
    : "Unsaved changes";

  return (
    <p
      className={cn("text-[11px] text-foreground-subtle", className)}
      aria-live="polite"
    >
      {label}
    </p>
  );
}

export function AutoSaveIndicator({ className }: { className?: string }) {
  return <DraftIndicator className={className} />;
}

function formatRelative(ts: number) {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return `${Math.floor(seconds / 3600)} hr ago`;
}
