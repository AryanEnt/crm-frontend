"use client";

import * as React from "react";
import { ChevronDown, Columns3, Rows3, Rows4, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDensity } from "@/lib/density";
import { Button } from "./button";
import { Tooltip } from "./tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type FilterOption = { value: string; label: string };

const PILL = "rounded-full px-3";
const PILL_ACTIVE = "border-brand-border bg-brand-soft text-brand hover:border-brand-border hover:bg-brand-soft";

/** Single-select filter pill: "Role", or "Role: Team Lead" when active. */
export function FilterSelect({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon?: LucideIcon;
  options: readonly FilterOption[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const current = value === null ? undefined : options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary" className={cn(PILL, current && PILL_ACTIVE)}>
          {Icon ? <Icon aria-hidden /> : null}
          {label}
          {current ? (
            <>
              <span aria-hidden className="h-3.5 w-px bg-brand-border" />
              <span className="max-w-32 truncate">{current.label}</span>
            </>
          ) : null}
          <ChevronDown aria-hidden className="-mr-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`Filter by ${label.toLowerCase()}`} className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            checked={option.value === value}
            onSelect={() => onChange(option.value === value ? null : option.value)}
          >
            {option.label}
          </DropdownMenuRadioItem>
        ))}
        {current ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(null)}>Clear {label.toLowerCase()} filter</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Multi-select filter pill: "Role", "Role · 2" when active. */
export function FilterMenu({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
}: {
  label: string;
  icon?: LucideIcon;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const active = selected.length > 0;
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="secondary" className={cn(PILL, active && PILL_ACTIVE)}>
          {Icon ? <Icon aria-hidden /> : null}
          {label}
          {active ? (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-overline font-semibold tracking-normal tabular-nums text-primary-foreground">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="-mr-1 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={`Filter by ${label.toLowerCase()}`}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>Clear {label.toLowerCase()} filter</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type ColumnOption = { id: string; label: string; required?: boolean };

export function ColumnsMenu({
  columns,
  visible,
  onToggle,
}: {
  columns: readonly ColumnOption[];
  visible: ReadonlySet<string>;
  onToggle: (id: string, visible: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost">
          <Columns3 aria-hidden />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Visible columns">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visible.has(column.id)}
            disabled={column.required}
            onCheckedChange={(checked) => onToggle(column.id, checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Segmented compact / comfortable switch backed by the shared `aurora.density` preference. */
export function DensityToggle() {
  const { density, setDensity } = useDensity();
  const options = [
    { value: "compact", label: "Compact rows", Icon: Rows4 },
    { value: "comfortable", label: "Comfortable rows", Icon: Rows3 },
  ] as const;

  return (
    <div role="group" aria-label="Row density" className="inline-flex h-8 items-center rounded-control border border-line bg-surface p-0.5 shadow-xs">
      {options.map(({ value, label, Icon }) => {
        const pressed = density === value;
        return (
          <Tooltip key={value} content={label}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={pressed}
              onClick={() => setDensity(value)}
              className={cn(
                "inline-flex h-full w-7 items-center justify-center rounded-[calc(var(--radius-control)-2px)] text-ink-muted transition-colors duration-150 hover:text-ink",
                pressed && "bg-surface-muted text-ink",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
