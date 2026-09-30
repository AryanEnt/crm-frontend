"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

/**
 * Table cell that edits one field in place. The cell's normal display is the trigger,
 * so the table reads the same whether or not the viewer can edit.
 */
export function InlineSelectCell({
  label,
  value,
  options,
  onSave,
  disabled = false,
  loading = false,
  children,
}: {
  /** Lower-case field name, used in the accessible label and error toast, e.g. "priority". */
  label: string;
  value: string | null | undefined;
  options: ComboboxOption[];
  /** Resolve after the change is saved and the list has refreshed; reject to show the error. */
  onSave: (value: string) => Promise<unknown>;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [saving, setSaving] = React.useState(false);

  if (disabled) return <>{children}</>;

  const current = options.find((o) => o.value === value)?.label;

  async function handleChange(next: string | null) {
    if (!next || next === value) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : `Couldn't change the ${label}. Try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Combobox
      options={options}
      value={value}
      onChange={(next) => void handleChange(next)}
      loading={loading}
      searchPlaceholder={`Find ${label}…`}
      className="max-w-full"
      renderTrigger={() => (
        <button
          type="button"
          disabled={saving}
          aria-busy={saving || undefined}
          aria-label={`Change ${label}${current ? `, currently ${current}` : ""}`}
          className={cn(
            "group/inline -mx-1.5 inline-flex max-w-full items-center gap-1 rounded-control px-1.5 py-0.5 text-left",
            "transition-colors duration-100 hover:bg-surface-muted data-[state=open]:bg-surface-muted",
            "disabled:cursor-progress",
          )}
        >
          <span className="flex min-w-0 items-center">{children}</span>
          {saving ? (
            <Loader2 aria-hidden className="size-3 shrink-0 animate-spin text-ink-muted" />
          ) : (
            <ChevronDown
              aria-hidden
              className="size-3 shrink-0 text-ink-muted opacity-0 pointer-coarse:opacity-60 transition-opacity duration-100 group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100 group-data-[state=open]/inline:opacity-100"
            />
          )}
        </button>
      )}
    />
  );
}
