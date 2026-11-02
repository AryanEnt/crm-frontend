import type { Lead } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

type Status = NonNullable<Lead["phoneValidationStatus"]>;

const LABELS: Record<Status, string> = {
  valid: "Verified",
  pending: "Checking",
  invalid: "Invalid number",
  duplicate: "Duplicate number",
  invalid_duplicate: "Invalid & duplicate",
  needs_review: "Needs review",
};

const TONES: Record<Status, string> = {
  valid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-surface-muted text-ink-secondary ring-line",
  invalid: "bg-red-50 text-red-800 ring-red-200",
  duplicate: "bg-orange-50 text-orange-900 ring-orange-200",
  invalid_duplicate: "bg-red-50 text-red-800 ring-red-200",
  needs_review: "bg-amber-50 text-amber-900 ring-amber-200",
};

export function phoneValidationLabel(status: Status | undefined | null): string | null {
  if (!status) return null;
  return LABELS[status] ?? status;
}

/** Compact status chip for list/detail. Hidden when there is no phone to validate. */
export function PhoneValidationBadge({
  lead,
  className,
  showWhenValid = false,
}: {
  lead: Pick<Lead, "phone" | "phoneValidationStatus" | "phoneValidationMessage" | "phoneDuplicateLeads">;
  className?: string;
  showWhenValid?: boolean;
}) {
  if (!lead.phone?.trim()) return null;
  const status = lead.phoneValidationStatus ?? "pending";
  if (status === "valid" && !showWhenValid) return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-meta font-medium ring-1 ring-inset",
        TONES[status],
        className,
      )}
      title={lead.phoneValidationMessage || LABELS[status]}
    >
      {LABELS[status]}
    </span>
  );
}

export function PhoneValidationDetail({
  lead,
  onEditPhone,
}: {
  lead: Lead;
  onEditPhone?: () => void;
}) {
  if (!lead.phone?.trim()) return null;
  const status = lead.phoneValidationStatus ?? "pending";
  if (status === "valid") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <PhoneValidationBadge lead={lead} showWhenValid />
      </div>
    );
  }

  const dups = lead.phoneDuplicateLeads ?? [];
  return (
    <div className="space-y-1.5 rounded-md border border-line bg-surface-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <PhoneValidationBadge lead={lead} showWhenValid />
        {onEditPhone ? (
          <button type="button" className="text-meta font-medium text-brand hover:underline" onClick={onEditPhone}>
            Edit phone number
          </button>
        ) : null}
      </div>
      {lead.phoneValidationMessage ? (
        <p className="text-caption text-ink-secondary">{lead.phoneValidationMessage}</p>
      ) : status === "duplicate" || status === "invalid_duplicate" ? (
        <p className="text-caption text-ink-secondary">
          Duplicate number detected. This number is also used by another lead.
        </p>
      ) : null}
      {dups.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption">
          {dups.map((d) => (
            <li key={d.id}>
              <a
                href={`/leads?leadId=${encodeURIComponent(d.id)}`}
                className="font-medium text-brand hover:underline"
              >
                {d.fullName || "Matching lead"}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
