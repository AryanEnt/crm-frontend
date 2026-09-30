"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComposedRefs } from "./slot";

export type CheckboxProps = Omit<React.ComponentProps<"input">, "type" | "checked" | "onChange"> & {
  checked: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean, meta: { shiftKey: boolean }) => void;
};

/** Native checkbox (keyboard + screen readers for free) with custom visuals and indeterminate support. */
export function Checkbox({
  checked,
  indeterminate = false,
  onCheckedChange,
  className,
  ref,
  ...props
}: CheckboxProps) {
  const innerRef = React.useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(innerRef, ref);

  React.useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const Icon = indeterminate ? Minus : Check;

  return (
    <span className={cn("relative inline-flex size-4 shrink-0", className)}>
      <input
        ref={composedRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          const native = event.nativeEvent;
          onCheckedChange?.(event.target.checked, {
            shiftKey: native instanceof MouseEvent && native.shiftKey,
          });
        }}
        className="peer size-4 cursor-pointer appearance-none rounded-sm border border-line-strong bg-surface shadow-xs transition-[background-color,border-color] duration-150 ease-standard hover:border-ink-muted checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <Icon
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-100"
      />
    </span>
  );
}
