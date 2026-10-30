"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { SmartReferralFields, emptyReferralForm } from "@/features/referrals/smart-referral-fields";
import { referralsApi } from "@/lib/api/referrals";
import type { DuplicateMatch } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { formatAmount, isReferralSource, parseAmount, type CreateLeadInput, type CreateLeadValues } from "./create-lead-schema";
import { DuplicateNotice } from "./duplicate-notice";
import { FIELD_CONTROL, LeadField } from "./field-ui";
import { detectDialCountry, formatPhone, phoneCountry } from "./phone";
import { PhoneCountryPicker } from "./phone-country-picker";
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
      <LeadField label="Name" required error={formState.errors.fullName?.message}>
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-3">
        <PriorityField />
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
          <PhoneCountryPicker
            id={selectId}
            value={code}
            invalid={Boolean(fieldState.error)}
            onChange={(next) => {
              country.field.onChange(next);
              if (field.value) field.onChange(formatPhone(field.value, next));
            }}
          />
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
    <LeadField
      label="Estimated value"
      optional
      hint="Rough estimate — you can update it later as you learn more."
      error={fieldState.error?.message}
    >
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
