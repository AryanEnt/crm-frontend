"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CREATE_LEAD_PRIORITIES, type CreateLeadPriority } from "./create-lead-schema";
import { CHIP, useRovingRadio } from "./field-ui";

/**
 * Low is green, Medium amber, High red. Each chip is tinted at rest and fills solid
 * when picked, so the choice reads at a glance.
 */
const PRIORITY_STYLE: Record<CreateLeadPriority, { label: string; emoji: string; idle: string; active: string }> = {
  low: {
    label: "Low",
    emoji: "🧊",
    idle: "bg-success-soft text-success hover:border-success/40",
    active: "border-success bg-success text-destructive-foreground shadow-sm",
  },
  medium: {
    label: "Medium",
    emoji: "⚡",
    idle: "bg-warning-soft text-warning hover:border-warning/40",
    active: "border-warning bg-warning text-destructive-foreground shadow-sm",
  },
  high: {
    label: "High",
    emoji: "🔥",
    idle: "bg-danger-soft text-danger hover:border-danger/40",
    active: "border-danger bg-danger text-destructive-foreground shadow-sm",
  },
  urgent: {
    label: "Urgent",
    emoji: "🚨",
    idle: "bg-danger-soft text-danger hover:border-danger/40",
    active: "border-danger bg-danger text-destructive-foreground shadow-sm ring-2 ring-danger/30",
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
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {options.map((p) => {
        const s = PRIORITY_STYLE[p];
        return (
          <button
            key={p}
            type="button"
            {...radio(p)}
            onClick={() => onChange(p)}
            className={cn(CHIP, "border-transparent font-semibold", value === p ? s.active : s.idle)}
          >
            <span aria-hidden>{s.emoji}</span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
