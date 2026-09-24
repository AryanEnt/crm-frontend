"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export type FilterBarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  onClear?: () => void;
  className?: string;
};

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Filter…",
  children,
  onClear,
  className,
}: FilterBarProps) {
  const hasSearch = search !== undefined && onSearchChange;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-2",
        className,
      )}
    >
      {hasSearch ? (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-center text-foreground-subtle"
              aria-hidden
            >
              <Search className="size-3.5 shrink-0" strokeWidth={2} />
            </span>
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
              aria-label="Filter table"
            />
          </div>
          {onClear ? (
            <IconButton label="Clear filters" size="sm" onClick={onClear}>
              <X className="size-3.5" />
            </IconButton>
          ) : null}
        </div>
      ) : onClear ? (
        <div className="flex justify-end">
          <IconButton label="Clear filters" size="sm" onClick={onClear}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      ) : null}
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
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
