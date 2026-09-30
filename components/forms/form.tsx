"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useFormState,
  type FieldValues,
  type Resolver,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { Button, type ButtonProps } from "@/components/ui/console/button";

type ObjectSchema = z.ZodObject;

/**
 * react-hook-form + zod with Aurora's validation timing: a field is checked when
 * the user leaves it, re-checked as they type once it has an error, and submit
 * focuses the first invalid field.
 */
export function useZodForm<TSchema extends ObjectSchema>(
  schema: TSchema,
  props?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, "resolver">,
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: true,
    ...props,
    resolver: zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>,
  });
}

const SchemaContext = React.createContext<ObjectSchema | null>(null);

/** Required means the field's own schema rejects both "" and undefined, so the asterisk can't drift from the rule. */
export function useFieldRequired(name: string): boolean {
  const schema = React.useContext(SchemaContext);
  return React.useMemo(() => {
    const field = schema?.shape[name] as z.ZodType | undefined;
    if (!field) return false;
    return !field.safeParse("").success && !field.safeParse(undefined).success;
  }, [schema, name]);
}

/**
 * Form context without the `<form>` element, for layouts where the submit button
 * sits outside it (drawer and dialog footers use `<SubmitButton form={id}>`).
 */
export function FormScope<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  schema,
  children,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  schema: ObjectSchema;
  children: React.ReactNode;
}) {
  return (
    <SchemaContext.Provider value={schema}>
      <FormProvider {...form}>{children}</FormProvider>
    </SchemaContext.Provider>
  );
}

export function Form<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  schema,
  onSubmit,
  onInvalid,
  id,
  className,
  children,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  schema: ObjectSchema;
  onSubmit: SubmitHandler<TOut>;
  onInvalid?: SubmitErrorHandler<TIn>;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <FormScope form={form} schema={schema}>
      <form
        id={id}
        noValidate
        className={className}
        onSubmit={(event) => void form.handleSubmit(onSubmit, onInvalid)(event)}
      >
        {children}
      </form>
    </FormScope>
  );
}

/** `data-invalid` marks wrappers around custom controls that can't carry aria-invalid themselves. */
const INVALID = "[aria-invalid='true'], [data-invalid='true']";
const FOCUSABLE = "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])";

/**
 * react-hook-form only focuses fields whose ref reaches a DOM input, so custom
 * pickers (chip groups, comboboxes) are skipped. Run after an invalid submit to
 * land on the first invalid control in `root` when focus isn't already on one.
 */
export function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (!root) return;
    if (document.activeElement?.closest(INVALID)) return;
    const invalid = root.querySelector<HTMLElement>(INVALID);
    if (!invalid) return;
    const target = invalid.matches(FOCUSABLE) ? invalid : invalid.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    invalid.scrollIntoView({ block: "nearest" });
  });
}

/** Primary submit that shows the loading state; `requireDirty` keeps it disabled until something changes. */
export function SubmitButton({
  requireDirty = false,
  children,
  ...props
}: Omit<ButtonProps, "type" | "loading"> & { requireDirty?: boolean }) {
  const { isSubmitting, isDirty } = useFormState();
  return (
    <Button
      type="submit"
      variant="primary"
      loading={isSubmitting}
      disabled={props.disabled || (requireDirty && !isDirty)}
      {...props}
    >
      {children}
    </Button>
  );
}
