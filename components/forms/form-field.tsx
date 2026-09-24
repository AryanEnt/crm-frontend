"use client";

import * as React from "react";
import { useFormContext, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FormField<T extends FieldValues>({
  name,
  label,
  required,
  help,
  className,
  children,
}: {
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  help?: string;
  className?: string;
  children: React.ReactElement;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<T>();
  const error = getError(errors, name);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={String(name)} required={required} className="text-[12px] font-medium text-foreground-muted">
        {label}
      </Label>
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => {
          const child = children as React.ReactElement<Record<string, unknown>>;
          return React.cloneElement(child, {
            ...field,
            id: String(name),
            error: Boolean(fieldState.error) || Boolean(error),
            "aria-invalid": Boolean(fieldState.error) || Boolean(error),
            "aria-describedby": error ? `${String(name)}-error` : undefined,
            onChange: (e: unknown) => {
              const handler = child.props.onChange as ((v: unknown) => void) | undefined;
              // Support both native events and Select/Combobox value callbacks
              if (e && typeof e === "object" && "target" in (e as object)) {
                field.onChange((e as React.ChangeEvent<HTMLInputElement>).target.value);
              } else {
                field.onChange(e);
              }
              handler?.(e);
            },
            onBlur: (e: unknown) => {
              field.onBlur();
              const handler = child.props.onBlur as ((v: unknown) => void) | undefined;
              handler?.(e);
            },
            value: child.props.value !== undefined ? child.props.value : field.value,
          });
        }}
      />
      {help && !error ? <FieldHelp>{help}</FieldHelp> : null}
      {error ? (
        <p id={`${String(name)}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Simple labeled slot when not using RHF Controller (e.g. custom controlled widgets). */
export function FormFieldSlot({
  label,
  required,
  htmlFor,
  error,
  help,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  error?: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        required={required}
        className="text-[12px] font-medium text-foreground-muted"
      >
        {label}
      </Label>
      {children}
      {help && !error ? <FieldHelp>{help}</FieldHelp> : null}
      {error ? (
        <p className="text-[12px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-snug text-foreground-subtle">{children}</p>;
}

export function FormFieldGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("grid gap-3.5 sm:grid-cols-2", className)}>{children}</div>;
}

function getError(errors: Record<string, unknown>, name: string): string | undefined {
  const parts = name.split(".");
  let cur: unknown = errors;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur && typeof cur === "object" && "message" in cur) {
    return String((cur as { message?: unknown }).message ?? "");
  }
  return undefined;
}
