"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FormFieldSlot } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { CrmFormSection, CRM_FIELD_INPUT_CLASS } from "@/components/forms";
import { crmApi, type CustomFieldDefinition } from "@/lib/api/crm";

export type CustomFieldsEntity = "lead" | "customer" | "deal" | "activity";

export function CustomFieldsSection({
  entity,
  recordId,
  values,
  onChange,
  enabled = true,
}: {
  entity: CustomFieldsEntity;
  recordId?: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  enabled?: boolean;
}) {
  const fieldsQuery = useQuery({
    queryKey: ["custom-fields", entity, "form"],
    queryFn: () => crmApi.listCustomFields({ entity, activeOnly: true }),
    enabled,
  });

  const valuesQuery = useQuery({
    queryKey: ["custom-field-values", entity, recordId],
    queryFn: () => crmApi.getCustomFieldValues(entity, recordId!),
    enabled: enabled && Boolean(recordId),
  });

  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (valuesQuery.data && !seededRef.current) {
      seededRef.current = true;
      onChange({ ...valuesQuery.data });
    }
  }, [valuesQuery.data, onChange]);

  const fields = fieldsQuery.data ?? [];

  if (!enabled) return null;
  if (fieldsQuery.isLoading) return <LoadingState compact label="Loading custom fields…" />;
  if (!fields.length) return null;

  const setField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <CrmFormSection title="Additional fields" divided>
      {fields
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.internalKey]}
            onChange={(v) => setField(field.internalKey, v)}
          />
        ))}
    </CrmFormSection>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const required = field.isRequired;
  const label = field.name + (required ? " *" : "");

  switch (field.fieldType) {
    case "boolean":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={Boolean(value)} onCheckedChange={(v) => onChange(v === true)} />
            {field.description || "Yes"}
          </label>
        </FormFieldSlot>
      );
    case "long_text":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <textarea
            className={`${CRM_FIELD_INPUT_CLASS} min-h-[80px] w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm`}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormFieldSlot>
      );
    case "single_select":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <Select value={String(value ?? "")} onValueChange={onChange}>
            <SelectTrigger className={CRM_FIELD_INPUT_CLASS}>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {field.options
                .filter((o) => o.isActive !== false)
                .map((o) => (
                  <SelectItem key={o.id || o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FormFieldSlot>
      );
    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <div className="flex flex-wrap gap-2">
            {field.options
              .filter((o) => o.isActive !== false)
              .map((o) => {
                const on = selected.includes(o.value);
                return (
                  <label
                    key={o.id || o.value}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => {
                        if (v === true) onChange([...selected, o.value]);
                        else onChange(selected.filter((x) => x !== o.value));
                      }}
                    />
                    {o.label}
                  </label>
                );
              })}
          </div>
        </FormFieldSlot>
      );
    }
    case "number":
    case "currency":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <Input
            type="number"
            className={CRM_FIELD_INPUT_CLASS}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
        </FormFieldSlot>
      );
    case "date":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <Input
            type="date"
            className={CRM_FIELD_INPUT_CLASS}
            value={String(value ?? "").slice(0, 10)}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </FormFieldSlot>
      );
    case "datetime":
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <Input
            type="datetime-local"
            className={CRM_FIELD_INPUT_CLASS}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </FormFieldSlot>
      );
    default:
      return (
        <FormFieldSlot label={label} help={field.helpText}>
          <Input
            type={field.fieldType === "email" ? "email" : field.fieldType === "url" ? "url" : "text"}
            className={CRM_FIELD_INPUT_CLASS}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        </FormFieldSlot>
      );
  }
}
