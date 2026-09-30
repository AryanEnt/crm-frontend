"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

export function useIsClient() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function Portal({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  return isClient ? createPortal(children, document.body) : null;
}

/* —— Layer stack: only the topmost open overlay reacts to Escape, outside clicks and Tab. —— */

const layerStack: symbol[] = [];

export function hasOpenLayer() {
  return layerStack.length > 0;
}

export function useLayer(active: boolean) {
  const [token] = React.useState(() => Symbol("layer"));
  React.useEffect(() => {
    if (!active) return;
    layerStack.push(token);
    return () => {
      const index = layerStack.lastIndexOf(token);
      if (index !== -1) layerStack.splice(index, 1);
    };
  }, [active, token]);
  return React.useCallback(() => layerStack[layerStack.length - 1] === token, [token]);
}

export type DismissReason = "escape" | "outside";

export function useDismiss({
  active,
  isTop,
  onDismiss,
  insideRefs,
  outsidePointer = true,
}: {
  active: boolean;
  isTop: () => boolean;
  onDismiss: (reason: DismissReason) => void;
  insideRefs: React.RefObject<HTMLElement | null>[];
  outsidePointer?: boolean;
}) {
  const dismiss = React.useEffectEvent(onDismiss);
  const isInside = React.useEffectEvent((target: Node) =>
    insideRefs.some((ref) => ref.current?.contains(target)),
  );

  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isTop()) return;
      event.preventDefault();
      dismiss("escape");
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!outsidePointer || !isTop()) return;
      if (event.target instanceof Node && isInside(event.target)) return;
      dismiss("outside");
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [active, isTop, outsidePointer]);
}

/* —— Focus trap —— */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableWithin(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true",
  );
}

/** Traps Tab inside the container while it is the top layer; restores focus on close. */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  {
    active,
    isTop,
    initialFocusRef,
  }: {
    active: boolean;
    isTop: () => boolean;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
  },
) {
  React.useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = initialFocusRef?.current ?? focusableWithin(container)[0] ?? container;
    initial.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTop()) return;
      const items = focusableWithin(container);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        container.focus();
        return;
      }
      const current = document.activeElement;
      const outside = !container.contains(current);
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreTo?.isConnected) restoreTo.focus({ preventScroll: true });
    };
  }, [active, containerRef, isTop, initialFocusRef]);
}

/* —— Scroll lock (ref-counted for stacked overlays) —— */

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (lockCount === 0) {
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      savedOverflow = body.style.overflow;
      savedPaddingRight = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPaddingRight;
      }
    };
  }, [active]);
}

/* —— Anchored positioning —— */

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

const VIEWPORT_MARGIN = 8;

function alignOnAxis(align: Align, start: number, end: number, size: number) {
  if (align === "start") return start;
  if (align === "end") return end - size;
  return start + (end - start) / 2 - size / 2;
}

function clamp(value: number, size: number, viewport: number) {
  return Math.min(Math.max(VIEWPORT_MARGIN, value), viewport - size - VIEWPORT_MARGIN);
}

/**
 * Positions a `fixed` floating element next to its anchor, flipping to the opposite side when
 * it would overflow. Writes styles directly to avoid a render per scroll/resize. The floating
 * element should start with `invisible fixed left-0 top-0`; it becomes visible once placed.
 */
export function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  floatingRef: React.RefObject<HTMLElement | null>,
  {
    open,
    side = "bottom",
    align = "start",
    offset = 6,
  }: { open: boolean; side?: Side; align?: Align; offset?: number },
) {
  React.useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;

    const update = () => {
      const a = anchor.getBoundingClientRect();
      const f = floating.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let resolved: Side = side;
      let top: number;
      let left: number;
      if (side === "top" || side === "bottom") {
        const fitsBelow = a.bottom + offset + f.height <= vh - VIEWPORT_MARGIN;
        const fitsAbove = a.top - offset - f.height >= VIEWPORT_MARGIN;
        if (side === "bottom" && !fitsBelow && fitsAbove) resolved = "top";
        if (side === "top" && !fitsAbove && fitsBelow) resolved = "bottom";
        top = resolved === "bottom" ? a.bottom + offset : a.top - offset - f.height;
        left = clamp(alignOnAxis(align, a.left, a.right, f.width), f.width, vw);
      } else {
        const fitsRight = a.right + offset + f.width <= vw - VIEWPORT_MARGIN;
        const fitsLeft = a.left - offset - f.width >= VIEWPORT_MARGIN;
        if (side === "right" && !fitsRight && fitsLeft) resolved = "left";
        if (side === "left" && !fitsLeft && fitsRight) resolved = "right";
        left = resolved === "right" ? a.right + offset : a.left - offset - f.width;
        top = clamp(alignOnAxis(align, a.top, a.bottom, f.height), f.height, vh);
      }

      floating.style.top = `${Math.round(top)}px`;
      floating.style.left = `${Math.round(left)}px`;
      floating.dataset.side = resolved;
      floating.style.visibility = "visible";
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    observer.observe(floating);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, side, align, offset, anchorRef, floatingRef]);
}

/* —— Presence: keep an element mounted through its exit transition —— */

export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = React.useState(open);
  if (open && !mounted) setMounted(true);

  React.useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs]);

  return { mounted, state: open ? ("open" as const) : ("closed" as const) };
}
