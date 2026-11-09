"use client";

import * as React from "react";
import { ArrowDownUp, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CLOSED_RANGE_OPTIONS, closedRangeLabel, type ClosedRange } from "./closed-range";
import { CLOSED_SORT_OPTIONS, type ClosedSortKey, type PipelineFilters, type SortOrder } from "./pipeline-filters";

type Props = { filters: PipelineFilters; onChange: (next: PipelineFilters) => void };

/** When the lead was won or lost: quick ranges, or a from/to date pair. */
export function ClosedDateFilter({ filters, onChange }: Props) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const verb = filters.status === "complete" ? "Outcome" : filters.status === "won" ? "Purchased" : "Lost";
  const reversed = Boolean(from && to && from > to);

  const apply = (closed: ClosedRange, closedFrom = "", closedTo = "") => {
    onChange({ ...filters, closed, closedFrom, closedTo, page: 1 });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setFrom(filters.closedFrom);
          setTo(filters.closedTo);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="lg" className={cn(filters.closed && "border-brand/40 text-brand-ink")}>
          <CalendarRange aria-hidden />
          <span className="text-ink-muted">{verb}:</span>
          <span className="first-letter:uppercase">{closedRangeLabel(filters)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-column p-4">
        <div role="radiogroup" aria-label={`${verb} date`} className="flex flex-wrap gap-1.5">
          {CLOSED_RANGE_OPTIONS.filter((o) => o.value !== "custom").map((o) => {
            const on = filters.closed === o.value;
            return (
              <button
                key={o.value || "any"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => apply(o.value)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-brand bg-brand text-primary-foreground" : "border-line bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <form
          className="mt-4 space-y-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reversed || (!from && !to)) return;
            apply("custom", from, to);
          }}
        >
          <p className="text-sm font-medium text-ink">Pick dates</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-from`} className="text-caption text-ink-muted">
                From
              </Label>
              <DatePicker id={`${id}-from`} value={from} max={to || undefined} onChange={setFrom} placeholder="Any" uiSize="md" clearable />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-to`} className="text-caption text-ink-muted">
                To
              </Label>
              <DatePicker id={`${id}-to`} value={to} min={from || undefined} onChange={setTo} placeholder="Any" uiSize="md" clearable />
            </div>
          </div>
          {reversed ? (
            <p className="text-caption text-danger" role="alert">
              The start date is after the end date.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={reversed || (!from && !to)}>
              Apply dates
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function ClosedSortSelect({ filters, onChange }: Props) {
  return (
    <Select
      value={`${filters.sort}:${filters.order}`}
      onValueChange={(v) => {
        const [sort, order] = v.split(":") as [ClosedSortKey, SortOrder];
        onChange({ ...filters, sort, order, page: 1 });
      }}
    >
      <SelectTrigger className="h-9 w-auto max-w-[11.5rem] gap-1.5" aria-label="Sort">
        <ArrowDownUp className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CLOSED_SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
