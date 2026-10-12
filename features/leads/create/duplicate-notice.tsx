"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Info } from "lucide-react";
import { crmApi, type DuplicateMatch } from "@/lib/api/crm";
import { isValidEmail } from "./create-lead-schema";
import { formatPhone, phoneLengthIssue, phoneVariants } from "./phone";

export const duplicateKey = (m: DuplicateMatch) => `${m.entity}:${m.id}`;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Looks up existing leads and customers once a valid phone or email is typed. The API
 * matches phones exactly, so every common stored form of the number is checked.
 */
export function useDuplicateCheck({
  phone,
  phoneCountry,
  email,
  enabled,
  excludeId,
}: {
  phone: string;
  phoneCountry: string;
  email: string;
  enabled: boolean;
  /** The lead being edited, so it never matches itself. */
  excludeId?: string;
}): DuplicateMatch[] {
  const key = React.useMemo(() => {
    const lookups: { email?: string; phone?: string }[] = [];
    if (isValidEmail(email)) lookups.push({ email: email.trim().toLowerCase() });
    if (phone.trim() && !phoneLengthIssue(phone, phoneCountry)) {
      const variants = new Set([...phoneVariants(phone, phoneCountry), formatPhone(phone, phoneCountry)]);
      for (const v of variants) if (v) lookups.push({ phone: v });
    }
    return JSON.stringify(lookups);
  }, [email, phone, phoneCountry]);
  const settled = useDebounced(key, 500);

  const query = useQuery({
    queryKey: ["lead-duplicates", settled, excludeId ?? ""],
    queryFn: async ({ signal }) => {
      const lookups = JSON.parse(settled) as { email?: string; phone?: string }[];
      const results = await Promise.allSettled(
        lookups.map((body) => crmApi.checkLeadDuplicates(body, signal, excludeId)),
      );
      const merged = new Map<string, DuplicateMatch>();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const m of r.value ?? []) if (!merged.has(duplicateKey(m))) merged.set(duplicateKey(m), m);
      }
      return [...merged.values()];
    },
    enabled: enabled && settled !== "[]",
    staleTime: 30_000,
    retry: false,
  });

  // Matches for numbers the user has since changed would be misleading, so wait for the new lookup.
  if (!enabled || key === "[]" || key !== settled) return [];
  return query.data ?? [];
}

function matchedOn(reason: string) {
  const r = reason.toLowerCase();
  if (r.includes("email") && r.includes("phone")) return "Same phone and email";
  if (r.includes("email")) return "Same email";
  if (r.includes("phone")) return "Same phone";
  return null;
}

export function DuplicateNotice({
  matches,
  onCreateAnyway,
  busy,
  actionLabel = "Create anyway",
}: {
  matches: DuplicateMatch[];
  onCreateAnyway: () => void;
  busy?: boolean;
  actionLabel?: string;
}) {
  const first = matches[0];
  if (!first) return null;
  const isLead = first.entity === "lead";
  const others = matches.length - 1;
  const why = matchedOn(first.reason);

  return (
    <div role="status" className="flex gap-2.5 rounded-2xl bg-warning-soft px-3.5 py-3 text-cell text-ink">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p>
          Looks like <span className="font-semibold">{first.fullName}</span>{" "}
          {isLead ? "is already in your pipeline." : "is already a customer."}
          {others > 0 ? (
            <span className="text-ink-secondary">
              {" "}
              {others === 1 ? "There's 1 other possible match." : `There are ${others} other possible matches.`}
            </span>
          ) : null}
        </p>
        {why ? <p className="text-caption text-ink-muted">{why}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {isLead ? (
            <a
              href={`/leads?leadId=${encodeURIComponent(first.id)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm font-medium text-brand-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View lead
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={onCreateAnyway}
            disabled={busy}
            className="rounded-sm font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
