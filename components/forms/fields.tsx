"use client";

import * as React from "react";
import { useController, useFormContext } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui/console/field";
import { Input, type InputProps } from "@/components/ui/console/input";
import { Select } from "@/components/ui/console/select";
import { Textarea, type TextareaProps } from "@/components/ui/console/textarea";
import { useFieldRequired } from "./form";

type BaseFieldProps = {
  name: string;
  label: string;
  helper?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Fields whose rules depend on this one (e.g. confirm password); re-checked on change once touched. */
  deps?: string[];
};

type ControlEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function useBoundField(name: string, deps?: string[]) {
  const { control, getFieldState, trigger } = useFormContext();
  const {
    field: { ref, name: fieldName, value, onChange: setValue, onBlur, disabled },
    fieldState,
  } = useController({ name, control });
  const required = useFieldRequired(name);
  const onChange = (event: ControlEvent) => {
    setValue(event);
    const touched = (deps ?? []).filter((dep) => getFieldState(dep).isTouched);
    if (touched.length > 0) void trigger(touched);
  };
  const field = { name: fieldName, value: (value ?? "") as string, onBlur, disabled };
  return { controlRef: ref, field, onChange, error: fieldState.error?.message, required };
}

export function TextField({
  name,
  label,
  helper,
  className,
  disabled,
  deps,
  ...inputProps
}: BaseFieldProps &
  Omit<InputProps, "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "ref" | "uiSize" | "invalid">) {
  const { controlRef, field, onChange, error, required } = useBoundField(name, deps);
  return (
    <Field label={label} helper={helper} error={error} required={required} className={className}>
      <Input
        {...inputProps}
        uiSize="lg"
        ref={controlRef}
        name={field.name}
        value={field.value}
        onChange={onChange}
        onBlur={field.onBlur}
        disabled={disabled || field.disabled}
      />
    </Field>
  );
}

export function PasswordField(props: Omit<React.ComponentProps<typeof TextField>, "type" | "trailing">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={props.disabled}
          className="inline-flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none"
        >
          <span aria-hidden className="relative size-4">
            {[
              { key: "show", Icon: Eye, shown: !visible },
              { key: "hide", Icon: EyeOff, shown: visible },
            ].map(({ key, Icon, shown }) => (
              <Icon
                key={key}
                className={cn(
                  "absolute inset-0 size-4 transition-[opacity,scale] duration-150 ease-standard motion-reduce:transition-none",
                  shown ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
              />
            ))}
          </span>
        </button>
      }
    />
  );
}

export function TextareaField({
  name,
  label,
  helper,
  className,
  disabled,
  deps,
  ...textareaProps
}: BaseFieldProps &
  Omit<TextareaProps, "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "ref" | "invalid">) {
  const { controlRef, field, onChange, error, required } = useBoundField(name, deps);
  return (
    <Field label={label} helper={helper} error={error} required={required} className={className}>
      <Textarea
        {...textareaProps}
        ref={controlRef}
        name={field.name}
        value={field.value}
        onChange={onChange}
        onBlur={field.onBlur}
        disabled={disabled || field.disabled}
      />
    </Field>
  );
}

/** Native select for short, fixed lists; use a combobox when the list needs searching. */
export function SelectField({
  name,
  label,
  helper,
  className,
  disabled,
  deps,
  loading = false,
  placeholder,
  children,
}: BaseFieldProps & {
  /** Options are still loading: the control is disabled and says so. */
  loading?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}) {
  const { controlRef, field, onChange, error, required } = useBoundField(name, deps);
  return (
    <Field label={label} helper={helper} error={error} required={required} className={className}>
      <Select
        uiSize="lg"
        ref={controlRef}
        name={field.name}
        value={loading ? "" : field.value}
        onChange={onChange}
        onBlur={field.onBlur}
        disabled={disabled || loading || field.disabled}
        aria-busy={loading || undefined}
      >
        {loading ? (
          <option value="">Loading…</option>
        ) : (
          <>
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {children}
          </>
        )}
      </Select>
    </Field>
  );
}
