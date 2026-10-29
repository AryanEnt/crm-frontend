"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { SmartReferralFields, emptyReferralForm } from "@/features/referrals/smart-referral-fields";
import { referralsApi } from "@/lib/api/referrals";
import type { DuplicateMatch } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { formatAmount, isReferralSource, parseAmount, type CreateLeadInput, type CreateLeadValues } from "./create-lead-schema";
import { DuplicateNotice } from "./duplicate-notice";
import { FIELD_CONTROL, LeadField, TRIGGER_CONTROL } from "./field-ui";
import { PHONE_COUNTRIES, detectDialCountry, formatPhone, phoneCountry } from "./phone";
import { PriorityPicker } from "./priority-picker";
import { ScreenshotField } from "./screenshot-field";
import { SourcePicker } from "./source-picker";

const useLeadForm = () => useFormContext<CreateLeadInput, unknown, CreateLeadValues>();

export function QuickAddFields({
  nameRef,
  sources,
  duplicates,
  onCreateAnyway,
  duplicateBusy,
  editing = false,
  anzscoLabel = null,
  screenshot,
  onScreenshotChange,
  pasteTarget,
  extractEnabled,
  onApplyExtract,
}: {
  nameRef: React.RefObject<HTMLInputElement | null>;
  sources: readonly string[];
  duplicates: DuplicateMatch[];
  onCreateAnyway: () => void;
  duplicateBusy?: boolean;
  /** Editing an existing lead: referral details stay as they are. */
  editing?: boolean;
  /** Label for the ANZSCO occupation already on the lead. */
  anzscoLabel?: string | null;
  screenshot: File | null;
  onScreenshotChange: (file: File | null) => void;
  pasteTarget: React.RefObject<HTMLElement | null>;
  extractEnabled: boolean;
  onApplyExtract: (found: { fullName?: string; phone?: string; email?: string }) => void;
}) {
  const { control, register, formState } = useLeadForm();
  const source = useWatch({ control, name: "source" });
  const name = register("fullName");

  return (
    <div className="flex flex-col gap-5">
      <LeadField label="Name" error={formState.errors.fullName?.message}>
        {(a11y) => (
          <input
            {...name}
            ref={(el) => {
              name.ref(el);
              nameRef.current = el;
            }}
            {...a11y}
            aria-required
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="Who's the lead?"
            className={cn(FIELD_CONTROL, "h-12 text-base font-medium")}
          />
        )}
      </LeadField>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
          <PhoneField />
          <LeadField label="Email" error={formState.errors.email?.message}>
            {(a11y) => (
              <input
                {...register("email")}
                {...a11y}
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder="name@email.com"
                className={FIELD_CONTROL}
              />
            )}
          </LeadField>
        </div>
        {duplicates.length > 0 ? (
          <DuplicateNotice
            matches={duplicates}
            onCreateAnyway={onCreateAnyway}
            busy={duplicateBusy}
            actionLabel={editing ? "Save anyway" : "Create anyway"}
          />
        ) : null}
      </div>

      <ScreenshotField
        file={screenshot}
        onChange={onScreenshotChange}
        pasteTarget={pasteTarget}
        extractEnabled={extractEnabled}
        onApplyExtract={onApplyExtract}
      />

      <SourceField sources={sources} />
      {isReferralSource(source) ? (
        editing ? (
          <p className="-mt-2 rounded-2xl bg-surface-muted px-3.5 py-2.5 text-caption text-ink-muted">
            <span aria-hidden>🤝 </span>Referral details can&apos;t be changed here.
          </p>
        ) : (
          <ReferralBlock />
        )
      ) : null}
      <PriorityField />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-3">
        <AnzscoField initialLabel={anzscoLabel} />
        <ValueField />
      </div>
    </div>
  );
}

