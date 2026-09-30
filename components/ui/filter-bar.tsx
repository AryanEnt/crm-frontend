"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Button as ConsoleButton } from "@/components/ui/console/button";
import { SearchInput } from "@/components/ui/console/input";

export type FilterBarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  /** Secondary filters, shown behind a "More filters" toggle. */
  more?: React.ReactNode;
  /** Active secondary filters; shown on the toggle so hidden filters are never silent. */
  moreCount?: number;
  onClear?: () => void;
  /** View controls pinned to the right of the row, e.g. the columns menu. */
  trailing?: React.ReactNode;
  className?: string;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Filter…",
  children,
  more,
  moreCount = 0,
  onClear,
  trailing,
  className,
}: FilterBarProps) {
  const hasSearch = search !== undefined && onSearchChange;
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreId = React.useId();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {hasSearch ? (
          <SearchInput
            value={search}
            onValueChange={onSearchChange}
            placeholder={searchPlaceholder}
            aria-label="Search table"
            className="w-full sm:w-72"
          />
        ) : null}
        {children}
        {more ? (
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
              moreCount > 0
                ? "border-brand-border bg-brand-soft text-brand hover:bg-brand-soft"
                : "border-line bg-surface text-ink-secondary shadow-xs hover:border-line-strong hover:text-ink",
            )}
          >
            {moreOpen ? "Fewer filters" : "More filters"}
            {moreCount > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {moreCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {onClear ? (
          <ConsoleButton variant="ghost" size="sm" onClick={onClear}>
            <X aria-hidden />
            Clear filters
          </ConsoleButton>
        ) : null}
        {trailing ? <div className="ml-auto flex items-center gap-1">{trailing}</div> : null}
      </div>
      {more ? (
        <div id={moreId} hidden={!moreOpen} className="flex flex-wrap items-center gap-2">
          {more}
        </div>
      ) : null}
    </div>
  );
}

export function FilterChip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-medium text-brand-dark">
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-sm hover:bg-brand/10"
          aria-label="Remove filter"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

export function FilterActions({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto flex items-center gap-2">{children}</div>;
}

export { Button as FilterButton };
