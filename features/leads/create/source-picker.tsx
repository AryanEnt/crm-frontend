"use client";

import * as React from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Globe2,
  Handshake,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Share2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { dropdownMenuClass } from "@/components/ui/dropdown-styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_ACTIVE, CHIP_IDLE, useRovingRadio } from "./field-ui";

const SOURCE_ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  website: { icon: Globe2, tint: "text-info" },
  google: { icon: Search, tint: "text-info" },
  facebook: { icon: Share2, tint: "text-info" },
  instagram: { icon: Share2, tint: "text-info" },
  social: { icon: Share2, tint: "text-info" },
  email: { icon: Mail, tint: "text-info" },
  whatsapp: { icon: MessageCircle, tint: "text-success" },
  referral: { icon: Users, tint: "text-success" },
  "walk in": { icon: Building2, tint: "text-brand" },
  partner: { icon: Handshake, tint: "text-brand" },
  event: { icon: CalendarDays, tint: "text-brand" },
  agent: { icon: UserRound, tint: "text-ink-muted" },
  "cold call": { icon: Phone, tint: "text-warning" },
  phone: { icon: Phone, tint: "text-warning" },
};

function sourceIcon(name: string) {
  const key = name.trim().toLowerCase().replace(/[-_\s]+/g, " ");
  return SOURCE_ICONS[key] ?? { icon: CircleDot, tint: "text-ink-muted" };
}

function SourceIcon({ name, className }: { name: string; className?: string }) {
  const { icon: Icon, tint } = sourceIcon(name);
  return <Icon aria-hidden className={cn("size-4 shrink-0", tint, className)} />;
}

const QUICK_CHIPS = 4;
/** Always offered as a chip, even when it isn't among the most used. */
const PINNED_SOURCES = ["referral"];

export function quickSources(ranked: readonly string[], count = QUICK_CHIPS): string[] {
  const quick = ranked.slice(0, count);
  for (const pin of PINNED_SOURCES) {
    const match = ranked.find((s) => s.trim().toLowerCase() === pin);
    if (!match || quick.includes(match)) continue;
    quick[quick.length - 1] = match;
  }
  return quick;
}

/**
 * `sources` arrive ranked (the user's most used first), so the first four are one-tap
 * chips and "More" opens the full, searchable list. A source picked from the list
 * takes the "More" chip's place so the choice stays visible.
 */
export function SourcePicker({
  value,
  onChange,
  sources,
  labelId,
  invalid,
}: {
  value: string;
  onChange: (source: string) => void;
  sources: readonly string[];
  labelId: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const quick = React.useMemo(() => quickSources(sources), [sources]);
  const radio = useRovingRadio(quick, value, onChange);
  const filtered = query
    ? sources.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()))
    : sources;
  const fromList = Boolean(value) && !quick.includes(value);

  const choose = (source: string) => {
    onChange(source);
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
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-invalid={invalid || undefined}
          data-invalid={invalid || undefined}
          className="flex flex-wrap gap-2"
        >
          {quick.map((source) => (
            <button
              key={source}
              type="button"
              {...radio(source)}
              onClick={() => onChange(source)}
              className={cn(CHIP, value === source ? CHIP_ACTIVE : CHIP_IDLE)}
            >
              <SourceIcon name={source} className={cn("size-3.5", value === source && "text-current")} />
              {source}
            </button>
          ))}
        </div>
        {sources.length > quick.length ? (
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={fromList ? `Source: ${value}. Choose another` : "More sources"}
              className={cn(CHIP, fromList ? CHIP_ACTIVE : CHIP_IDLE)}
            >
              {fromList ? (
                <SourceIcon name={value} className="size-3.5 text-current" />
              ) : (
                <MoreHorizontal aria-hidden className="size-3.5" />
              )}
              {fromList ? value : "More"}
              <ChevronDown aria-hidden className="size-3.5 opacity-70" />
            </button>
          </PopoverTrigger>
        ) : null}
      </div>

      <PopoverContent className={dropdownMenuClass} align="start" sideOffset={6}>
        <Command shouldFilter={false} loop defaultValue={value || undefined}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search sources…" />
          <CommandList>
            {filtered.length === 0 ? <CommandEmpty>No sources match.</CommandEmpty> : null}
            {filtered.map((source) => (
              <CommandItem
                key={source}
                value={source}
                checked={source === value}
                onSelect={() => choose(source)}
                className="gap-2"
              >
                <SourceIcon name={source} />
                <span className="truncate">{source}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
