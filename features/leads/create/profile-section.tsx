"use client";

import * as React from "react";
import { useController, useFormContext } from "react-hook-form";
import { CountryPicker } from "@/components/forms/entity-pickers";
import type { CreateLeadInput, CreateLeadValues } from "./create-lead-schema";
import { FIELD_CONTROL, LeadField } from "./field-ui";

type TextName = "nationality" | "location" | "occupation" | "jobTitle" | "employer";

function TextInput({ name, label, placeholder, className }: { name: TextName; label: string; placeholder?: string; className?: string }) {
  const { register, formState } = useFormContext<CreateLeadInput, unknown, CreateLeadValues>();
  return (
    <LeadField label={label} error={formState.errors[name]?.message} className={className}>
      {(a11y) => (
        <input {...register(name)} {...a11y} autoComplete="off" placeholder={placeholder} className={FIELD_CONTROL} />
      )}
    </LeadField>
  );
}

export function ProfileSection() {
  const { control } = useFormContext<CreateLeadInput, unknown, CreateLeadValues>();
  const country = useController({ control, name: "country" });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
      <LeadField label="Country" group>
        {(_a11y, labelId) => (
          <div
            role="group"
            aria-labelledby={labelId}
            className="[&_button]:h-11 [&_button]:rounded-2xl [&_button]:border-transparent [&_button]:bg-surface-muted"
          >
            <CountryPicker value={country.field.value} onChange={country.field.onChange} />
          </div>
        )}
      </LeadField>
      <TextInput name="nationality" label="Nationality" />
      <TextInput name="location" label="Location" placeholder="City or suburb" className="sm:col-span-2" />
      <TextInput name="occupation" label="Occupation" />
      <TextInput name="jobTitle" label="Job title" />
      <TextInput name="employer" label="Employer" className="sm:col-span-2" />
    </div>
  );
}
