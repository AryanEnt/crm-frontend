"use client";

import { ArrowDownUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BOARD_SORT_OPTIONS,
  boardSortGroup,
  boardSortLabel,
  type BoardSortKey,
  type SortOrder,
} from "./pipeline-filters";

const GROUPS = ["Lead value", "Days in stage", "Time", "Priority"] as const;

type Props = {
  sort: BoardSortKey;
  order: SortOrder;
  onChange: (sort: BoardSortKey, order: SortOrder) => void;
  /** Compact trigger for a stage column header. */
  compact?: boolean;
  /** Marks a funnel-wise override vs the global board sort. */
  overridden?: boolean;
  className?: string;
  id?: string;
};

/** Sort control for board cards — global toolbar or per-stage column. */
export function BoardSortSelect({ sort, order, onChange, compact, overridden, className, id }: Props) {
  const value = `${sort}:${order}` as const;
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const [nextSort, nextOrder] = v.split(":") as [BoardSortKey, SortOrder];
        onChange(nextSort, nextOrder);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={compact ? "Sort leads in this stage" : "Sort pipeline leads"}
        className={cn(
          compact
            ? "h-7 w-auto gap-1 border-transparent bg-transparent px-1.5 text-caption shadow-none hover:bg-surface"
            : "h-9 w-auto max-w-[11.5rem] gap-1.5",
          overridden && "border-brand/40 text-brand-ink",
          className,
        )}
      >
        <ArrowDownUp className={cn("shrink-0 text-ink-muted", compact ? "size-3.5" : "size-4")} aria-hidden />
        <span className={cn("truncate", compact ? "max-w-[6.5rem] text-ink-secondary" : "")}>
          {compact
            ? overridden
              ? boardSortGroup(sort)
              : "Sort"
            : `${boardSortGroup(sort)} · ${boardSortLabel(sort, order)}`}
        </span>
      </SelectTrigger>
      <SelectContent align={compact ? "end" : "start"} className="min-w-[14rem]">
        {GROUPS.map((group) => (
          <SelectGroup key={group}>
            <SelectLabel>{group}</SelectLabel>
            {BOARD_SORT_OPTIONS.filter((o) => o.group === group).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
