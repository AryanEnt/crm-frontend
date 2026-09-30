"use client";

import * as React from "react";
import { Portal, useAnchoredPosition, type Align, type Side } from "./overlay";
import { Slot } from "./slot";

function isTruncated(el: HTMLElement) {
  return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
}

export type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: Side;
  align?: Align;
  delay?: number;
  /** Only show when the anchor's text is visually clipped (for truncated names/emails). */
  onlyWhenTruncated?: boolean;
  disabled?: boolean;
};

/**
 * Hover (mouse) or keyboard focus shows the tooltip; Escape dismisses it, and the pointer can
 * move onto it without it closing (WCAG 1.4.13).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = 350,
  onlyWhenTruncated = false,
  disabled = false,
}: TooltipProps) {
  const id = React.useId();
  const anchorRef = React.useRef<HTMLElement>(null);
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const showTimer = React.useRef<number | undefined>(undefined);
  const hideTimer = React.useRef<number | undefined>(undefined);
  const [open, setOpen] = React.useState(false);

  useAnchoredPosition(anchorRef, floatingRef, { open, side, align, offset: 6 });

  const clearTimers = () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  };

  const show = (immediate: boolean) => {
    if (disabled) return;
    const anchor = anchorRef.current;
    if (onlyWhenTruncated && anchor && !isTruncated(anchor)) return;
    clearTimers();
    if (immediate) setOpen(true);
    else showTimer.current = window.setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    clearTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    const timers = { show: showTimer, hide: hideTimer };
    return () => {
      window.clearTimeout(timers.show.current);
      window.clearTimeout(timers.hide.current);
    };
  }, []);

  const childDescribedBy = (children.props as { "aria-describedby"?: string })["aria-describedby"];
  const describedBy = [childDescribedBy, open ? id : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <Slot
        ref={anchorRef}
        aria-describedby={describedBy}
        onPointerEnter={(event: React.PointerEvent) => {
          if (event.pointerType === "mouse") show(false);
        }}
        onPointerLeave={hide}
        onFocus={(event: React.FocusEvent<HTMLElement>) => {
          if (event.currentTarget.matches(":focus-visible")) show(true);
        }}
        onBlur={hide}
      >
        {children}
      </Slot>
      {open ? (
        <Portal>
          <div
            ref={floatingRef}
            id={id}
            role="tooltip"
            onPointerEnter={clearTimers}
            onPointerLeave={hide}
            className="invisible fixed left-0 top-0 z-[80] max-w-xs break-words rounded-md bg-ink px-2 py-1 text-caption font-medium text-surface shadow-md transition-opacity duration-150 ease-standard starting:opacity-0"
          >
            {content}
          </div>
        </Portal>
      ) : null}
    </>
  );
}
