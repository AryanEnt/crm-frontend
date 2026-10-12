"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccordionSection<T extends string> = {
  id: T;
  title: string;
  emoji: string;
  /** One line shown under the title once something in the section is filled. */
  summary?: string;
  /** Shown instead of the summary while the section is empty. */
  placeholder: string;
  invalid?: boolean;
  content: React.ReactNode;
};

/**
 * Collapsed sections stay mounted (so their values and pickers keep state) but are
 * `inert`, which keeps them out of the tab order and away from screen readers.
 */
export function MoreDetailsAccordion<T extends string>({
  sections,
  open,
  onToggle,
}: {
  sections: AccordionSection<T>[];
  open: ReadonlySet<T>;
  onToggle: (id: T) => void;
}) {
  const baseId = React.useId();
  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-2.5">
      <h3 id={`${baseId}-heading`} className="flex items-baseline gap-1.5 text-cell font-semibold text-ink">
        More details
        <span className="font-normal text-ink-muted">optional, add now or later</span>
      </h3>
      <div className="flex flex-col gap-2">
        {sections.map((s) => {
          const expanded = open.has(s.id);
          const panelId = `${baseId}-${s.id}-panel`;
          const buttonId = `${baseId}-${s.id}-button`;
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl border transition-colors duration-150",
                expanded ? "border-line bg-surface" : "border-transparent bg-surface-muted/70",
                s.invalid && "border-danger",
              )}
            >
              <h4>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => onToggle(s.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-base shadow-xs"
                  >
                    {s.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{s.title}</span>
                    <span
                      className={cn(
                        "block truncate text-caption",
                        s.invalid ? "text-danger" : s.summary ? "text-brand-ink" : "text-ink-muted",
                      )}
                    >
                      {s.invalid ? "Something here needs a fix" : (s.summary ?? s.placeholder)}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-standard motion-reduce:transition-none",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              </h4>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-standard motion-reduce:transition-none",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  inert={!expanded}
                  className="min-h-0 overflow-hidden"
                >
                  <div className="flex flex-col gap-4 px-3.5 pb-4 pt-2">{s.content}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
