"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CONTROL } from "./input";

export type TextareaProps = React.ComponentProps<"textarea"> & {
  invalid?: boolean;
  /** Grow with content up to this many rows, then scroll. */
  maxRows?: number;
};

/** Autosizing textarea; Cmd/Ctrl+Enter submits the enclosing form. */
export function Textarea({
  invalid,
  maxRows = 10,
  rows = 3,
  className,
  onKeyDown,
  onInput,
  ref,
  ...props
}: TextareaProps) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxRows + 16)}px`;
  }, [maxRows]);

  React.useLayoutEffect(resize, [resize, props.value]);

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, "resize-none py-2 leading-5", className)}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      {...props}
    />
  );
}
