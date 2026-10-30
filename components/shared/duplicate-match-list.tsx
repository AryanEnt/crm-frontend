"use client";

import { ExternalLink } from "lucide-react";
import type { DuplicateMatch } from "@/lib/api/crm";

export const duplicateMatchKey = (m: DuplicateMatch) => `${m.entity}:${m.id}`;

export function matchedOn(reason: string) {
  const r = reason.toLowerCase();
  if (r.includes("email") && r.includes("phone")) return "Same phone and email";
  if (r.includes("email")) return "Same email";
  if (r.includes("phone")) return "Same phone";
  return reason.trim() || null;
}

export function entityLabel(entity: string) {
  if (entity === "lead") return "Lead in pipeline";
  if (entity === "customer") return "Customer";
  return entity;
}

export function DuplicateMatchList({ matches }: { matches: DuplicateMatch[] }) {
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {matches.map((m) => {
        const why = matchedOn(m.reason);
        const isLead = m.entity === "lead";
        const contact = [m.phone, m.email].filter(Boolean).join(" · ");
        return (
          <li
            key={duplicateMatchKey(m)}
            className="rounded-xl border border-border bg-surface-muted/40 px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{m.fullName}</p>
                <p className="mt-0.5 text-[11px] text-foreground-muted">
                  {entityLabel(m.entity)}
                  {why ? ` · ${why}` : ""}
                </p>
                {contact ? (
                  <p className="mt-1 truncate text-[11px] text-foreground-muted">{contact}</p>
                ) : null}
              </div>
              {isLead ? (
                <a
                  href={`/leads?leadId=${encodeURIComponent(m.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-brand-ink hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View
                  <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
