"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FIELD_CONTROL } from "./field-ui";
import {
  PHONE_COUNTRIES,
  expectedNationalLength,
  phoneCountry,
  type PhoneCountry,
} from "./phone";

/** Regional-indicator flag for an ISO country code (e.g. AU → 🇦🇺). */
export function flagEmoji(code: string) {
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2)
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)));
}

function matchesQuery(c: PhoneCountry, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const dial = c.dial;
  return (
    c.name.toLowerCase().includes(needle) ||
    c.code.toLowerCase().includes(needle) ||
    dial.includes(needle.replace(/^\+/, "")) ||
    `+${dial}`.includes(needle)
  );
}

export function PhoneCountryPicker({
  value,
  onChange,
  id,
  invalid,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selected = phoneCountry(value);
  const filtered = React.useMemo(
    () => PHONE_COUNTRIES.filter((c) => matchesQuery(c, query)),
    [query],
  );

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

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
          id={id}
          type="button"
          aria-label={`Country: ${selected.name}, +${selected.dial}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            FIELD_CONTROL,
            "inline-flex w-auto shrink-0 items-center gap-1.5 px-2.5 pr-2",
            "hover:bg-surface-muted data-[state=open]:border-brand data-[state=open]:bg-surface data-[state=open]:ring-4 data-[state=open]:ring-brand/15",
            className,
          )}
        >
          <span aria-hidden className="text-[1.15rem] leading-none">
            {flagEmoji(selected.code)}
          </span>
          <span className="text-cell font-semibold tabular-nums tracking-tight text-ink">
            +{selected.dial}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 text-ink-muted transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface p-0 shadow-lg"
      >
        <div className="border-b border-line/80 px-3.5 py-3">
          <p className="text-cell font-semibold text-ink">Country code</p>
          <p className="mt-0.5 text-caption text-ink-muted">
            Search by name, code, or +dial — length is checked for you.
          </p>
        </div>

        <Command shouldFilter={false} loop className="rounded-none bg-transparent">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Australia, +61, AU…"
          />
          <CommandList className="max-h-64 p-1.5">
            {filtered.length === 0 ? (
              <CommandEmpty>No country matches.</CommandEmpty>
            ) : null}
            {filtered.map((c) => {
              const active = c.code === selected.code;
              const digits = expectedNationalLength(c.code);
              return (
                <CommandItem
                  key={c.code}
                  value={`${c.name} ${c.code} +${c.dial}`}
                  checked={active}
                  onSelect={() => choose(c.code)}
                  className={cn(
                    "gap-3 rounded-xl px-2.5 py-2.5",
                    active && "bg-brand/10",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-lg leading-none ring-1 ring-line/60"
                  >
                    {flagEmoji(c.code)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-cell font-semibold text-ink">{c.name}</span>
                      <span className="shrink-0 text-caption tabular-nums text-ink-muted">{c.code}</span>
                    </span>
                    <span className="mt-0.5 block text-caption text-ink-muted">
                      +{c.dial} · {digits} digits
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
