"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { formatLeadMoney } from "@/features/leads/lead-format";
import { formatAmount, parseAmount } from "@/features/leads/create/create-lead-schema";
import { crmApi } from "@/lib/api/crm";
import { cn } from "@/lib/utils";

/**
 * Shows the lead’s estimated value and, when allowed, lets the SE update it inline
 * without opening the full edit form.
 */
export function EstimatedValueEditor({
  leadId,
  value,
  currency = "AUD",
  canEdit,
  onSaved,
  compact,
  className,
}: {
  leadId: string;
  value: number | null | undefined;
  currency?: string;
  canEdit?: boolean;
  onSaved?: () => void;
  /** Header-style display (no label). */
  compact?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const startEdit = () => {
    if (!canEdit || saving) return;
    setDraft(value != null ? String(Math.round(value)) : "");
    setEditing(true);
  };

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const cancel = () => {
    if (saving) return;
    setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    const next = draft.trim() === "" ? null : Number(draft);
    if (next != null && (!Number.isFinite(next) || next < 0 || !/^\d{1,13}$/.test(draft.trim()))) {
      toast.error("Enter a whole amount, like 25,000");
      return;
    }
    const prev = value ?? null;
    if (next === prev) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await crmApi.updateLead(leadId, next == null ? { clearValue: true } : { potentialValue: next });
      setEditing(false);
      onSaved?.();
      toast.success(next == null ? "Estimate cleared" : "Estimate updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the estimate.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={cn(compact ? "inline-flex items-center gap-1" : "min-w-0", className)}>
        {!compact ? <p className="text-label">Estimated value</p> : null}
        <div className={cn("flex items-center gap-1", !compact && "mt-0.5")}>
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-caption font-medium text-ink-muted"
            >
              A$
            </span>
            <input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Estimated value"
              disabled={saving}
              value={formatAmount(draft)}
              onChange={(e) => setDraft(parseAmount(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="h-8 w-full min-w-[7.5rem] rounded-md border border-line bg-surface pl-8 pr-2 text-body tabular-nums text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex size-8 items-center justify-center rounded-md text-success hover:bg-success-soft disabled:opacity-50"
            aria-label="Save estimate"
          >
            <Check className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted disabled:opacity-50"
            aria-label="Cancel"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {!compact ? (
          <p className="mt-1 text-[11px] text-ink-muted">Rough estimate — update as you learn more.</p>
        ) : null}
      </div>
    );
  }

  const display =
    value != null ? formatLeadMoney(value, currency) : compact ? "Add estimate" : "No estimate yet";

  if (!canEdit) {
    return compact ? (
      <span className={cn("text-numeral-sm", value == null ? "text-ink-muted" : "text-ink", className)}>
        {display}
      </span>
    ) : (
      <div className={cn("min-w-0", className)}>
        <p className="text-label">Estimated value</p>
        <p className={cn("mt-0.5 truncate text-body", value == null ? "text-ink-muted" : "text-ink")}>{display}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Update estimated value"
      className={cn(
        "group min-w-0 text-left transition-colors",
        compact
          ? "inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 hover:bg-surface-muted"
          : "rounded-md hover:bg-surface-muted/60",
        className,
      )}
    >
      {!compact ? <p className="text-label">Estimated value</p> : null}
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1",
          compact ? "text-numeral-sm" : "mt-0.5 text-body",
          value == null ? "text-ink-muted" : "text-ink",
        )}
      >
        <span className="truncate font-medium tabular-nums">{display}</span>
        <Pencil
          className="size-3 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      </span>
      {!compact ? (
        <span className="mt-0.5 block text-[11px] text-ink-muted">Click to update · rough estimate</span>
      ) : null}
    </button>
  );
}
