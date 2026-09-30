"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "./slot";

export type FieldProps = {
  label: string;
  helper?: React.ReactNode;
  /** Inline validation message; replaces the helper text while present. */
  error?: string;
  required?: boolean;
  className?: string;
  /** A single control. Field wires `id`, `aria-describedby` and `aria-invalid` onto it. */
  children: React.ReactElement;
};

export function Field({ label, helper, error, required, className, children }: FieldProps) {
  const id = React.useId();
  const messageId = `${id}-message`;
  const message = error ?? helper;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-caption font-medium text-ink-secondary">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </label>
      <Slot
        id={id}
        aria-describedby={message ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
      >
        {children}
      </Slot>
      {message ? (
        <p id={messageId} className={cn("text-caption", error ? "text-danger" : "text-ink-muted")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
