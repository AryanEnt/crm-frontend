"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FormProgress } from "./form-progress";
import { useSmartForm } from "./smart-form";
import type { FormStep } from "./types";

/**
 * Guided multi-step shell. Keeps all values in one RHF form; only visibility changes.
 */
export function MultiStepForm({
  steps,
  children,
  className,
}: {
  steps: FormStep[];
  children: React.ReactNode[];
  onComplete?: () => void;
  className?: string;
}) {
  const { currentStep, setCurrentStep, form } = useSmartForm();
  const total = steps.length;
  const step = Math.min(currentStep, total - 1);

  const goNext = async () => {
    const ok = await form.trigger();
    if (!ok) {
      focusFirstError();
      return;
    }
    if (step < total - 1) setCurrentStep(step + 1);
  };

  const goBack = () => setCurrentStep(Math.max(0, step - 1));

  return (
    <div className={className}>
      <FormProgress
        steps={steps}
        currentStep={step}
        onStepClick={(i) => setCurrentStep(i)}
        className="mb-4"
      />
      <div className="min-h-[12rem]">{children[step]}</div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={goBack}>
          ← Back
        </Button>
        {step < total - 1 ? (
          <Button type="button" onClick={() => void goNext()}>
            Continue →
          </Button>
        ) : (
          <Button type="submit">Create</Button>
        )}
      </div>
    </div>
  );
}

function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>("[aria-invalid='true']");
    el?.focus();
  });
}
