"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DuplicateMatchList } from "@/components/shared/duplicate-match-list";
import { crmApi, type DuplicateMatch } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
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

/**
 * Inline duplicate warning under email/phone in the create/edit lead form.
 * Stays inside the sheet — no app-level modal overlay.
 */
export function DuplicateNotice({
  matches,
  onCreateAnyway,
  busy,
  editing = false,
  actionLabel,
}: {
  matches: DuplicateMatch[];
  onCreateAnyway: () => void;
  busy?: boolean;
  editing?: boolean;
  actionLabel?: string;
}) {
  const fingerprint = matches.map(duplicateKey).sort().join("|");
  const [dismissedFor, setDismissedFor] = React.useState("");
  const [reopened, setReopened] = React.useState(false);
  const [seenFingerprint, setSeenFingerprint] = React.useState(fingerprint);

  if (seenFingerprint !== fingerprint) {
    setSeenFingerprint(fingerprint);
    setReopened(false);
  }

  const open = Boolean(fingerprint) && (reopened || fingerprint !== dismissedFor);
  const continueLabel = actionLabel ?? (editing ? "Save anyway" : "Create anyway");

  if (!matches.length) return null;

  const first = matches[0]!;
  const titleName = first.fullName?.trim() || "This person";
  const emailMatch = matches.some((m) => m.reason.toLowerCase().includes("email"));
  const title = editing ? "Email already in use" : "Possible duplicate";
  const countLabel =
    matches.length === 1
      ? emailMatch
        ? "This email is already on another record"
        : "We found a possible match"
      : `We found ${matches.length} possible matches`;

  const dismiss = () => {
    setReopened(false);
    setDismissedFor(fingerprint);
  };

  const confirmAnyway = () => {
    setReopened(false);
    setDismissedFor(fingerprint);
    onCreateAnyway();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className={cn(
          "flex w-full items-start gap-2.5 rounded-2xl border border-warning-border bg-warning-soft px-3.5 py-3 text-left text-cell text-ink",
          "hover:bg-warning-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <span className="min-w-0">
          <span className="font-semibold">{countLabel}.</span>{" "}
          <span className="text-ink-secondary">Review matches, or continue if this is intentional.</span>
        </span>
      </button>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-warning-border bg-warning-soft/70 p-3.5 shadow-xs"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
          <Users aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-caption text-ink-secondary">
                <span className="font-medium text-ink">{titleName}</span>
                {emailMatch
                  ? " already uses this email. Open the existing record if it is the same person, or continue if you still need a separate lead."
                  : matches.length === 1
                    ? " looks similar to someone you already have. Check before continuing."
                    : " looks similar to people you already have. Check before continuing."}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Dismiss duplicate warning"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>

          <div className="mt-3">
            <DuplicateMatchList matches={matches} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={dismiss} disabled={busy}>
              Keep editing
            </Button>
            <Button size="sm" loading={busy} onClick={confirmAnyway}>
              {continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
