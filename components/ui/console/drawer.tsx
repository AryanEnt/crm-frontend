"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { Portal, useDismiss, useFocusTrap, useLayer, usePresence, useScrollLock } from "./overlay";

export type DrawerProps = {
  open: boolean;
  /**
   * Called for Escape, overlay click and the close button. The parent decides whether to
   * actually close (e.g. to confirm discarding unsaved changes).
   */
  onRequestClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sticky footer, typically Cancel / Save. */
  footer?: React.ReactNode;
  /** When set, body + footer are wrapped in a <form> so Enter submits. */
  formProps?: React.ComponentProps<"form">;
  width?: number;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
};

export function Drawer({
  open,
  onRequestClose,
  title,
  description,
  footer,
  formProps,
  width = 480,
  initialFocusRef,
  children,
}: DrawerProps) {
  const { mounted, state } = usePresence(open, 200);
  const isTop = useLayer(open);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useFocusTrap(panelRef, { active: open, isTop, initialFocusRef });
  useScrollLock(open);
  useDismiss({
    active: open,
    isTop,
    outsidePointer: false,
    insideRefs: [panelRef],
    onDismiss: onRequestClose,
  });

  if (!mounted) return null;

  const content = (
    <>
      <div className="crm-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-raised px-6 py-3">
          {footer}
        </div>
      ) : null}
    </>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div
          aria-hidden
          data-state={state}
          onPointerDown={() => {
            if (isTop()) onRequestClose();
          }}
          className="absolute inset-0 bg-overlay transition-opacity duration-200 ease-standard starting:opacity-0 data-[state=closed]:opacity-0"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          data-state={state}
          style={{ width: `min(${width}px, 100vw)` }}
          className="absolute inset-y-0 right-0 flex flex-col border-l border-line bg-surface-raised shadow-md outline-none transition-[translate] duration-200 ease-standard starting:translate-x-full data-[state=closed]:translate-x-full"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-heading font-semibold text-ink">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-0.5 text-caption text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton label="Close" size="sm" className="-mr-2 -mt-1" onClick={onRequestClose}>
              <X />
            </IconButton>
          </header>
          {formProps ? (
            <form {...formProps} className={cn("flex min-h-0 flex-1 flex-col", formProps.className)}>
              {content}
            </form>
          ) : (
            content
          )}
        </div>
      </div>
    </Portal>
  );
}

export function DrawerSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-4">
        <h3 className="text-heading text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-caption text-ink-muted">{description}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
