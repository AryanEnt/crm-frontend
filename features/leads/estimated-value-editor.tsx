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
  quiet,
  prominent,
  className,
}: {
  leadId: string;
  value: number | null | undefined;
  currency?: string;
  canEdit?: boolean;
  onSaved?: () => void;
  /** Header-style display (no label). */
  compact?: boolean;
  /** Hide the “click to edit” hint under the value. */
  quiet?: boolean;
  /** Large, easy-to-spot value block for the lead drawer header. */
  prominent?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const symbol = currencySymbol(currency);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!canEdit || saving) return;
    setDraft(localValue != null ? String(Math.round(localValue)) : "");
    setEditing(true);
  };

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
    const prev = localValue ?? null;
    if (next === prev) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await crmApi.updateLead(leadId, next == null ? { clearValue: true } : { potentialValue: next });
      setLocalValue(next);
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
      <div
        className={cn(compact ? "inline-flex items-center gap-1" : "min-w-0 w-full", className)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {prominent ? (
          <p className="text-caption font-medium text-ink-muted">Estimated value</p>
        ) : !compact ? (
          <p className="text-label">Estimated value</p>
        ) : null}
        <div className={cn("flex items-center gap-1.5", (prominent || !compact) && "mt-1")}>
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-ink-muted",
                prominent ? "text-body" : "text-caption",
              )}
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
              className={cn(
                "w-full border border-brand/35 bg-surface tabular-nums text-ink outline-none ring-2 ring-brand/15 focus-visible:border-brand",
                prominent
                  ? "h-11 rounded-lg pl-8 pr-3 text-lg font-semibold"
                  : "h-8 min-w-[7.5rem] rounded-md pl-7 pr-2 text-body",
              )}
            />
          </div>
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void save()}
            className={cn(
              "inline-flex items-center justify-center rounded-md bg-success-soft text-success hover:bg-success/15 disabled:opacity-50",
              prominent ? "size-11" : "size-7",
            )}
            aria-label="Save estimate"
          >
            <Check className={prominent ? "size-4" : "size-3.5"} aria-hidden />
          </button>
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            className={cn(
              "inline-flex items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted disabled:opacity-50",
              prominent ? "size-11" : "size-7",
            )}
            aria-label="Cancel"
          >
            <X className={prominent ? "size-4" : "size-3.5"} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const display = localValue != null ? formatLeadMoney(localValue, currency) : "Add estimate";
  const empty = localValue == null;

  if (!canEdit) {
    if (prominent) {
      return (
        <div className={cn("min-w-0", className)}>
          <p className="text-caption font-medium text-ink-muted">Estimated value</p>
          <p className={cn("mt-0.5 text-lg font-semibold tabular-nums tracking-tight", empty ? "text-ink-muted" : "text-ink")}>
            {empty ? "—" : display}
          </p>
        </div>
      );
    }
    return compact ? (
      <span className={cn("text-body font-semibold tabular-nums", empty ? "text-ink-muted" : "text-ink", className)}>
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

  if (prominent) {
    return (
      <button
        type="button"
        onClick={startEdit}
        onPointerDown={(e) => e.stopPropagation()}
        title="Update estimated value"
        aria-label={`Estimated value ${display}. Click to edit`}
        className={cn(
          "group flex w-full items-end justify-between gap-3 text-left",
          "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="min-w-0">
          <span className="block text-caption font-medium text-ink-muted">Estimated value</span>
          <span
            className={cn(
              "mt-0.5 block text-lg font-semibold tabular-nums tracking-tight",
              empty ? "text-ink-muted" : "text-ink",
            )}
          >
            {display}
          </span>
          <span className="mt-1 block text-[11px] text-ink-muted group-hover:text-ink-secondary">
            Click to edit
          </span>
        </span>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition-colors group-hover:border-brand/40 group-hover:bg-brand-soft group-hover:text-brand">
          <Pencil className="size-3.5" aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      onPointerDown={(e) => e.stopPropagation()}
      title="Update estimated value"
      aria-label={`Estimated value ${display}. Click to edit`}
      className={cn(
        "group min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "inline-flex rounded-md px-1.5 py-0.5 hover:bg-surface-muted" : "w-full",
        className,
      )}
    >
      {!compact ? <p className="text-label">Estimated value</p> : null}
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 transition-colors",
          !compact && "mt-0.5 rounded-full border px-2 py-0.5",
          !compact &&
            (empty
              ? "border-dashed border-line text-ink-muted group-hover:border-brand/40 group-hover:bg-brand-soft/50 group-hover:text-brand-ink"
              : "border-line/80 bg-surface text-ink group-hover:border-brand/35 group-hover:bg-brand-soft/40"),
          compact && (empty ? "text-ink-muted" : "text-ink"),
        )}
      >
        <span className="truncate text-body font-semibold tabular-nums">{display}</span>
        <Pencil
          className={cn(
            "shrink-0 text-ink-muted transition-colors group-hover:text-brand",
            compact ? "size-3" : "size-3.5",
          )}
          aria-hidden
        />
      </span>
      {!compact && !quiet ? (
        <span className="mt-1 block text-[11px] text-ink-muted transition-colors group-hover:text-ink-secondary">
          Click to edit
        </span>
      ) : null}
    </button>
  );
}
