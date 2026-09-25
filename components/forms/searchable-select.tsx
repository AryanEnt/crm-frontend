"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { EntityPickerOption } from "./types";

export type SearchableSelectProps = {
  value?: string | null;
  onChange: (value: string | null, option?: EntityPickerOption | null) => void;
  options?: EntityPickerOption[];
  /** Async search — when provided, options are ignored for list content */
  onSearch?: (query: string) => Promise<EntityPickerOption[]> | EntityPickerOption[];
  /** Fallback label when value is set but option is not in the current list */
  selectedLabel?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  error?: boolean;
  createLabel?: string;
  onCreate?: () => void;
  recent?: EntityPickerOption[];
};

export function SearchableSelect({
  value,
  onChange,
  options = [],
  onSearch,
  selectedLabel,
  placeholder = "Search…",
  searchPlaceholder = "Type to search…",
  emptyText = "No results found",
  loading: externalLoading,
  disabled,
  clearable = true,
  className,
  error,
  createLabel,
  onCreate,
  recent,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [asyncOptions, setAsyncOptions] = React.useState<EntityPickerOption[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [cached, setCached] = React.useState<EntityPickerOption | null>(null);

  const isAsync = Boolean(onSearch);

  React.useEffect(() => {
    if (!value) {
      setCached(null);
      return;
    }
    if (!selectedLabel) return;
    setCached((prev) =>
      prev?.value === value && prev.label === selectedLabel
        ? prev
        : { value, label: selectedLabel },
    );
  }, [value, selectedLabel]);

  React.useEffect(() => {
    if (!open || !onSearch) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      Promise.resolve(onSearch(q))
        .then((res) => {
          if (!cancelled) setAsyncOptions(res);
        })
        .catch(() => {
          if (!cancelled) setSearchError("Unable to load results.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, onSearch]);

  const list = isAsync ? asyncOptions : options;
  const selected =
    list.find((o) => o.value === value) ??
    options.find((o) => o.value === value) ??
    recent?.find((o) => o.value === value) ??
    (cached?.value === value ? cached : null) ??
    (value && selectedLabel ? { value, label: selectedLabel } : null);

  const loading = externalLoading || searching;

  const pick = (opt: EntityPickerOption | null) => {
    setCached(opt);
    onChange(opt?.value ?? null, opt);
    setOpen(false);
  };

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-between gap-2 border border-line bg-surface px-2.5 font-normal shadow-none",
            "hover:border-line hover:bg-surface",
            "focus-visible:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-0",
            "data-[state=open]:border-line data-[state=open]:shadow-none data-[state=open]:ring-0",
            !selected && "text-foreground-subtle",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left text-sm">
            {selected ? (
              <>
                <span className="text-foreground">{selected.label}</span>
                {selected.description ? (
                  <span className="ml-1.5 text-foreground-subtle">{selected.description}</span>
                ) : null}
              </>
            ) : (
              placeholder
            )}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {clearable && value ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                className="rounded p-0.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(null);
                  }
                }}
              >
                <X className="size-3.5 opacity-60" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-visible border border-line bg-surface p-0 shadow-sm"
        align="start"
        sideOffset={4}
        collisionPadding={12}
        onOpenAutoFocus={(e) => {
          // Keep focus in the search input without fighting the drawer focus trap.
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement).querySelector("input");
          input?.focus();
        }}
      >
        <Command shouldFilter={!isAsync} className="rounded-md border-0 shadow-none">
          <CommandInput
            placeholder={searchPlaceholder}
            value={q}
            onValueChange={setQ}
          />
          <CommandList className="max-h-56">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-foreground-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Searching…
              </div>
            ) : searchError ? (
              <div className="space-y-2 px-3 py-4 text-xs">
                <p className="text-destructive">{searchError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setQ((prev) => `${prev}`.trimEnd() + " ")}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="space-y-2 py-1 text-center">
                    <p>{emptyText}</p>
                    {createLabel && onCreate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => {
                          setOpen(false);
                          onCreate();
                        }}
                      >
                        <Plus className="size-3.5" />
                        {createLabel}
                      </Button>
                    ) : null}
                  </div>
                </CommandEmpty>
                {recent && recent.length > 0 && !q ? (
                  <CommandGroup heading="Recent">
                    {recent.map((o) => (
                      <OptionItem
                        key={`recent-${o.value}`}
                        option={o}
                        selected={value === o.value}
                        onSelect={() => pick(o)}
                      />
                    ))}
                  </CommandGroup>
                ) : null}
                <CommandGroup>
                  {list.map((o) => (
                    <OptionItem
                      key={o.value}
                      option={o}
                      selected={value === o.value}
                      onSelect={() => pick(o)}
                    />
                  ))}
                </CommandGroup>
                {createLabel && onCreate && list.length > 0 ? (
                  <div className="border-t border-border p-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start gap-1.5 text-brand"
                      onClick={() => {
                        setOpen(false);
                        onCreate();
                      }}
                    >
                      <Plus className="size-3.5" />
                      {createLabel}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OptionItem({
  option,
  selected,
  onSelect,
}: {
  option: EntityPickerOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${option.label} ${option.description ?? ""} ${option.meta ?? ""}`}
      onSelect={onSelect}
      className={cn(
        "cursor-pointer",
        selected && "bg-transparent data-[selected=true]:bg-transparent",
      )}
    >
      <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{option.label}</span>
        {option.description || option.meta ? (
          <span className="block truncate text-[11px] text-foreground-muted">
            {[option.description, option.meta].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
    </CommandItem>
  );
}

/** Alias matching the architecture doc name. */
export const EntityPicker = SearchableSelect;
