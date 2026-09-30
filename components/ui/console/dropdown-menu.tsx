"use client";

import * as React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal, useAnchoredPosition, useDismiss, useLayer, type Align, type Side } from "./overlay";
import { Slot } from "./slot";

type focusIntentRef = "first" | "last" | "content";

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  focusIntentRef: React.RefObject<focusIntentRef>;
  triggerId: string;
  contentId: string;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);
const MenuCloseContext = React.createContext<(restoreFocus: boolean) => void>(() => {});

function useMenu() {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error("DropdownMenu parts must be rendered inside <DropdownMenu>");
  return ctx;
}

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"])';

function menuItems(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

export function DropdownMenu({
  open: openProp,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const focusIntentRef = React.useRef<focusIntentRef>("content");
  const baseId = React.useId();

  const value = React.useMemo<MenuContextValue>(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      focusIntentRef,
      triggerId: `${baseId}-trigger`,
      contentId: `${baseId}-menu`,
    }),
    [open, setOpen, baseId],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

/** Wraps a single button element (e.g. <Button> or <IconButton>) and wires it as the menu trigger. */
export function DropdownMenuTrigger({ children }: { children: React.ReactElement }) {
  const { open, setOpen, triggerRef, focusIntentRef, triggerId, contentId } = useMenu();
  return (
    <Slot
      ref={triggerRef}
      id={triggerId}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      onClick={(event: React.MouseEvent) => {
        if (event.defaultPrevented) return;
        focusIntentRef.current = event.detail === 0 ? "first" : "content";
        setOpen(!open);
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        focusIntentRef.current = event.key === "ArrowDown" ? "first" : "last";
        setOpen(true);
      }}
    >
      {children}
    </Slot>
  );
}

export function DropdownMenuContent({
  side = "bottom",
  align = "start",
  className,
  "aria-label": ariaLabel,
  children,
}: {
  side?: Side;
  align?: Align;
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, triggerRef, contentRef, focusIntentRef, triggerId, contentId } = useMenu();
  const isTop = useLayer(open);

  const close = React.useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [setOpen, triggerRef],
  );

  useAnchoredPosition(triggerRef, contentRef, { open, side, align, offset: 4 });
  useDismiss({
    active: open,
    isTop,
    insideRefs: [contentRef, triggerRef],
    onDismiss: (reason) => close(reason === "escape"),
  });

  React.useLayoutEffect(() => {
    if (!open) return;
    const menu = contentRef.current;
    if (!menu) return;
    const items = menuItems(menu);
    const intent = focusIntentRef.current;
    const target = intent === "first" ? items[0] : intent === "last" ? items[items.length - 1] : undefined;
    (target ?? menu).focus({ preventScroll: true });
  }, [open, contentRef, focusIntentRef]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(event.currentTarget);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index === -1 ? items.length - 1 : index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Tab":
        event.preventDefault();
        close(true);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const key = event.key.toLowerCase();
          const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
          ordered.find((item) => item.textContent?.trim().toLowerCase().startsWith(key))?.focus();
        }
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={contentRef}
        id={contentId}
        role="menu"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : triggerId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "invisible fixed left-0 top-0 z-[70] min-w-44 origin-top rounded-control border border-line bg-surface-raised p-1 text-cell text-ink shadow-md outline-none",
          "transition-[opacity,scale] duration-150 ease-standard starting:scale-[0.97] starting:opacity-0 data-[side=top]:origin-bottom",
          className,
        )}
      >
        <MenuCloseContext.Provider value={close}>{children}</MenuCloseContext.Provider>
      </div>
    </Portal>
  );
}

const ITEM_BASE =
  "flex h-8 w-full select-none items-center gap-2 rounded-md px-2 text-left text-cell outline-none transition-colors duration-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

function focusOnHover(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  if (el.getAttribute("aria-disabled") !== "true" && document.activeElement !== el) {
    el.focus({ preventScroll: true });
  }
}

function blurToMenu(event: React.PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  if (document.activeElement === el) el.closest<HTMLElement>('[role="menu"]')?.focus({ preventScroll: true });
}

export function DropdownMenuItem({
  icon: Icon,
  tone = "default",
  disabled = false,
  shortcut,
  onSelect,
  className,
  children,
}: {
  icon?: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  shortcut?: string;
  /** Call `event.preventDefault()` to keep the menu open. */
  onSelect?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const close = React.useContext(MenuCloseContext);
  const danger = tone === "danger";
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onPointerMove={focusOnHover}
      onPointerLeave={blurToMenu}
      onClick={(event) => {
        if (disabled) return;
        onSelect?.(event);
        if (!event.defaultPrevented) close(true);
      }}
      className={cn(
        ITEM_BASE,
        danger ? "text-danger focus:bg-danger-soft" : "text-ink focus:bg-surface-muted",
        className,
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={cn("size-4 shrink-0", danger ? "text-danger" : "text-ink-muted")} />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut ? <span className="text-caption text-ink-muted">{shortcut}</span> : null}
    </button>
  );
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  disabled = false,
  closeOnSelect = false,
  className,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  closeOnSelect?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const close = React.useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onPointerMove={focusOnHover}
      onPointerLeave={blurToMenu}
      onClick={() => {
        if (disabled) return;
        onCheckedChange(!checked);
        if (closeOnSelect) close(true);
      }}
      className={cn(ITEM_BASE, "text-ink focus:bg-surface-muted", className)}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-100",
          checked ? "border-brand bg-brand text-primary-foreground" : "border-line-strong bg-surface",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** Single choice within a group; selecting closes the menu. */
export function DropdownMenuRadioItem({
  icon: Icon,
  checked,
  onSelect,
  className,
  children,
}: {
  icon?: LucideIcon;
  checked: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const close = React.useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      onPointerMove={focusOnHover}
      onPointerLeave={blurToMenu}
      onClick={() => {
        onSelect();
        close(true);
      }}
      className={cn(ITEM_BASE, "text-ink focus:bg-surface-muted", className)}
    >
      {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {checked ? <Check aria-hidden className="size-4 shrink-0 text-brand" /> : null}
    </button>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div role="presentation" className="px-2 pb-1 pt-1.5 text-overline text-ink-muted">
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-line" />;
}
