"use client";

import * as React from "react";
import { Check, Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ComboboxOption } from "@/components/ui/combobox";

interface MultiComboboxProps {
  options: ComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  onCreate?: (inputValue: string) => Promise<ComboboxOption> | ComboboxOption;
  createLabel?: (inputValue: string) => string;
  className?: string;
  "aria-label"?: string;
}

export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Add…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  loading = false,
  disabled = false,
  onCreate,
  createLabel = (v) => `Create "${v}"`,
  className,
  ...aria
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [localOptions, setLocalOptions] = React.useState(options);

  React.useEffect(() => setLocalOptions(options), [options]);

  const selected = React.useMemo(
    () => localOptions.filter((o) => value.includes(o.value)),
    [localOptions, value],
  );

  const filtered = React.useMemo(() => {
    const base = localOptions.filter((o) => !value.includes(o.value));
    if (!query) return base;
    const q = query.toLowerCase();
    return base.filter((o) => o.label.toLowerCase().includes(q));
  }, [localOptions, value, query]);

  const exactMatch = localOptions.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
  );
  const canOfferCreate = Boolean(onCreate) && query.trim().length > 0 && !exactMatch;

  function toggle(optValue: string) {
    onChange(
      value.includes(optValue) ? value.filter((v) => v !== optValue) : [...value, optValue],
    );
  }

  function remove(optValue: string) {
    onChange(value.filter((v) => v !== optValue));
  }

  async function handleCreate() {
    if (!onCreate) return;
    setCreating(true);
    try {
      const created = await onCreate(query.trim());
      setLocalOptions((prev) => [...prev, created]);
      onChange([...value, created.value]);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-label={aria["aria-label"]}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-sm",
            "hover:border-line",
            "focus-visible:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-0",
            "data-[state=open]:border-line data-[state=open]:shadow-none data-[state=open]:ring-0",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
        >
          {selected.length === 0 ? (
            <span className="px-0.5 text-foreground-muted">{placeholder}</span>
          ) : null}
          {selected.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded-md bg-surface-muted py-0.5 pl-1.5 pr-1 text-xs font-normal text-foreground"
            >
              {opt.visual}
              {opt.label}
              <button
                type="button"
                aria-label={`Remove ${opt.label}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(opt.value);
                }}
                className="rounded-sm p-0.5 text-foreground-muted hover:bg-surface hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] border border-line bg-surface p-0 shadow-sm"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-foreground-muted">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                {filtered.length === 0 && !canOfferCreate ? (
                  <CommandEmpty>{emptyText}</CommandEmpty>
                ) : null}
                <CommandGroup>
                  {filtered.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => toggle(opt.value)}
                      className="gap-2"
                    >
                      {opt.visual}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {value.includes(opt.value) ? (
                        <Check className="size-4 text-brand" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {canOfferCreate ? (
                  <CommandGroup>
                    <CommandItem
                      value={`__create__${query}`}
                      onSelect={() => {
                        void handleCreate();
                      }}
                      disabled={creating}
                      className="gap-2 text-brand"
                    >
                      {creating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      {createLabel(query.trim())}
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
