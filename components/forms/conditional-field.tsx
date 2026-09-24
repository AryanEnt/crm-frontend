"use client";

import * as React from "react";
import { useFormContext, useWatch, type FieldValues, type Path } from "react-hook-form";

/**
 * Data-driven conditional field wrapper.
 * Renders children only when `when(values)` is true.
 */
export function ConditionalField<T extends FieldValues>({
  watch: watchPaths,
  when,
  children,
  fallback = null,
}: {
  watch: Path<T> | Path<T>[];
  when: (values: T) => boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { control } = useFormContext<T>();
  const paths = Array.isArray(watchPaths) ? watchPaths : [watchPaths];
  useWatch({ control, name: paths });
  const values = useFormContext<T>().getValues() as T;
  // Re-read on each watch update
  const show = when(values);
  return <>{show ? children : fallback}</>;
}

/** Evaluate a simple equality condition without a custom when fn. */
export function whenEquals<T extends FieldValues>(
  path: Path<T>,
  expected: unknown,
  opts?: { caseInsensitive?: boolean },
): (values: T) => boolean {
  return (values) => {
    const raw = values[path as keyof T];
    if (opts?.caseInsensitive && typeof raw === "string" && typeof expected === "string") {
      return raw.trim().toLowerCase() === expected.trim().toLowerCase();
    }
    return raw === expected;
  };
}
