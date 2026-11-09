"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft lavender-friendly fields; focus uses brand ring. */
export const FIELD_CONTROL =
  "h-10 w-full min-w-0 rounded-xl border border-line/80 bg-surface px-3 text-body text-ink shadow-xs transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ink-muted hover:border-brand/35 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40 aria-[invalid=true]:focus-visible:ring-danger/20";

/** Classes for Radix/cmdk trigger buttons so they line up with text fields. */
export const TRIGGER_CONTROL =
  "h-10 rounded-xl border border-line/80 bg-surface px-3 text-body shadow-xs hover:border-brand/35 hover:bg-surface focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 aria-[invalid=true]:border-danger";

export const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-caption font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20";
export const CHIP_IDLE = "border-line/80 bg-surface text-ink-secondary hover:border-brand/30 hover:bg-brand-soft/50 hover:text-ink";
export const CHIP_ACTIVE = "border-brand/45 bg-brand-soft text-brand shadow-xs";

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
      {optional ? <span className="font-normal text-ink-muted"> · optional</span> : null}
    </>
  );
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        {group ? (
          <span id={labelId} className="text-caption font-medium text-ink-secondary">
            {text}
          </span>
        ) : (
          <label id={labelId} htmlFor={id} className="text-caption font-medium text-ink-secondary">
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
