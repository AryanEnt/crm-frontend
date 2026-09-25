"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus,
  Users,
  Handshake,
  CalendarPlus,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getNavForRole } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

const RECENT_KEY = "aurora.cmd.recent";
const MAX_RECENT = 6;

type RecentItem = { href: string; label: string; at: number };

function readRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: Omit<RecentItem, "at">) {
  const next = [
    { ...item, at: Date.now() },
    ...readRecent().filter((r) => r.href !== item.href),
  ].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export type CommandSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickCreate?: (entity: "lead" | "customer" | "deal" | "activity") => void;
};

export function CommandSearch({ open, onOpenChange, onQuickCreate }: CommandSearchProps) {
  const router = useRouter();
  const { user, can, permissions } = useAuth();
  const [query, setQuery] = React.useState("");
  const [recent, setRecent] = React.useState<RecentItem[]>([]);
  const debounced = useDebounced(query.trim(), 220);
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setRecent(readRecent());
    }
  }, [open]);

  const navSections = React.useMemo(() => {
    return getNavForRole(user?.roleCode)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          canAccessPath(permissions, item.href.split("?")[0]),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [user?.roleCode, permissions]);

  const searchEnabled = debounced.length >= 2;

  const leadsQuery = useQuery({
    queryKey: ["cmdk-leads", debounced],
    queryFn: () =>
      crmApi.listLeads(new URLSearchParams({ q: debounced, limit: "5", offset: "0" })),
    enabled: open && searchEnabled && can("leads:view"),
  });
  const customersQuery = useQuery({
    queryKey: ["cmdk-customers", debounced],
    queryFn: () =>
      crmApi.listCustomers(new URLSearchParams({ q: debounced, limit: "5", offset: "0" })),
    enabled: open && searchEnabled && can("customers:view"),
  });
  const dealsQuery = useQuery({
    queryKey: ["cmdk-deals", debounced],
    queryFn: () =>
      crmApi.listDeals(new URLSearchParams({ q: debounced, limit: "5", offset: "0" })),
    enabled: open && searchEnabled && can("deals:view"),
  });

  const go = (href: string, label: string) => {
    pushRecent({ href, label });
    onOpenChange(false);
    router.push(href);
  };

  const createActions = (
    [
      { id: "lead" as const, label: "New lead", icon: UserPlus, perm: "leads:create" },
      { id: "customer" as const, label: "New customer", icon: Users, perm: "customers:create" },
      { id: "deal" as const, label: "New deal", icon: Handshake, perm: "deals:create" },
      {
        id: "activity" as const,
        label: "New activity",
        icon: CalendarPlus,
        perm: "activities:create",
      },
    ] as const
  ).filter((a) => can(a.perm));

  const hasRecordHits =
    (leadsQuery.data?.data.length ?? 0) > 0 ||
    (customersQuery.data?.data.length ?? 0) > 0 ||
    (dealsQuery.data?.data.length ?? 0) > 0;

  const searching =
    searchEnabled &&
    (leadsQuery.isFetching || customersQuery.isFetching || dealsQuery.isFetching);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg overflow-hidden p-0" showClose={false}>
        <Command shouldFilter={!searchEnabled} className="rounded-[var(--radius-lg)]">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a page, or search leads, customers, deals…"
          />
          <CommandList className="max-h-[min(420px,70vh)]">
            <CommandEmpty>
              {searching ? "Searching…" : "No matches. Try a different name or page."}
            </CommandEmpty>

            {!searchEnabled && createActions.length > 0 && onQuickCreate ? (
              <CommandGroup heading="Quick create">
                {createActions.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`create ${a.label}`}
                    onSelect={() => {
                      onOpenChange(false);
                      onQuickCreate(a.id);
                    }}
                  >
                    <a.icon className="size-3.5 text-brand" />
                    {a.label}
                    <kbd className="ml-auto text-[10px] text-foreground-subtle">
                      {a.id === "lead" ? "C" : ""}
                    </kbd>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {!searchEnabled && recent.length > 0 ? (
              <CommandGroup heading="Recent">
                {recent.map((r) => (
                  <CommandItem
                    key={r.href}
                    value={`recent ${r.label} ${r.href}`}
                    onSelect={() => go(r.href, r.label)}
                  >
                    <Clock className="size-3.5 text-foreground-subtle" />
                    {r.label}
                    <ArrowRight className="ml-auto size-3 text-foreground-subtle opacity-0 group-data-[selected=true]:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {searchEnabled && hasRecordHits ? (
              <>
                {(leadsQuery.data?.data.length ?? 0) > 0 ? (
                  <CommandGroup heading="Leads">
                    {leadsQuery.data!.data.map((l) => (
                      <CommandItem
                        key={l.id}
                        value={`lead ${l.fullName} ${l.email ?? ""}`}
                        onSelect={() =>
                          go(`/leads?q=${encodeURIComponent(l.fullName)}`, l.fullName)
                        }
                      >
                        <UserPlus className="size-3.5 text-foreground-muted" />
                        <span className="truncate">{l.fullName}</span>
                        <span className="ml-auto truncate text-meta">{l.email ?? l.stageName ?? ""}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {(customersQuery.data?.data.length ?? 0) > 0 ? (
                  <CommandGroup heading="Customers">
                    {customersQuery.data!.data.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`customer ${c.fullName} ${c.email ?? ""}`}
                        onSelect={() => go(`/customers/${c.id}`, c.fullName)}
                      >
                        <Users className="size-3.5 text-foreground-muted" />
                        <span className="truncate">{c.fullName}</span>
                        <span className="ml-auto truncate text-meta">{c.email ?? ""}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {(dealsQuery.data?.data.length ?? 0) > 0 ? (
                  <CommandGroup heading="Deals">
                    {dealsQuery.data!.data.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={`deal ${d.title} ${d.customerName}`}
                        onSelect={() => go(`/deals/${d.id}`, d.title)}
                      >
                        <Handshake className="size-3.5 text-foreground-muted" />
                        <span className="truncate">{d.title}</span>
                        <span className="ml-auto truncate text-meta">{d.customerName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                <CommandSeparator />
              </>
            ) : null}

            {navSections.map((section) => (
              <CommandGroup key={section.title ?? "nav"} heading={section.title ?? "Navigate"}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${item.label} ${item.href} ${section.title ?? ""}`}
                    onSelect={() => go(item.href, item.label)}
                  >
                    <item.icon className="size-3.5 text-foreground-muted" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div
            className={cn(
              "flex items-center justify-between border-t border-border bg-surface-muted/50 px-3 py-1.5",
            )}
          >
            <p className="text-meta">Search records with 2+ characters</p>
            <p className="text-meta">
              <kbd className="rounded border border-border bg-surface px-1 py-0.5 text-[10px]">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>
              <kbd className="ml-0.5 rounded border border-border bg-surface px-1 py-0.5 text-[10px]">
                K
              </kbd>
            </p>
          </div>
        </Command>
      </ModalContent>
    </Modal>
  );
}
