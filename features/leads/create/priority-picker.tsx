"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CREATE_LEAD_PRIORITIES, type CreateLeadPriority } from "./create-lead-schema";
import { CHIP, useRovingRadio } from "./field-ui";

/** Restrained temperature chips — soft tint at rest, solid brand-adjacent fill when selected. */
const PRIORITY_STYLE: Record<
  CreateLeadPriority,
  { label: string; idle: string; active: string }
> = {
  low: {
    label: "Low",
    idle: "border-line/80 bg-surface text-ink-secondary hover:border-success/40 hover:text-success",
    active: "border-success/50 bg-success-soft text-success",
  },
  medium: {
    label: "Medium",
    idle: "border-line/80 bg-surface text-ink-secondary hover:border-warning/40 hover:text-warning",
    active: "border-warning/50 bg-warning-soft text-warning",
  },
  high: {
    label: "High",
    idle: "border-line/80 bg-surface text-ink-secondary hover:border-danger/40 hover:text-danger",
    active: "border-danger/50 bg-danger-soft text-danger",
  },
  urgent: {
    label: "Urgent",
    idle: "border-line/80 bg-surface text-ink-secondary hover:border-danger/40 hover:text-danger",
    active: "border-danger/60 bg-danger-soft text-danger ring-1 ring-danger/25",
  },
};

const WITH_URGENT = [...CREATE_LEAD_PRIORITIES, "urgent"] as const;

export function PriorityPicker({
  value,
  onChange,
  labelId,
}: {
  value: CreateLeadPriority;
  onChange: (value: CreateLeadPriority) => void;
  labelId: string;
}) {
  // Urgent isn't offered for new leads, but a lead that already has it can keep it.
  const [options] = React.useState<readonly CreateLeadPriority[]>(() =>
    value === "urgent" ? WITH_URGENT : CREATE_LEAD_PRIORITIES,
  );
  const radio = useRovingRadio(options, value, onChange);
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
      {options.map((p) => {
        const s = PRIORITY_STYLE[p];
        return (
          <button
            key={p}
            type="button"
            {...radio(p)}
            onClick={() => onChange(p)}
            className={cn(CHIP, "min-w-[4.5rem] justify-center", value === p ? s.active : s.idle)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
