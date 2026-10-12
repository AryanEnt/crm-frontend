"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  /** Shows a muted danger-toned asterisk for required fields. */
  required?: boolean;
};

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-xs font-medium text-foreground-muted leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  >
    {children}
    {required ? (
      <span className="ml-0.5 font-normal text-danger/70" aria-hidden="true">
        *
      </span>
    ) : null}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;
