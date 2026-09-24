import type { FieldValues, UseFormReturn, Path } from "react-hook-form";

export type FormMode = "quick" | "guided" | "full" | "edit";

export type FormStep = {
  id: string;
  label: string;
  description?: string;
};

export type ConditionalRule<T extends FieldValues> = {
  /** Field path to watch */
  watch: Path<T> | Path<T>[];
  /** Return true to show the conditional content */
  when: (values: T) => boolean;
};

export type EntityPickerOption = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
};

export type SmartFormContextValue<T extends FieldValues = FieldValues> = {
  form: UseFormReturn<T>;
  mode: FormMode;
  setMode: (mode: FormMode) => void;
  steps?: FormStep[];
  currentStep: number;
  setCurrentStep: (step: number) => void;
  draftKey?: string;
  isDirtyDraft: boolean;
  lastDraftSavedAt: number | null;
};
