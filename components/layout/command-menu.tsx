"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock, UserPlus } from "lucide-react";
import { getNavForRole } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";
import { CommandPalette, Kbd, type CommandGroup } from "@/components/ui/console/command-palette";

const RECENT_KEY = "aurora.cmd.recent";
const MAX_RECENT = 6;

type RecentItem = { href: string; label: string; at: number };
type QuickCreateEntity = "lead" | "activity";

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
  const next = [{ ...item, at: Date.now() }, ...readRecent().filter((r) => r.href !== item.href)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const subscribeNoop = () => () => {};

/** "⌘" on Apple platforms, "Ctrl" elsewhere; stable during hydration. */
export function useModKey() {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

export type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickCreate?: (entity: QuickCreateEntity) => void;
};

/** Global ⌘K / Ctrl K palette. Remount (via `key`) per opening to reset the query. */
export function CommandMenu({ open, onOpenChange, onQuickCreate }: CommandMenuProps) {
  const router = useRouter();
  const { user, can, permissions } = useAuth();
  const modKey = useModKey();
  const [query, setQuery] = React.useState("");
  const [recent] = React.useState(readRecent);
  const debounced = useDebounced(query.trim(), 220);
  const searchEnabled = debounced.length >= 2;

  const leadsQuery = useQuery({
    queryKey: ["cmdk-leads", debounced],
    queryFn: () =>
      crmApi.listLeads(new URLSearchParams({ q: debounced, status: "all", limit: "8", offset: "0" })),
    enabled: open && searchEnabled && can("leads:view"),
  });

  const go = (href: string, label: string) => {
    pushRecent({ href, label });
    onOpenChange(false);
    router.push(href);
  };

  const groups: CommandGroup[] = [];

  if (!searchEnabled && onQuickCreate) {
    const createActions = (
      [
        { id: "lead", label: "New lead", icon: UserPlus, perm: "leads:create" },
        { id: "activity", label: "New activity", icon: CalendarPlus, perm: "activities:create" },
      ] as const
    ).filter((action) => can(action.perm));
    if (createActions.length > 0) {
      groups.push({
        id: "create",
        heading: "Quick create",
        items: createActions.map((action) => ({
          id: `create-${action.id}`,
          label: action.label,
          icon: action.icon,
          keywords: "create add",
          hint: action.id === "lead" ? <Kbd>C</Kbd> : undefined,
          onSelect: () => {
            onOpenChange(false);
            onQuickCreate(action.id);
          },
        })),
      });
    }
  }

  if (!searchEnabled && recent.length > 0) {
    groups.push({
      id: "recent",
      heading: "Recent",
      items: recent.map((item) => ({
        id: `recent-${item.href}`,
        label: item.label,
        icon: Clock,
        keywords: item.href,
        onSelect: () => go(item.href, item.label),
      })),
    });
  }

  if (searchEnabled) {
    const leads = leadsQuery.data?.data ?? [];
    if (leads.length) {
      groups.push({
        id: "leads",
        heading: "Leads",
        filter: false,
        items: leads.map((lead) => ({
          id: `lead-${lead.id}`,
          label: lead.fullName,
          icon: UserPlus,
          hint: [lead.stageName, lead.employer || lead.email].filter(Boolean).join(" · "),
          onSelect: () => go(`/leads?leadId=${encodeURIComponent(lead.id)}`, lead.fullName),
        })),
      });
    }
  }

  getNavForRole(user?.roleCode).forEach((section, index) => {
    const items = section.items.filter((item) => canAccessPath(permissions, item.href.split("?")[0]));
    if (items.length === 0) return;
    groups.push({
      id: `nav-${index}`,
      heading: section.title ?? "Navigate",
      items: items.map((item) => ({
        id: `nav-${item.href}-${item.label}`,
        label: item.label,
        icon: item.icon,
        keywords: `${item.href} ${section.title ?? ""}`,
        onSelect: () => go(item.href, item.label),
      })),
    });
  });

  const searching = searchEnabled && leadsQuery.isFetching;

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      label="Search or jump to"
      placeholder="Jump to a page, or search leads…"
      loading={searching}
      emptyText={searching ? "Searching…" : "No matches. Try a different name or page."}
      footer={
        <>
          <span>Search records with 2+ characters</span>
          <span className="hidden items-center gap-3 sm:flex">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> to open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>{modKey}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </span>
        </>
      }
    />
  );
}
