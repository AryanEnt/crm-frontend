"use client";

import * as React from "react";
import { useController, useFormContext } from "react-hook-form";
import { CountryPicker, NationalityPicker } from "@/components/forms/entity-pickers";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { cn } from "@/lib/utils";
import type { CreateLeadInput, CreateLeadValues } from "./create-lead-schema";
import { FIELD_CONTROL, LeadField, TRIGGER_CONTROL } from "./field-ui";

const useLeadForm = () => useFormContext<CreateLeadInput, unknown, CreateLeadValues>();

function NationalityField({ required }: { required?: boolean }) {
  const { control, formState } = useLeadForm();
  const nationality = useController({ control, name: "nationality" });
  const error = formState.errors.nationality?.message;

  return (
    <LeadField label="Nationality" required={required} group error={error}>
      {(_a11y, labelId) => (
        <div
          role="group"
          aria-labelledby={labelId}
          className="[&_button]:h-10 [&_button]:rounded-xl [&_button]:border-line/80 [&_button]:bg-surface [&_button]:shadow-xs"
        >
          <NationalityPicker
            value={nationality.field.value}
            onChange={nationality.field.onChange}
            error={Boolean(error)}
          />
        </div>
      )}
    </LeadField>
  );
}

function LocationField({ required }: { required?: boolean }) {
  const { register, formState } = useLeadForm();
  return (
    <LeadField label="Location" required={required} error={formState.errors.location?.message} className="sm:col-span-2">
      {(a11y) => (
        <input
          {...register("location")}
          {...a11y}
          aria-required={required || undefined}
          autoComplete="off"
          placeholder="City or suburb"
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
    <LeadField label="Country of Residency" required={required} group error={error}>
      {(_a11y, labelId) => (
        <div
          role="group"
          aria-labelledby={labelId}
          className="[&_button]:h-10 [&_button]:rounded-xl [&_button]:border-line/80 [&_button]:bg-surface [&_button]:shadow-xs"
        >
          <CountryPicker value={country.field.value} onChange={country.field.onChange} error={Boolean(error)} />
        </div>
      )}
    </LeadField>
  );
}

function OccupationField({ initialLabel }: { initialLabel: string | null }) {
  const { control, getValues, setValue } = useLeadForm();
  const { field } = useController({ control, name: "anzscoId" });
  const occupation = useController({ control, name: "occupation" });
  const [label, setLabel] = React.useState<string | null>(initialLabel);

  return (
    <div className="grid grid-cols-1 gap-4 sm:col-span-2">
      <LeadField
        label="Occupation / ANZSCO"
        optional
        group
        hint="Start typing a job title, or pick from suggested"
      >
        {(a11y, labelId) => (
          <AnzscoCombobox
            value={field.value}
            selectedLabel={field.value ? label : null}
            placeholder="Search job title or ANZSCO code…"
            aria-labelledby={labelId}
            aria-describedby={a11y["aria-describedby"]}
            onChange={(id, found) => {
              field.onChange(id);
              setLabel(found ? `${found.title} · ${found.code}` : null);
              if (found) {
                setValue("occupation", found.title, { shouldDirty: true });
              }
            }}
            className={cn(TRIGGER_CONTROL, "w-full justify-between font-normal")}
          />
        )}
      </LeadField>
      <LeadField label="Occupation title" optional hint="Edit if the ANZSCO title isn’t quite right">
        {(a11y) => (
          <input
            ref={occupation.field.ref}
            name={occupation.field.name}
            {...a11y}
            value={occupation.field.value}
            onChange={(e) => occupation.field.onChange(e.target.value)}
            onBlur={occupation.field.onBlur}
            autoComplete="off"
            placeholder={getValues("occupation") ? undefined : "What they do"}
            className={FIELD_CONTROL}
          />
        )}
      </LeadField>
    </div>
  );
}

/** About block — required profile + optional ANZSCO occupation. */
export function AboutSection({ anzscoLabel = null }: { anzscoLabel?: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CountryField required />
      <NationalityField required />
      <LocationField required />
      <OccupationField initialLabel={anzscoLabel} />
    </div>
  );
}

/** @deprecated Prefer AboutSection — kept for any stray imports. */
export function ProfileSection(props: { anzscoLabel?: string | null }) {
  return <AboutSection {...props} />;
}

type WorkName = "jobTitle" | "employer";

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

/**
 * Job details accordion — title and employer only.
 * ANZSCO/occupation lives in About Them to avoid duplicate selectors.
 * Custom fields (e.g. visa type) are rendered by the parent.
 */
export function WorkSection() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <WorkInput name="jobTitle" label="Job title" placeholder="Current title" />
      <WorkInput name="employer" label="Employer" placeholder="Company or organisation" />
    </div>
  );
}
