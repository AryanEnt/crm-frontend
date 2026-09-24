"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { FormStep } from "./types";

export function FormProgress({
  steps,
  currentStep,
  onStepClick,
  className,
}: {
  steps: FormStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Form progress" className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}>
      {steps.map((step, i) => {
        const active = i === currentStep;
        const done = i < currentStep;
        const clickable = Boolean(onStepClick && i <= currentStep);
        return (
          <React.Fragment key={step.id}>
            {i > 0 ? (
              <span className="px-0.5 text-[11px] text-foreground-subtle" aria-hidden>
                /
              </span>
            ) : null}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(i)}
              className={cn(
                "rounded-sm px-1 py-0.5 text-[12px] transition-colors",
                active && "font-semibold text-foreground",
                done && !active && "font-medium text-foreground-muted",
                !done && !active && "font-medium text-foreground-subtle",
                clickable && "hover:text-foreground",
                !clickable && "cursor-default",
              )}
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
