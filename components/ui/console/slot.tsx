"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AnyProps = Record<string, unknown>;
type Handler = (...args: unknown[]) => void;

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as React.RefObject<T | null>).current = node;
}

export function useComposedRefs<T>(a: React.Ref<T> | undefined, b: React.Ref<T> | undefined) {
  return React.useCallback(
    (node: T | null) => {
      assignRef(a, node);
      assignRef(b, node);
    },
    [a, b],
  );
}

/** Child handlers run first; the slot's handler runs after and can check `defaultPrevented`. */
function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps, ...childProps };
  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args: unknown[]) => {
        (childValue as Handler)(...args);
        (slotValue as Handler)(...args);
      };
    } else if (key === "className") {
      merged[key] = cn(slotValue as string, childValue as string);
    } else if (key === "style") {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
    }
  }
  return merged;
}

type SlotProps = AnyProps & { children: React.ReactNode; ref?: React.Ref<HTMLElement> };

/** Merges its props, handlers and ref onto its single child element. */
export function Slot({ children, ref, ...props }: SlotProps) {
  const child = React.isValidElement<AnyProps & { ref?: React.Ref<HTMLElement> }>(children)
    ? children
    : null;
  const composedRef = useComposedRefs(ref, child?.props.ref);
  if (!child) return null;
  return React.cloneElement(child, { ...mergeProps(props, child.props), ref: composedRef });
}
