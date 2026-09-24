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

  const isAsync = Boolean(onSearch);

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
    recent?.find((o) => o.value === value);

  const loading = externalLoading || searching;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-between px-2.5 font-normal shadow-none",
            !selected && "text-foreground-subtle",
            error && "border-destructive",
            className,
          )}
        >
          <span className="truncate text-left">
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
          <span className="flex items-center gap-1">
            {clearable && value ? (
              <span
                role="button"
                tabIndex={-1}
                className="rounded p-0.5 hover:bg-surface-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange(null, null);
                  }
                }}
              >
                <X className="size-3.5 opacity-60" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={!isAsync}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
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
                  onClick={() => setQ((prev) => prev + " ")}
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
                        onSelect={() => {
                          onChange(o.value, o);
                          setOpen(false);
                        }}
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
                      onSelect={() => {
                        onChange(o.value, o);
                        setOpen(false);
                      }}
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
