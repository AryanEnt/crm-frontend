"use client";

import * as React from "react";
import { Pin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/console/input";
import { Avatar } from "@/components/ui/console/avatar";
import { Button } from "@/components/ui/console/button";
import { Select } from "@/components/ui/console/select";
import { Skeleton } from "@/components/ui/console/skeleton";
import type { CallContact, CallEntityType, CallPriority } from "@/lib/api/calls";
import { useCallContacts, usePinContact, type CallSelection } from "./use-call-data";

const PRIORITIES: Array<{ value: CallPriority | "all"; label: string }> = [
  { value: "all", label: "Any priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-danger",
  high: "text-danger",
  medium: "text-warning",
  low: "text-success",
};

const chipClass = (active: boolean) =>
  cn(
    "h-7 shrink-0 rounded-full px-3 text-caption font-medium transition-colors duration-150",
    active ? "bg-brand-soft text-brand-ink" : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
  );

export function typeLabel(type: CallEntityType) {
  return type === "lead" ? "Lead" : "Customer";
}

export function ContactPanel({
  selection,
  onSelect,
}: {
  selection: CallSelection | null;
  onSelect: (contact: CallContact) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [priority, setPriority] = React.useState<CallPriority | "all">("all");
  const [pinnedOnly, setPinnedOnly] = React.useState(false);
  const query = useCallContacts({ q: search, type: "lead", priority, pinnedOnly });
  const contacts = query.data ?? [];
  const pin = usePinContact();

  const togglePin = (c: CallContact) => {
    pin.mutate(
      { contact: c, pinned: !c.pinned },
      { onError: () => toast.error(c.pinned ? "Couldn't unpin. Try again." : "Couldn't pin. Try again.") },
    );
  };

  return (
    <aside
      aria-label="Leads"
      className={cn(
        "flex min-w-0 flex-col rounded-card border border-line bg-surface",
        "min-[1000px]:sticky min-[1000px]:top-[calc(var(--header-height)+1rem)] min-[1000px]:max-h-[calc(100dvh-var(--header-height)-2rem)] min-[1000px]:self-start",
      )}
    >
      <div className="space-y-3 border-b border-line p-3">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search name, phone, email, employer"
          aria-label="Search leads"
          hotkey={false}
        />
        <div className="flex items-center gap-2">
          <Select
            uiSize="sm"
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as CallPriority | "all")}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-pressed={pinnedOnly}
            onClick={() => setPinnedOnly((v) => !v)}
            className={cn(chipClass(pinnedOnly), "inline-flex items-center gap-1.5")}
          >
            <Pin aria-hidden className={cn("size-3.5", pinnedOnly && "fill-current")} />
            Pinned
          </button>
        </div>
      </div>

      <div
        className="crm-scroll max-h-[220px] min-h-0 flex-1 overflow-y-auto min-[1000px]:max-h-none"
        aria-busy={query.isFetching || undefined}
      >
        {query.isLoading ? (
          <ul aria-label="Loading contacts" className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <div role="alert" className="space-y-2 p-4 text-body">
            <p className="text-ink">Couldn&apos;t load contacts.</p>
            <Button size="sm" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : contacts.length === 0 ? (
          <p className="p-4 text-body text-ink-muted">
            {pinnedOnly && !search && priority === "all"
              ? "No pinned contacts yet. Use the pin next to a name to keep someone at the top."
              : "No matching contacts."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((c) => {
              const selected = selection?.type === c.type && selection.id === c.id;
              const prio = c.priority?.toLowerCase();
              return (
                <li key={`${c.type}-${c.id}`} className="relative">
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(c)}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-[3px] py-2.5 pl-[9px] pr-11 text-left transition-colors duration-150",
                      selected ? "border-brand bg-brand-soft/70" : "border-transparent hover:bg-surface-muted",
                    )}
                  >
                    <Avatar name={c.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{c.fullName}</span>
                      <span className="block truncate text-caption text-ink-secondary">
                        {typeLabel(c.type)}
                        {c.stageName ? ` · ${c.stageName}` : ""}
                        {prio && PRIORITY_TEXT[prio] ? (
                          <>
                            {" · "}
                            <span className={cn("capitalize", PRIORITY_TEXT[prio])}>{prio}</span>
                          </>
                        ) : null}
                      </span>
                      {c.email ? <span className="block truncate text-caption text-ink-muted">{c.email}</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={c.pinned}
                    aria-label={c.pinned ? `Unpin ${c.fullName}` : `Pin ${c.fullName} to the top`}
                    title={c.pinned ? "Unpin" : "Pin to top"}
                    onClick={() => togglePin(c)}
                    className={cn(
                      "absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-control transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                      c.pinned ? "text-brand" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <Pin aria-hidden className={cn("size-4", c.pinned && "fill-current")} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
