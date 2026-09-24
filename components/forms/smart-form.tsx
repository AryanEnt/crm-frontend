"use client";

import * as React from "react";
import {
  FormProvider,
  type FieldValues,
  type UseFormReturn,
  type DefaultValues,
  useForm,
  type Resolver,
} from "react-hook-form";
import type { FormMode, FormStep, SmartFormContextValue } from "./types";
import { useFormDraft } from "./use-form-draft";

const SmartFormContext = React.createContext<SmartFormContextValue | null>(null);

export function useSmartForm<T extends FieldValues = FieldValues>() {
  const ctx = React.useContext(SmartFormContext);
  if (!ctx) {
    throw new Error("useSmartForm must be used within SmartForm");
  }
  return ctx as SmartFormContextValue<T>;
}

export function useSmartFormOptional<T extends FieldValues = FieldValues>() {
  return React.useContext(SmartFormContext) as SmartFormContextValue<T> | null;
}

type SmartFormProps<T extends FieldValues> = {
  children: React.ReactNode;
  defaultValues: DefaultValues<T>;
  resolver?: Resolver<T>;
  mode?: FormMode;
  onModeChange?: (mode: FormMode) => void;
  steps?: FormStep[];
  draftKey?: string;
  className?: string;
  onSubmit?: (values: T) => void | Promise<void>;
  /** External form instance — if provided, SmartForm wraps it instead of creating one */
  form?: UseFormReturn<T>;
};

export function SmartForm<T extends FieldValues>({
  children,
  defaultValues,
  resolver,
  mode: controlledMode,
  onModeChange,
  steps,
  draftKey,
  className,
  onSubmit,
  form: externalForm,
}: SmartFormProps<T>) {
  const internalForm = useForm<T>({
    defaultValues,
    resolver,
    mode: "onTouched",
  });
  const form = externalForm ?? internalForm;

  const [internalMode, setInternalMode] = React.useState<FormMode>(controlledMode ?? "quick");
  const mode = controlledMode ?? internalMode;
  const setMode = React.useCallback(
    (next: FormMode) => {
      onModeChange?.(next);
      if (controlledMode === undefined) setInternalMode(next);
    },
    [controlledMode, onModeChange],
  );

  const [currentStep, setCurrentStep] = React.useState(0);

  const { isDirtyDraft, lastDraftSavedAt, clearDraft, restorePrompt } = useFormDraft({
    form,
    draftKey,
    enabled: Boolean(draftKey),
  });

  const value = React.useMemo<SmartFormContextValue<T>>(
    () => ({
      form,
      mode,
      setMode,
      steps,
      currentStep,
      setCurrentStep,
      draftKey,
      isDirtyDraft,
      lastDraftSavedAt,
    }),
    [form, mode, setMode, steps, currentStep, draftKey, isDirtyDraft, lastDraftSavedAt],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit?.(values);
    clearDraft();
  });

  return (
    <SmartFormContext.Provider value={value as SmartFormContextValue}>
      <FormProvider {...form}>
        {restorePrompt}
        <form
          className={className}
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          noValidate
        >
          {children}
        </form>
      </FormProvider>
    </SmartFormContext.Provider>
  );
}
