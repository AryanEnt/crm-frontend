"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FormActions({
  children,
  className,
  sticky = false,
}: {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface",
        sticky && "sticky bottom-0 z-10 px-4 py-3 shadow-[0_-4px_12px_rgba(42,40,56,0.04)]",
        !sticky && "pt-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormActionsBar({
  onCancel,
  submitLabel,
  loading,
  secondarySubmitLabel,
  onSecondarySubmit,
  cancelLabel = "Cancel",
  disabled,
  className,
  sticky,
}: {
  onCancel?: () => void;
  submitLabel: string;
  loading?: boolean;
  secondarySubmitLabel?: string;
  onSecondarySubmit?: () => void;
  cancelLabel?: string;
  disabled?: boolean;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <FormActions sticky={sticky} className={className}>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      ) : null}
      {secondarySubmitLabel && onSecondarySubmit ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onSecondarySubmit}
          disabled={loading || disabled}
          loading={loading}
        >
          {secondarySubmitLabel}
        </Button>
      ) : null}
      <Button type="submit" disabled={disabled} loading={loading}>
        {submitLabel}
      </Button>
    </FormActions>
  );
}