function PhoneField() {
  const { control } = useLeadForm();
  const { field, fieldState } = useController({ control, name: "phone" });
  const country = useController({ control, name: "phoneCountry" });
  const code = country.field.value;
  const selectId = React.useId();

  return (
    <LeadField label="Phone" error={fieldState.error?.message}>
      {(a11y) => (
        <div className="flex min-w-0 gap-1.5">
          <label htmlFor={selectId} className="sr-only">
            Country code
          </label>
          <div className="relative shrink-0">
            <select
              id={selectId}
              value={code}
              onChange={(e) => {
                country.field.onChange(e.target.value);
                if (field.value) field.onChange(formatPhone(field.value, e.target.value));
              }}
              className={cn(FIELD_CONTROL, "w-[4.75rem] appearance-none px-2.5 pr-6 text-cell tabular-nums")}
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} title={c.name}>
                  +{c.dial} {c.code}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          </div>
          <input
            ref={field.ref}
            name={field.name}
            {...a11y}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder={phoneCountry(code).trunk ? "0412 345 678" : "Phone number"}
            value={field.value}
            onChange={(e) => {
              const raw = e.target.value;
              const detected = detectDialCountry(raw, code);
              const nextCode = detected ?? code;
              if (detected && detected !== code) country.field.onChange(detected);
              // Reformat only while typing at the end, so editing the middle keeps the caret put.
              const atEnd = e.target.selectionStart === raw.length;
              field.onChange(atEnd ? formatPhone(raw, nextCode) : raw);
            }}
            onBlur={() => {
              if (field.value) field.onChange(formatPhone(field.value, code));
              field.onBlur();
            }}
            className={cn(FIELD_CONTROL, "tabular-nums")}
          />
        </div>
      )}
    </LeadField>
  );
}

function SourceField({ sources }: { sources: readonly string[] }) {
  const { control } = useLeadForm();
  const { field, fieldState } = useController({ control, name: "source" });
  return (
    <LeadField label="Where did they come from?" group error={fieldState.error?.message}>
      {(_a11y, labelId) => (
        <SourcePicker
          value={field.value}
          onChange={(v) => {
            field.onChange(v);
            field.onBlur();
          }}
          sources={sources}
          labelId={labelId}
          invalid={Boolean(fieldState.error)}
        />
      )}
    </LeadField>
  );
}

function PriorityField() {
  const { control } = useLeadForm();
  const { field } = useController({ control, name: "priority" });
  return (
    <LeadField label="How hot is this lead?" group>
      {(_a11y, labelId) => <PriorityPicker value={field.value} onChange={field.onChange} labelId={labelId} />}
    </LeadField>
  );
}

function AnzscoField({ initialLabel }: { initialLabel: string | null }) {
  const { control, getValues, setValue } = useLeadForm();
  const { field } = useController({ control, name: "anzscoId" });
  const [label, setLabel] = React.useState<string | null>(initialLabel);
  return (
    <LeadField label="Occupation (ANZSCO)" optional group>
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
            // Saves typing the same job twice; a title the user already wrote is kept.
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

function ReferralBlock() {
  const { control, formState } = useLeadForm();
  const { field } = useController({ control, name: "referral" });
  const meta = useQuery({ queryKey: ["referrals", "meta"], queryFn: () => referralsApi.meta(), staleTime: 5 * 60_000 });
  const error = formState.errors.referral?.message;
  return (
    <div data-invalid={error ? true : undefined} className="rounded-2xl bg-success-soft/60 p-4">
      <p className="mb-3 text-cell font-semibold text-ink">
        <span aria-hidden>🤝 </span>Who referred them?
      </p>
      <SmartReferralFields
        value={field.value ?? emptyReferralForm()}
        onChange={field.onChange}
        meta={meta.data}
        error={error}
      />
    </div>
  );
}

function ValueField() {
  const { control } = useLeadForm();
  const { field, fieldState } = useController({ control, name: "potentialValue" });
  return (
    <LeadField label="Value" optional error={fieldState.error?.message}>
      {(a11y) => (
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body font-medium text-ink-muted">
            A$
          </span>
          <input
            ref={field.ref}
            name={field.name}
            {...a11y}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={formatAmount(field.value)}
            onChange={(e) => field.onChange(parseAmount(e.target.value))}
            onBlur={field.onBlur}
            className={cn(FIELD_CONTROL, "pl-10 tabular-nums")}
          />
        </div>
      )}
    </LeadField>
  );
}
