"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft filled fields: no visible border until hover or focus, so the form reads as a few calm blocks. */
export const FIELD_CONTROL =
  "h-11 w-full min-w-0 rounded-2xl border border-transparent bg-surface-muted px-3.5 text-body text-ink transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-line focus-visible:border-brand focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft aria-[invalid=true]:focus-visible:ring-danger/20";

/** Classes for Radix/cmdk trigger buttons so they line up with text fields. */
export const TRIGGER_CONTROL =
  "h-11 rounded-2xl border border-transparent bg-surface-muted px-3.5 text-body shadow-none hover:border-line hover:bg-surface-muted focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 aria-[invalid=true]:border-danger";

export const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-cell font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20";
export const CHIP_IDLE = "border-transparent bg-surface-muted text-ink-secondary hover:border-line hover:text-ink";
export const CHIP_ACTIVE = "border-brand bg-brand text-primary-foreground shadow-sm";

export type FieldA11y = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * Label above, then the control, then one line of help or the error. Wires ids for screen readers.
 * `group` is for radio groups and other composite controls: the label becomes plain text the
 * control points at with `aria-labelledby={labelId}`, so clicking it doesn't pick an option.
 */
export function LeadField({
  label,
  optional,
  required,
  hint,
  error,
  className,
  labelAction,
  group,
  children,
}: {
  label: string;
  optional?: boolean;
  /** Shows a red asterisk; use for fields the schema rejects when blank. */
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  labelAction?: React.ReactNode;
  group?: boolean;
  children: (a11y: FieldA11y, labelId: string) => React.ReactNode;
}) {
  const id = React.useId();
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const text = (
    <>
      {label}
      {required ? (
        <span className="text-danger" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
      {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
    </>
  );
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        {group ? (
          <span id={labelId} className="text-cell font-semibold text-ink">
            {text}
          </span>
        ) : (
          <label id={labelId} htmlFor={id} className="text-cell font-semibold text-ink">
            {text}
          </label>
        )}
        {labelAction}
      </div>
      {children(
        {
          id,
          "aria-describedby": message ? messageId : undefined,
          "aria-invalid": error ? true : undefined,
        },
        labelId,
      )}
      {message ? (
        <p id={messageId} className={cn("text-caption", error ? "text-danger" : "text-ink-muted")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Keeps a radio group's selected item (or the first) in the tab order and moves it with the arrow keys. */
export function useRovingRadio<T extends string>(values: readonly T[], selected: T | null, onSelect: (v: T) => void) {
  const refs = React.useRef(new Map<T, HTMLButtonElement | null>());
  const tabStop = selected && values.includes(selected) ? selected : values[0];
  const onKeyDown = (e: React.KeyboardEvent, current: T) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || values.length === 0) return;
    e.preventDefault();
    const index = values.indexOf(current);
    const next = values[(index + step + values.length) % values.length]!;
    onSelect(next);
    refs.current.get(next)?.focus();
  };
  const itemProps = (value: T) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current.set(value, el);
    },
    role: "radio" as const,
    "aria-checked": value === selected,
    tabIndex: value === tabStop ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, value),
  });
  return itemProps;
}
