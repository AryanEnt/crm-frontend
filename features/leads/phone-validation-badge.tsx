"use client";

import { AlertTriangle, CheckCircle2, Copy, Loader2, ShieldAlert } from "lucide-react";
import type { Lead } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

type Status = NonNullable<Lead["phoneValidationStatus"]>;

const LABELS: Record<Status, string> = {
  valid: "Verified",
  pending: "Checking",
  invalid: "Invalid",
  duplicate: "Duplicate",
  invalid_duplicate: "Invalid · duplicate",
  needs_review: "Needs review",
};

/** Short chip copy for dense tables. */
const SHORT: Record<Status, string> = {
  valid: "OK",
  pending: "…",
  invalid: "Invalid",
  duplicate: "Dup",
  invalid_duplicate: "Bad · dup",
  needs_review: "Review",
};

const TONES: Record<Status, string> = {
  valid: "bg-success-soft text-success ring-success/25",
  pending: "bg-surface-muted text-ink-muted ring-line",
  invalid: "bg-danger-soft text-danger ring-danger/25",
  duplicate: "bg-warning-soft text-warning ring-warning/30",
  invalid_duplicate: "bg-danger-soft text-danger ring-danger/25",
  needs_review: "bg-warning-soft text-warning ring-warning/30",
};

const ICONS: Record<Status, typeof AlertTriangle> = {
  valid: CheckCircle2,
  pending: Loader2,
  invalid: AlertTriangle,
  duplicate: Copy,
  invalid_duplicate: ShieldAlert,
  needs_review: AlertTriangle,
};

export function phoneValidationLabel(status: Status | undefined | null): string | null {
  if (!status) return null;
  return LABELS[status] ?? status;
}

type LeadPhone = Pick<
  Lead,
  "phone" | "phoneValidationStatus" | "phoneValidationMessage" | "phoneDuplicateLeads"
>;

/**
 * Compact status for list/detail. Hidden when there is no phone, or when valid
 * unless `showWhenValid` is set.
 */
export function PhoneValidationBadge({
  lead,
  className,
  showWhenValid = false,
  compact = false,
}: {
  lead: LeadPhone;
  className?: string;
  showWhenValid?: boolean;
  /** Icon + short label for table cells. */
  compact?: boolean;
}) {
  if (!lead.phone?.trim()) return null;
  const status = lead.phoneValidationStatus ?? "pending";
  if (status === "valid" && !showWhenValid) return null;

  const Icon = ICONS[status];
  const label = compact ? SHORT[status] : LABELS[status];
  const title = lead.phoneValidationMessage || LABELS[status];

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-md font-medium ring-1 ring-inset",
        compact ? "px-1.5 py-px text-[0.625rem] leading-4" : "px-1.5 py-0.5 text-caption",
        TONES[status],
        className,
      )}
      title={title}
    >
      <Icon
        className={cn("shrink-0", compact ? "size-2.5" : "size-3", status === "pending" && "animate-spin")}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Neat callout under Contact in the lead drawer — one message, optional matches. */
export function PhoneValidationDetail({
  lead,
  onEditPhone,
}: {
  lead: Lead;
  onEditPhone?: () => void;
}) {
  if (!lead.phone?.trim()) return null;
  const status = lead.phoneValidationStatus ?? "pending";
  if (status === "valid" || status === "pending") return null;

  const dups = lead.phoneDuplicateLeads ?? [];
  const message =
    lead.phoneValidationMessage?.trim() ||
    (status === "duplicate" || status === "invalid_duplicate"
      ? "This number is already on another lead."
      : status === "invalid"
        ? "This number doesn’t look valid. Check the country code and digits."
        : "Review this number before calling.");

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3",
        status === "invalid" || status === "invalid_duplicate"
          ? "border-danger/25 bg-danger-soft/35"
          : "border-warning/30 bg-warning-soft/40",
      )}
    >
      <div className="flex items-start gap-2.5">
        <PhoneValidationBadge lead={lead} showWhenValid className="mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-caption text-ink-secondary">{message}</p>
          {dups.length > 0 ? (
            <p className="text-caption text-ink-muted">
              Also on{" "}
              {dups.map((d, i) => (
                <span key={d.id}>
                  {i > 0 ? ", " : null}
                  <a
                    href={`/leads?leadId=${encodeURIComponent(d.id)}`}
                    className="font-medium text-brand hover:underline"
                  >
                    {d.fullName || "another lead"}
                  </a>
                </span>
              ))}
              .
            </p>
          ) : null}
          {onEditPhone ? (
            <button
              type="button"
              className="text-caption font-medium text-brand hover:underline"
              onClick={onEditPhone}
            >
              Edit phone number
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
