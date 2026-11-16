"use client";

import * as React from "react";
import { ChevronsUpDown, Loader2, PenLine, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dropdownMenuClass, dropdownTriggerClass } from "@/components/ui/dropdown-styles";
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
  /** Called with the current search text (trimmed). Used for “use typed name” / create flows. */
  onCreate?: (query: string) => void;
  /**
   * When search returns nothing, show a selectable “use typed text” row inside the menu
   * (uses the search box as the name input — no extra field outside).
   */
  allowCustomValue?: boolean;
  /** Short hint under the custom-value row. */
  customValueHint?: string;
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
  allowCustomValue = false,
  customValueHint = "Not in the list — use this name",
  recent,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [asyncOptions, setAsyncOptions] = React.useState<EntityPickerOption[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [cached, setCached] = React.useState<EntityPickerOption | null>(null);

  const isAsync = Boolean(onSearch);
  const typed = q.trim();

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
  const showCustomRow = allowCustomValue && Boolean(onCreate) && typed !== "" && list.length === 0 && !loading && !searchError;

  const pick = (opt: EntityPickerOption | null) => {
    setCached(opt);
    onChange(opt?.value ?? null, opt);
    setOpen(false);
    setQ("");
  };

  const useTyped = () => {
    if (!typed || !onCreate) return;
    onCreate(typed);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            dropdownTriggerClass,
            "h-8 w-full justify-between gap-2 px-2.5",
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
        className={dropdownMenuClass}
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
        <Command
          shouldFilter={!isAsync}
          defaultValue={selected ? optionValue(selected) : undefined}
        >
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
                {showCustomRow ? (
                  <div className="p-2">
                    <p className="mb-2 px-1 text-center text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                      {emptyText}
                    </p>
                    <CommandGroup className="p-0">
                      <CommandItem
                        value={`use-typed ${typed}`}
                        onSelect={useTyped}
                        className={cn(
                          "cursor-pointer items-start gap-3 rounded-xl border border-dashed border-brand/40",
                          "bg-brand-soft px-3 py-3 text-foreground shadow-none",
                          "hover:bg-brand-soft data-[selected=true]:bg-brand/15 data-[selected=true]:text-foreground",
                        )}
                      >
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-brand shadow-sm ring-1 ring-brand/25">
                          <PenLine className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="mb-1 inline-flex rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                            Add as new name
                          </span>
                          <span className="mt-1 block truncate text-[15px] font-semibold leading-snug text-ink">
                            “{typed}”
                          </span>
                          <span className="mt-1 block text-[12px] leading-snug text-foreground-muted">
                            {customValueHint}
                          </span>
                          <span className="mt-2 block text-[11px] font-medium text-brand">
                            Click or press Enter to use this name →
                          </span>
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </div>
                ) : null}

                {!showCustomRow ? (
                  <CommandEmpty>
                    <div className="space-y-2.5 px-1 py-2 text-center">
                      <p className="text-sm text-foreground-muted">{emptyText}</p>
                      {allowCustomValue && onCreate ? (
                        <p className="text-[11px] text-foreground-subtle">
                          Keep typing a full name above — we’ll offer to use it here.
                        </p>
                      ) : null}
                      {createLabel && onCreate && !allowCustomValue ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          onClick={() => {
                            setOpen(false);
                            onCreate(typed);
                          }}
                        >
                          <Plus className="size-3.5" />
                          {createLabel}
                        </Button>
                      ) : null}
                    </div>
                  </CommandEmpty>
                ) : null}

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
                {list.length > 0 ? (
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
                ) : null}
                {createLabel && onCreate && list.length > 0 && !allowCustomValue ? (
                  <div className="border-t border-border p-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start gap-1.5 text-brand"
                      onClick={() => {
                        setOpen(false);
                        onCreate(typed);
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

function optionValue(option: EntityPickerOption) {
  return `${option.label} ${option.description ?? ""} ${option.meta ?? ""}`.trim();
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
      value={optionValue(option)}
      onSelect={onSelect}
      checked={selected}
      className="cursor-pointer"
    >
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
