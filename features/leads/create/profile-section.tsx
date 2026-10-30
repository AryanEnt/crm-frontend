"use client";

import * as React from "react";
import { useController, useFormContext } from "react-hook-form";
import { CountryPicker } from "@/components/forms/entity-pickers";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { cn } from "@/lib/utils";
import type { CreateLeadInput, CreateLeadValues } from "./create-lead-schema";
import { FIELD_CONTROL, LeadField, TRIGGER_CONTROL } from "./field-ui";

const useLeadForm = () => useFormContext<CreateLeadInput, unknown, CreateLeadValues>();

type TextName = "nationality" | "location";

function TextInput({
  name,
  label,
  placeholder,
  className,
  required,
}: {
  name: TextName;
  label: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const { register, formState } = useLeadForm();
  return (
    <LeadField label={label} required={required} error={formState.errors[name]?.message} className={className}>
      {(a11y) => (
        <input
          {...register(name)}
          {...a11y}
          aria-required={required || undefined}
          autoComplete="off"
          placeholder={placeholder}
          className={FIELD_CONTROL}
        />
      )}
    </LeadField>
  );
}

function CountryField({ required }: { required?: boolean }) {
  const { control, formState } = useLeadForm();
  const country = useController({ control, name: "country" });
  const error = formState.errors.country?.message;

  return (
    <LeadField label="Country" required={required} group error={error}>
      {(_a11y, labelId) => (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          className="[&_button]:h-11 [&_button]:rounded-2xl [&_button]:border-transparent [&_button]:bg-surface-muted"
        >
          <CountryPicker value={country.field.value} onChange={country.field.onChange} error={Boolean(error)} />
        </div>
      )}
    </LeadField>
  );
}

function AnzscoField({ initialLabel }: { initialLabel: string | null }) {
  const { control, getValues, setValue } = useLeadForm();
  const { field } = useController({ control, name: "anzscoId" });
  const [label, setLabel] = React.useState<string | null>(initialLabel);

  return (
    <LeadField
      label="Occupation (ANZSCO)"
      optional
      group
      hint="Search by job title or code — we'll fill occupation if it's empty"
      className="sm:col-span-2"
    >
      {(a11y, labelId) => (
        <AnzscoCombobox
          value={field.value}
          selectedLabel={field.value ? label : null}
          placeholder="Search a job or code"
          aria-labelledby={labelId}
          aria-describedby={a11y["aria-describedby"]}
          onChange={(id, occupation) => {
            field.onChange(id);
            setLabel(occupation ? `${occupation.code} — ${occupation.title}` : null);
            if (occupation && !getValues("occupation").trim()) {
              setValue("occupation", occupation.title, { shouldDirty: true });
            }
          }}
          className={cn(TRIGGER_CONTROL, "w-full justify-between font-normal")}
        />
      )}
    </LeadField>
  );
}

/** Always-visible block: country, nationality, location + ANZSCO. Required on create. */
export function ProfileSection({
  anzscoLabel = null,
  requireClientDetails = true,
}: {
  anzscoLabel?: string | null;
  requireClientDetails?: boolean;
}) {
  return (
    <section aria-labelledby="about-them-heading" className="flex flex-col gap-4">
      <div>
        <h3 id="about-them-heading" className="text-cell font-semibold text-ink">
          About them
        </h3>
        <p className="mt-0.5 text-caption text-ink-muted">
          {requireClientDetails
            ? "Country, nationality and location are required"
            : "Where they live and how they're classified for visas"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
        <CountryField required={requireClientDetails} />
        <TextInput
          name="nationality"
          label="Nationality"
          placeholder="e.g. Nepali, Indian"
          required={requireClientDetails}
        />
        <TextInput
          name="location"
          label="Location"
          placeholder="City or suburb"
          className="sm:col-span-2"
          required={requireClientDetails}
        />
        <AnzscoField initialLabel={anzscoLabel} />
      </div>
    </section>
  );
}

type WorkName = "occupation" | "jobTitle" | "employer";

function WorkInput({
  name,
  label,
  placeholder,
  className,
}: {
  name: WorkName;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const { register, formState } = useLeadForm();
  return (
    <LeadField label={label} optional error={formState.errors[name]?.message} className={className}>
      {(a11y) => (
        <input {...register(name)} {...a11y} autoComplete="off" placeholder={placeholder} className={FIELD_CONTROL} />
      )}
    </LeadField>
  );
}

/** Optional job details under More details. */
export function WorkSection() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
      <WorkInput name="occupation" label="Occupation" placeholder="What they do" />
      <WorkInput name="jobTitle" label="Job title" placeholder="Current title" />
      <WorkInput name="employer" label="Employer" placeholder="Company or organisation" className="sm:col-span-2" />
    </div>
  );
}
