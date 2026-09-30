import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/types/api";

export type ServerErrorRule<T extends FieldValues> = {
  /** Matched against the backend error message. */
  match: RegExp;
  field: Path<T>;
  message: string;
};

/**
 * Turns a known backend error into an inline field error and focuses the field.
 * Returns false when nothing matched, so the caller can fall back to a toast.
 */
export function applyServerError<T extends FieldValues, TOut extends FieldValues>(
  form: UseFormReturn<T, unknown, TOut>,
  error: unknown,
  rules: ServerErrorRule<T>[],
): boolean {
  if (!(error instanceof ApiError)) return false;
  const rule = rules.find((r) => r.match.test(error.message));
  if (!rule) return false;
  form.setError(rule.field, { type: "server", message: rule.message }, { shouldFocus: true });
  return true;
}
