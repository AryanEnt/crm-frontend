"use client";

import * as React from "react";
import { Loader2, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal, useDismiss, useFocusTrap, useLayer, usePresence, useScrollLock } from "./overlay";

export type CommandItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Right-aligned secondary text or shortcut. */
  hint?: React.ReactNode;
  /** Extra text matched by the filter but not displayed. */
  keywords?: string;
  onSelect: () => void;
};

export type CommandGroup = {
  id: string;
  heading: string;
  items: CommandItem[];
  /** Set false for results that are already filtered (e.g. server search). */
  filter?: boolean;
};

function matches(item: CommandItem, tokens: string[]) {
  const haystack = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandGroup[];
  placeholder?: string;
  emptyText?: React.ReactNode;
  loading?: boolean;
  footer?: React.ReactNode;
  label?: string;
};

/**
 * Modal combobox: focus stays in the input while ↑/↓ move the active option
 * (aria-activedescendant), Enter runs it and Escape closes.
 */
export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  placeholder = "Type a command or search…",
  emptyText = "No results.",
  loading = false,
  footer,
  label = "Command menu",
}: CommandPaletteProps) {
  const { mounted, state } = usePresence(open, 150);
  const isTop = useLayer(open);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const baseId = React.useId();
  const listId = `${baseId}-list`;
  const [activeId, setActiveId] = React.useState<string | null>(null);

  useFocusTrap(panelRef, { active: open, isTop, initialFocusRef: inputRef });
  useScrollLock(open);
  useDismiss({
    active: open,
    isTop,
    outsidePointer: false,
    insideRefs: [panelRef],
    onDismiss: () => onOpenChange(false),
  });

  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = groups
    .map((group) => ({
      ...group,
      items: group.filter === false || tokens.length === 0 ? group.items : group.items.filter((i) => matches(i, tokens)),
    }))
    .filter((group) => group.items.length > 0);
  const flat = visible.flatMap((group) => group.items);
  const active = flat.find((item) => item.id === activeId) ?? flat[0];
  const optionId = (item: CommandItem) => `${baseId}-opt-${item.id}`;
  const activeOptionId = active ? optionId(active) : undefined;

  React.useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  const move = (delta: number) => {
    if (flat.length === 0 || !active) return;
    const index = flat.indexOf(active);
    setActiveId(flat[(index + delta + flat.length) % flat.length]?.id ?? null);
  };

  if (!mounted) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
        <div
          aria-hidden
          data-state={state}
          onPointerDown={() => {
            if (isTop()) onOpenChange(false);
          }}
          className="absolute inset-0 bg-overlay transition-opacity duration-150 ease-standard starting:opacity-0 data-[state=closed]:opacity-0"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          data-state={state}
          className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-md transition-[opacity,scale] duration-150 ease-standard starting:scale-[0.98] starting:opacity-0 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
        >
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search aria-hidden className="size-4 shrink-0 text-ink-muted" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-label={label}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setActiveId(null);
                onQueryChange(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  active?.onSelect();
                }
              }}
              className="h-12 min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
            />
            {loading ? (
              <Loader2 aria-label="Searching" className="size-4 shrink-0 animate-spin text-ink-muted" />
            ) : (
              <kbd className="hidden rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-sans text-caption text-ink-muted sm:inline">
                Esc
              </kbd>
            )}
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={label}
            className="crm-scroll max-h-[min(420px,60vh)] overflow-y-auto p-1.5"
          >
            {visible.length === 0 ? (
              <p className="px-3 py-10 text-center text-body text-ink-muted">{emptyText}</p>
            ) : (
              visible.map((group) => {
                const headingId = `${baseId}-group-${group.id}`;
                return (
                  <div key={group.id} role="group" aria-labelledby={headingId} className="pb-1">
                    <div id={headingId} className="px-2.5 pb-1 pt-2 text-overline text-ink-muted">
                      {group.heading}
                    </div>
                    {group.items.map((item) => {
                      const isActive = item === active;
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          id={optionId(item)}
                          role="option"
                          aria-selected={isActive}
                          onPointerMove={() => {
                            if (!isActive) setActiveId(item.id);
                          }}
                          onClick={item.onSelect}
                          className={cn(
                            "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-cell text-ink transition-colors duration-100",
                            isActive && "bg-surface-muted",
                          )}
                        >
                          {Icon ? (
                            <Icon
                              aria-hidden
                              className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-ink-muted")}
                            />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.hint ? (
                            <span className="ml-3 max-w-[45%] shrink-0 truncate text-caption text-ink-muted">
                              {item.hint}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {footer ? (
            <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-sunken px-4 py-2 text-caption text-ink-muted">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface px-1 font-sans text-caption text-ink-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
