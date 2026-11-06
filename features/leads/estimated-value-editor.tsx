"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { formatLeadMoney } from "@/features/leads/lead-format";
import { formatAmount, parseAmount } from "@/features/leads/create/create-lead-schema";
import { currencySymbol } from "@/features/pipeline/pipeline-format";
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
  const symbol = currencySymbol(currency);

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
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-caption font-medium text-ink-muted"
            >
              {symbol}
            </span>
            <input
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Estimated value"
              disabled={saving}
              value={formatAmount(draft)}
              onChange={(e) => setDraft(parseAmount(e.target.value))}
              onBlur={() => {
                if (!saving) void save();
              }}
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
              className="h-8 w-full min-w-[7.5rem] rounded-full border border-brand/35 bg-surface pl-7 pr-2 text-body tabular-nums text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none ring-2 ring-brand/15 focus-visible:border-brand"
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void save()}
            className="inline-flex size-7 items-center justify-center rounded-full bg-success-soft text-success hover:bg-success/15 disabled:opacity-50"
            aria-label="Save estimate"
          >
            <Check className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted disabled:opacity-50"
            aria-label="Cancel"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const display =
    value != null ? formatLeadMoney(value, currency) : compact ? "Add estimate" : "Add estimate";
  const empty = value == null;

  if (!canEdit) {
    return compact ? (
      <span className={cn("text-numeral-sm", empty ? "text-ink-muted" : "text-ink", className)}>
        {empty ? "—" : display}
      </span>
    ) : (
      <div className={cn("min-w-0", className)}>
        <p className="text-label">Estimated value</p>
        <p className={cn("mt-0.5 truncate text-body", empty ? "text-ink-muted" : "text-ink")}>
          {empty ? "—" : display}
        </p>
      </div>
    );
  }

  const valueChip = (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 transition-colors",
        empty
          ? "border-dashed border-line text-ink-muted group-hover:border-brand/40 group-hover:bg-brand-soft/50 group-hover:text-brand-ink"
          : "border-line/80 bg-surface text-ink group-hover:border-brand/35 group-hover:bg-brand-soft/40",
      )}
    >
      <span
        className={cn(
          "truncate tabular-nums",
          compact ? "text-numeral-sm font-medium" : "text-body font-semibold",
        )}
      >
        {display}
      </span>
      <Pencil
        className={cn(
          "shrink-0 text-ink-muted transition-colors group-hover:text-brand",
          compact ? "size-3" : "size-3.5",
        )}
        aria-hidden
      />
    </span>
  );

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Update estimated value"
      aria-label={`Estimated value ${display}. Click to edit`}
      className={cn(
        "group min-w-0 text-left focus-visible:outline-none",
        compact ? "inline-flex" : "w-full",
        className,
      )}
    >
      {!compact ? <p className="text-label">Estimated value</p> : null}
      <span className={cn("inline-flex", !compact && "mt-0.5")}>{valueChip}</span>
      {!compact ? (
        <span className="mt-1 block text-[11px] text-ink-muted transition-colors group-hover:text-ink-secondary">
          Rough estimate · click to edit
        </span>
      ) : null}
    </button>
  );
}
