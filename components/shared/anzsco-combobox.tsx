"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
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
  CommandSeparator,
} from "@/components/ui/command";
import { crmApi, type AnzscoOccupation } from "@/lib/api/crm";

const RECENT_KEY = "crm.anzsco.recent";
const MAX_RECENT = 6;
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_LIMIT = 30;

type RecentOccupation = Pick<AnzscoOccupation, "id" | "code" | "title" | "occupationGroup">;

function readRecent(): RecentOccupation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentOccupation[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(o: AnzscoOccupation) {
  const entry: RecentOccupation = {
    id: o.id,
    code: o.code,
    title: o.title,
    occupationGroup: o.occupationGroup,
  };
  const next = [entry, ...readRecent().filter((r) => r.id !== o.id)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Search when empty (suggestions), digit code (≥1), or title (≥2 chars). */
function shouldSearch(q: string): boolean {
  const t = q.trim();
  if (t === "") return true;
  if (/^\d+$/.test(t)) return t.length >= 1;
  return t.length >= 2;
}

function groupByOccupation(items: AnzscoOccupation[]): { group: string; items: AnzscoOccupation[] }[] {
  const map = new Map<string, AnzscoOccupation[]>();
  for (const o of items) {
    const key = o.occupationGroup || "Other";
    const list = map.get(key);
    if (list) list.push(o);
    else map.set(key, [o]);
  }
  return [...map.entries()].map(([group, groupItems]) => ({ group, items: groupItems }));
}

function formatTriggerLabel(code: string, title: string) {
  return `${title} · ${code}`;
}

export function AnzscoCombobox({
  value,
  onChange,
  className,
  selectedLabel,
  placeholder = "Search job title or ANZSCO code…",
  ...aria
}: {
  value?: string | null;
  onChange: (id: string | null, occupation?: AnzscoOccupation | null) => void;
  className?: string;
  /** Shown for a set value that isn't in the current search results. */
  selectedLabel?: string | null;
  placeholder?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [recent, setRecent] = React.useState<RecentOccupation[]>([]);
  const [picked, setPicked] = React.useState<AnzscoOccupation | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const debouncedQ = useDebounced(q, SEARCH_DEBOUNCE_MS);
  const trimmed = debouncedQ.trim();
  const searching = shouldSearch(debouncedQ);

  React.useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const search = useQuery({
    queryKey: ["anzsco", trimmed, SEARCH_LIMIT],
    queryFn: () => crmApi.searchAnzsco(trimmed, SEARCH_LIMIT),
    enabled: open && searching,
  });

  const results = search.data ?? [];
  const isEmptyQuery = trimmed === "";
  const waitingForChars = !searching && trimmed.length > 0;
  const showSuggested = isEmptyQuery && results.length > 0;
  const grouped = !isEmptyQuery && results.length > 0 ? groupByOccupation(results) : [];

  const selectedFromList = results.find((o) => o.id === value);
  const selectedRecent = recent.find((o) => o.id === value);
  const selected =
    (picked?.id === value ? picked : null) ??
    selectedFromList ??
    (selectedRecent
      ? ({
          ...selectedRecent,
          skillLevel: 0,
        } satisfies AnzscoOccupation)
      : null);

  const triggerText = selected
    ? formatTriggerLabel(selected.code, selected.title)
    : value
      ? (selectedLabel ?? "Selected occupation")
      : placeholder;

  const pick = (o: AnzscoOccupation | null) => {
    if (o) {
      pushRecent(o);
      setPicked(o);
      setRecent(readRecent());
    } else {
      setPicked(null);
    }
    onChange(o?.id ?? null, o);
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
          {...aria}
          className={cn(
            dropdownTriggerClass,
            "h-8 w-full justify-between gap-2 px-2.5",
            !value && "text-foreground-subtle",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Briefcase className="size-3.5 shrink-0 text-foreground-subtle" aria-hidden />
            <span className="truncate">{triggerText}</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {value ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear occupation"
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
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={16}
        className={cn(
          dropdownMenuClass,
          // Stay within the viewport when Radix flips above the trigger near the sheet bottom.
          "flex max-h-[min(22rem,var(--radix-popover-content-available-height))] min-w-[min(100vw-2rem,22rem)] flex-col overflow-hidden sm:min-w-[26rem]",
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement).querySelector("input");
          input?.focus();
        }}
      >
        <Command
          shouldFilter={false}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          defaultValue={selected ? `${selected.code} ${selected.title}` : undefined}
        >
          <div className="shrink-0">
            <CommandInput
              placeholder="e.g. nurse, cook, 261313…"
              value={q}
              onValueChange={setQ}
            />
            <div className="border-b border-line px-3 py-1.5">
              <p className="text-[11px] leading-snug text-foreground-muted">
                Type a <span className="font-medium text-foreground">job title</span> or{" "}
                <span className="font-medium text-foreground">6-digit ANZSCO code</span>
              </p>
            </div>
          </div>

          <CommandList className="min-h-0 flex-1 max-h-none overflow-y-auto overscroll-contain">
            {search.isFetching && searching ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-foreground-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Searching occupations…
              </div>
            ) : null}

            {!search.isFetching && waitingForChars ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <Search className="size-5 text-foreground-subtle" aria-hidden />
                <p className="text-sm text-foreground-muted">Keep typing to search</p>
                <p className="text-[11px] text-foreground-subtle">
                  At least 2 letters, or start a code with digits
                </p>
              </div>
            ) : null}

            {!search.isFetching && searching && !isEmptyQuery && results.length === 0 ? (
              <CommandEmpty>
                <div className="space-y-1 px-2 py-3 text-center">
                  <p className="text-sm text-foreground-muted">No occupations match “{trimmed}”</p>
                  <p className="text-[11px] text-foreground-subtle">
                    Try another title spelling or the full ANZSCO code
                  </p>
                </div>
              </CommandEmpty>
            ) : null}

            {!search.isFetching && isEmptyQuery && recent.length > 0 ? (
              <CommandGroup heading="Recent">
                {recent.map((o) => (
                  <OccupationItem
                    key={`recent-${o.id}`}
                    occupation={o}
                    checked={value === o.id}
                    onSelect={() =>
                      pick({
                        id: o.id,
                        code: o.code,
                        title: o.title,
                        occupationGroup: o.occupationGroup,
                        skillLevel: 0,
                      })
                    }
                  />
                ))}
              </CommandGroup>
            ) : null}

            {!search.isFetching && showSuggested ? (
              <>
                {recent.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="Suggested">
                  {results.map((o) => (
                    <OccupationItem
                      key={o.id}
                      occupation={o}
                      checked={value === o.id}
                      onSelect={() => pick(o)}
                    />
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {!search.isFetching && grouped.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map((o) => (
                  <OccupationItem
                    key={o.id}
                    occupation={o}
                    checked={value === o.id}
                    onSelect={() => pick(o)}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OccupationItem({
  occupation,
  checked,
  onSelect,
}: {
  occupation: Pick<AnzscoOccupation, "id" | "code" | "title" | "occupationGroup">;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${occupation.code} ${occupation.title} ${occupation.occupationGroup}`}
      onSelect={onSelect}
      checked={checked}
      className="cursor-pointer items-start gap-2.5 py-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug text-foreground">
          {occupation.title}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-foreground-muted">
          <span className="shrink-0 rounded bg-surface-muted px-1.5 py-px font-mono tabular-nums text-foreground-subtle">
            {occupation.code}
          </span>
          {occupation.occupationGroup ? (
            <span className="truncate">{occupation.occupationGroup}</span>
          ) : null}
        </span>
      </span>
    </CommandItem>
  );
}
