"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
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
 * Friendly popup when phone/email matches someone already in the CRM.
 * Dismissing keeps a compact reminder so the user can reopen without blocking the form.
 */
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
  const fingerprint = matches.map(duplicateKey).sort().join("|");
  const [open, setOpen] = React.useState(false);
  const [suppressedFor, setSuppressedFor] = React.useState("");

  React.useEffect(() => {
    if (!fingerprint) {
      setOpen(false);
      return;
    }
    if (fingerprint !== suppressedFor) setOpen(true);
  }, [fingerprint, suppressedFor]);

  if (!matches.length) return null;

  const first = matches[0]!;
  const titleName = first.fullName?.trim() || "This person";
  const countLabel =
    matches.length === 1
      ? "We found a possible match"
      : `We found ${matches.length} possible matches`;

  const dismiss = () => {
    setOpen(false);
    setSuppressedFor(fingerprint);
  };

  const confirmAnyway = () => {
    onCreateAnyway();
    setOpen(false);
    setSuppressedFor(fingerprint);
  };

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-start gap-2.5 rounded-2xl border border-warning-border bg-warning-soft px-3.5 py-3 text-left text-cell text-ink",
            "hover:bg-warning-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span className="min-w-0">
            <span className="font-semibold">{countLabel}.</span>{" "}
            <span className="text-ink-secondary">Review before you continue.</span>
          </span>
        </button>
      ) : null}

      <Modal open={open} onOpenChange={(next) => !next && dismiss()}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Already in your CRM?</ModalTitle>
            <ModalDescription>
              <span className="font-medium text-ink">{titleName}</span> looks similar to{" "}
              {matches.length === 1 ? "someone you already have" : "people you already have"}. Check
              before creating a duplicate — you can still continue if this is a different person.
            </ModalDescription>
          </ModalHeader>

          <DuplicateMatchList matches={matches} />

          <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={dismiss} disabled={busy} className="w-full sm:w-auto">
              Keep editing
            </Button>
            <Button
              variant="ghost"
              loading={busy}
              onClick={confirmAnyway}
              className="w-full text-ink-secondary sm:w-auto"
            >
              {actionLabel}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
