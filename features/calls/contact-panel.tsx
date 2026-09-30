"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/console/input";
import { Avatar } from "@/components/ui/console/avatar";
import { Button } from "@/components/ui/console/button";
import { Skeleton } from "@/components/ui/console/skeleton";
import type { CallContact, CallEntityType } from "@/lib/api/calls";
import { useCallContacts, type CallSelection } from "./use-call-data";

type Filter = CallEntityType | "all";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "lead", label: "Leads" },
  { value: "customer", label: "Customers" },
];

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
  const [filter, setFilter] = React.useState<Filter>("all");
  const query = useCallContacts(search, filter);
  const contacts = query.data ?? [];

  return (
    <aside
      aria-label="Leads and customers"
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
          aria-label="Search leads and customers"
          hotkey={false}
        />
        <div role="group" aria-label="Show" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-7 rounded-full px-3 text-caption font-medium transition-colors duration-150",
                filter === f.value
                  ? "bg-brand-soft text-brand-ink"
                  : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
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
          <p className="p-4 text-body text-ink-muted">No matching contacts.</p>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((c) => {
              const selected = selection?.type === c.type && selection.id === c.id;
              return (
                <li key={`${c.type}-${c.id}`}>
                  <button
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(c)}
                    className={cn(
                      "flex w-full items-center gap-3 border-l-[3px] py-2.5 pl-[9px] pr-3 text-left transition-colors duration-150",
                      selected ? "border-brand bg-brand-soft/70" : "border-transparent hover:bg-surface-muted",
                    )}
                  >
                    <Avatar name={c.fullName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{c.fullName}</span>
                      <span className="block truncate text-caption text-ink-secondary">
                        {typeLabel(c.type)}
                        {c.stageName ? ` · ${c.stageName}` : ""}
                      </span>
                      {c.email ? <span className="block truncate text-caption text-ink-muted">{c.email}</span> : null}
                    </span>
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
