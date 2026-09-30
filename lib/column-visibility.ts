"use client";

import * as React from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import type { ColumnOption } from "@/components/ui/console/toolbar";

const PREFIX = "aurora.columns.";
const EVENT = "aurora-columns";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, hidden: string[]) {
  try {
    if (hidden.length) window.localStorage.setItem(PREFIX + key, JSON.stringify(hidden));
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function columnId<TData>(column: ColumnDef<TData, unknown>): string | undefined {
  if (column.id) return column.id;
  if ("accessorKey" in column && typeof column.accessorKey === "string") return column.accessorKey;
  return undefined;
}

/**
 * Per-table hidden columns, remembered in this browser. The server render shows every
 * column; the saved choice applies right after hydration, so markup never mismatches.
 * Columns need a string `header` or `meta.label` to appear in the menu; set
 * `enableHiding: false` on the identity column.
 */
export function useColumnVisibility<TData>(
  storageKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[],
) {
  const raw = React.useSyncExternalStore(subscribe, () => read(storageKey), () => null);
  const hidden = React.useMemo(() => parse(raw), [raw]);

  const options = React.useMemo<ColumnOption[]>(
    () =>
      columns.flatMap((column) => {
        const id = columnId(column);
        const label = column.meta?.label ?? (typeof column.header === "string" ? column.header : undefined);
        if (!id || !label || column.enableHiding === false) return [];
        return [{ id, label }];
      }),
    [columns],
  );

  const columnVisibility = React.useMemo<VisibilityState>(
    () => Object.fromEntries(hidden.map((id) => [id, false])),
    [hidden],
  );

  const visible = React.useMemo(
    () => new Set(options.filter((o) => !hidden.includes(o.id)).map((o) => o.id)),
    [options, hidden],
  );

  const onToggle = React.useCallback(
    (id: string, show: boolean) => {
      const next = show ? hidden.filter((h) => h !== id) : [...new Set([...hidden, id])];
      write(storageKey, next);
    },
    [hidden, storageKey],
  );

  return { columnVisibility, menu: { columns: options, visible, onToggle } };
}
