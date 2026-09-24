"use client";

import { Columns3, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DealsViewMode = "board" | "form";

const options: Array<{
  value: DealsViewMode;
  label: string;
  hint: string;
  icon: typeof Columns3;
}> = [
  { value: "board", label: "Board", hint: "Kanban stages", icon: Columns3 },
  { value: "form", label: "Form", hint: "Table of deals", icon: Table2 },
];

type DealsViewToggleProps = {
  value: DealsViewMode;
  onChange: (value: DealsViewMode) => void;
};

export function DealsViewToggle({ value, onChange }: DealsViewToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Deal layout"
      className="relative isolate inline-flex h-9 w-[168px] shrink-0 items-center rounded-full border border-border-strong/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(244,243,248,0.95))] p-[3px] shadow-[inset_0_1px_2px_rgba(42,40,56,0.06),0_1px_0_rgba(255,255,255,0.8)]"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-[3px] w-[calc(50%-3px)] rounded-full bg-white shadow-[0_2px_8px_rgba(64,58,143,0.12),0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-brand/20 transition-[left,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-white/90",
          value === "board" ? "left-[3px]" : "left-[calc(50%)]",
        )}
      />
      {options.map((option) => {
        const active = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex h-full flex-1 items-center justify-center gap-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-colors duration-200",
              active
                ? "text-brand-dark"
                : "text-foreground-subtle hover:text-foreground-muted",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 transition-transform duration-300",
                active && "scale-110",
              )}
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
