"use client";

import * as React from "react";
import { TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Portal, useDismiss, useFocusTrap, useLayer, usePresence, useScrollLock } from "./overlay";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger";
  role?: "dialog" | "alertdialog";
  size?: "sm" | "md";
  /** When false, Escape and overlay clicks are ignored (e.g. while saving). */
  dismissible?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  tone = "default",
  role = "dialog",
  size = "sm",
  dismissible = true,
  initialFocusRef,
  footer,
  children,
}: DialogProps) {
  const { mounted, state } = usePresence(open, 150);
  const isTop = useLayer(open);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useFocusTrap(panelRef, { active: open, isTop, initialFocusRef });
  useScrollLock(open);
  useDismiss({
    active: open && dismissible,
    isTop,
    outsidePointer: false,
    insideRefs: [panelRef],
    onDismiss: () => onOpenChange(false),
  });

  if (!mounted) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          aria-hidden
          data-state={state}
          onPointerDown={() => {
            if (dismissible && isTop()) onOpenChange(false);
          }}
          className="absolute inset-0 bg-overlay transition-opacity duration-150 ease-standard starting:opacity-0 data-[state=closed]:opacity-0"
        />
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          data-state={state}
          className={cn(
            "relative w-full overflow-hidden rounded-card border border-line bg-surface-raised shadow-md outline-none",
            "transition-[opacity,scale] duration-150 ease-standard starting:scale-[0.97] starting:opacity-0 data-[state=closed]:scale-[0.97] data-[state=closed]:opacity-0",
            size === "sm" ? "max-w-md" : "max-w-lg",
          )}
        >
          <div className="flex gap-3 px-5 pt-5">
            {Icon ? (
              <span
                aria-hidden
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink-muted",
                )}
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-body font-semibold text-ink">
                {title}
              </h2>
              {description ? (
                <div id={descriptionId} className="mt-1.5 text-body text-ink-muted">
                  {description}
                </div>
              ) : null}
              {children ? <div className="mt-4">{children}</div> : null}
            </div>
          </div>
          {footer ? (
            <div className="mt-5 flex justify-end gap-2 border-t border-line bg-surface-sunken px-5 py-3">
              {footer}
            </div>
          ) : (
            <div className="h-5" />
          )}
        </div>
      </div>
    </Portal>
  );
}

export type ConfirmDialogProps = Omit<DialogProps, "footer" | "role" | "initialFocusRef" | "dismissible"> & {
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
};

/** Focus starts on Cancel so a stray Enter never confirms a destructive action. */
export function ConfirmDialog({
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onOpenChange,
  tone = "default",
  icon,
  ...props
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      {...props}
      role="alertdialog"
      tone={tone}
      icon={icon ?? (tone === "danger" ? TriangleAlert : undefined)}
      dismissible={!loading}
      initialFocusRef={cancelRef}
      onOpenChange={(next) => {
        if (!loading) onOpenChange(next);
      }}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
