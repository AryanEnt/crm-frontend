"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, IconButton } from "./button";
import { usePresence } from "./overlay";

/* —— Layout —— */

/** Bordered card whose inner area scrolls, so the sticky header stays pinned. */
export function TableCard({
  className,
  scrollClassName,
  footer,
  children,
}: {
  className?: string;
  scrollClassName?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    >
      <div className={cn("crm-scroll min-h-0 flex-1 overflow-auto", scrollClassName)}>{children}</div>
      {footer}
    </div>
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table className={cn("w-full border-separate border-spacing-0 text-cell text-ink", className)} {...props} />
  );
}

export type SortDirection = "asc" | "desc";

export function TableHead({
  sortable = false,
  sorted = false,
  onSort,
  align = "left",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & {
  sortable?: boolean;
  /** Current sort direction for this column, or false when not the active sort. */
  sorted?: SortDirection | false;
  onSort?: () => void;
  align?: "left" | "right";
}) {
  const base = cn(
    "sticky top-0 z-10 h-9 whitespace-nowrap border-b border-line bg-surface px-3 text-overline text-ink-muted first:pl-4 last:pr-4",
    align === "right" ? "text-right" : "text-left",
    className,
  );

  if (!sortable) {
    return (
      <th scope="col" className={base} {...props}>
        {children}
      </th>
    );
  }

  const Arrow = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
      className={base}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors duration-150 hover:text-ink",
          sorted && "text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <Arrow
          aria-hidden
          className={cn(
            "size-3 transition-opacity duration-150",
            sorted ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
          )}
        />
      </button>
    </th>
  );
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menuitem"], [role="checkbox"], [data-row-ignore]';

export function TableRow({
  selected = false,
  onActivate,
  className,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"tr"> & {
  selected?: boolean;
  /** Row click / Enter. Clicks on interactive children (checkbox, menus, links) are ignored. */
  onActivate?: () => void;
}) {
  const clickable = Boolean(onActivate);
  return (
    <tr
      data-selected={selected || undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!onActivate || event.defaultPrevented) return;
        const target = event.target;
        if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
        if (target.closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        onActivate();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.target !== event.currentTarget) return;
        if (event.key === "Enter" && onActivate) {
          event.preventDefault();
          onActivate();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const sibling =
            event.key === "ArrowDown"
              ? event.currentTarget.nextElementSibling
              : event.currentTarget.previousElementSibling;
          if (sibling instanceof HTMLElement && sibling.tabIndex >= 0) {
            event.preventDefault();
            sibling.focus();
          }
        }
      }}
      className={cn(
        "group/row outline-none transition-colors duration-100 [&>td]:border-b [&>td]:border-line last:[&>td]:border-b-0",
        "hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:shadow-[inset_2px_0_0_0_var(--brand)]",
        selected && "bg-brand-soft/60 hover:bg-brand-soft",
        clickable && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  align = "left",
  className,
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & { align?: "left" | "right" }) {
  return (
    <td
      className={cn(
        "h-(--table-row-height) px-3 align-middle first:pl-4 last:pr-4",
        align === "right" && "text-right",
        className,
      )}
      {...props}
    />
  );
}

/* —— Pagination —— */

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50],
  itemLabel,
}: {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  /** e.g. "users" -> "Showing 1–4 of 4 users". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const sizeId = React.useId();

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2 text-caption text-ink-muted">
      <p aria-live="polite">
        Showing <span className="tabular-nums text-ink">{from}</span>–
        <span className="tabular-nums text-ink">{to}</span> of{" "}
        <span className="tabular-nums text-ink">{total}</span>
        {itemLabel ? ` ${itemLabel}` : null}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId}>Rows per page</label>
          <select
            id={sizeId}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-7 cursor-pointer rounded-md border border-line bg-surface px-1.5 text-caption text-ink hover:border-line-strong"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          {pageCount > 1 ? (
            <span className="mr-1 tabular-nums">
              Page {page} of {pageCount}
            </span>
          ) : null}
          <IconButton
            label="Previous page"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            label="Next page"
            size="sm"
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

/* —— Bulk actions —— */

export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const { mounted, state } = usePresence(count > 0, 150);
  const [shownCount, setShownCount] = React.useState(count);
  if (count > 0 && count !== shownCount) setShownCount(count);
  if (!mounted) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      data-state={state}
      className="flex items-center gap-2 rounded-control border border-brand-border bg-brand-soft px-3 py-1.5 transition-[opacity,translate] duration-150 ease-standard starting:-translate-y-1 starting:opacity-0 data-[state=closed]:-translate-y-1 data-[state=closed]:opacity-0"
    >
      <span className="text-cell font-medium text-ink" aria-live="polite">
        {shownCount} selected
      </span>
      <div className="mx-1 h-4 w-px bg-brand-border" />
      <div className="flex flex-1 flex-wrap items-center gap-1">{children}</div>
      <Button size="sm" variant="ghost" onClick={onClear}>
        <X aria-hidden />
        Clear
      </Button>
    </div>
  );
}

/* —— Row selection (shift-click ranges) —— */

export function useRowSelection<Id extends string>(visibleIds: readonly Id[]) {
  const [selected, setSelected] = React.useState<ReadonlySet<Id>>(() => new Set());
  const [anchor, setAnchor] = React.useState<Id | null>(null);

  const toggle = React.useCallback(
    (id: Id, checked: boolean, { shiftKey = false }: { shiftKey?: boolean } = {}) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const from = anchor ? visibleIds.indexOf(anchor) : -1;
        const to = visibleIds.indexOf(id);
        const range = shiftKey && from !== -1 && to !== -1 ? visibleIds.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
        for (const rowId of range) {
          if (checked) next.add(rowId);
          else next.delete(rowId);
        }
        return next;
      });
      setAnchor(id);
    },
    [anchor, visibleIds],
  );

  const visibleSelected = visibleIds.filter((id) => selected.has(id)).length;
  const allState: boolean | "indeterminate" =
    visibleIds.length > 0 && visibleSelected === visibleIds.length
      ? true
      : visibleSelected > 0
        ? "indeterminate"
        : false;

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [visibleIds],
  );

  const clear = React.useCallback(() => {
    setSelected(new Set());
    setAnchor(null);
  }, []);

  return { selected, count: selected.size, isSelected: (id: Id) => selected.has(id), toggle, toggleAll, clear, allState };
}
