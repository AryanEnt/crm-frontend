"use client";

import { Columns3, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineFilters, PipelineView } from "./pipeline-filters";

const VIEWS: { value: PipelineView; label: string; Icon: typeof Columns3 }[] = [
  { value: "board", label: "Board", Icon: Columns3 },
  { value: "table", label: "Table", Icon: Rows3 },
];

/** Board (kanban) vs table — same quiet pill used across open and closed statuses. */
export function PipelineViewToggle({
  filters,
  onChange,
}: {
  filters: PipelineFilters;
  onChange: (next: PipelineFilters) => void;
}) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex h-9 items-center rounded-full bg-surface-muted p-0.5">
      {VIEWS.map(({ value, label, Icon }) => {
        const on = filters.view === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() =>
              onChange({
                ...filters,
                view: value,
                page: 1,
              })
            }
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
