"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  visual?: React.ReactNode;
  group?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  searchThreshold?: number;
  onCreate?: (inputValue: string) => Promise<ComboboxOption> | ComboboxOption;
  createLabel?: (inputValue: string) => string;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  loading = false,
  disabled = false,
  clearable = false,
  searchThreshold = 7,
  onCreate,
  createLabel = (v) => `Create "${v}"`,
  className,
  triggerClassName,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const showSearch = options.length > searchThreshold || Boolean(onCreate);

  const filtered = React.useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const groups = React.useMemo(() => {
    const map = new Map<string | undefined, ComboboxOption[]>();
    for (const opt of filtered) {
      const key = opt.group;
      const list = map.get(key);
      if (list) list.push(opt);
      else map.set(key, [opt]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const exactMatch = filtered.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
  );
  const canOfferCreate = Boolean(onCreate) && query.trim().length > 0 && !exactMatch;

  React.useEffect(() => {
    if (!open || !showSearch) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, showSearch]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  async function handleCreate() {
    if (!onCreate) return;
    setCreating(true);
    try {
      const newOption = await onCreate(query.trim());
      onChange(newOption.value);
      close();
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
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={aria["aria-label"]}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between border border-line bg-surface px-3 font-normal shadow-none",
              "hover:border-line hover:bg-surface",
              "focus-visible:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-0",
              "data-[state=open]:border-line data-[state=open]:shadow-none data-[state=open]:ring-0",
              !selected && "text-foreground-muted",
              clearable && selected && "pr-14",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              {loading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                selected?.visual
              )}
              <span className="truncate">{selected ? selected.label : placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        {clearable && selected && !disabled ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] border border-line bg-surface p-0 shadow-sm"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} loop>
          {showSearch ? (
            <CommandInput
              ref={searchRef}
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder}
            />
          ) : null}
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

                {groups.map(([group, opts]) => (
                  <CommandGroup key={group ?? "__ungrouped"} heading={group}>
                    {opts.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        disabled={opt.disabled}
                        onSelect={() => {
                          onChange(opt.value);
                          close();
                        }}
                        className={cn("gap-2", opt.value === value && "bg-transparent data-[selected=true]:bg-transparent")}
                      >
                        {opt.visual}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{opt.label}</span>
                          {opt.description ? (
                            <span className="truncate text-xs text-foreground-muted">
                              {opt.description}
                            </span>
                          ) : null}
                        </span>
                        {opt.value === value ? (
                          <Check className="size-4 shrink-0 text-brand" />
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}

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
