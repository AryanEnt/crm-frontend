"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useController, useWatch, type Control, type SubmitErrorHandler } from "react-hook-form";
import { toast } from "sonner";
import {
  ComboboxField,
  DateTimeField,
  focusFirstInvalid,
  Form,
  FormScope,
  QuickCreateDialog,
  SubmitButton,
  TextareaField,
  TextField,
  useZodForm,
} from "@/components/forms";
import { LeadCombobox, type LeadOption } from "@/components/forms/entity-pickers";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Button } from "@/components/ui/console/button";
import { Field } from "@/components/ui/console/field";
import { formTriggerClass } from "@/components/ui/dropdown-styles";
import { LoadingState } from "@/components/ui/loading-state";
import { typeDotClass } from "@/features/activities/calendar-colors";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type ActivityType } from "@/lib/api/crm";
import { copy } from "@/lib/copy";
import { addMinutesLocal, localToIso, tomorrowAt } from "@/lib/forms/datetime";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import {
  ACTIVITY_PRIORITIES,
  activitySchema,
  type ActivityFormInput,
  type ActivityFormValues,
  type ActivityLinkType,
  type ActivityTypeRules,
} from "@/validations/activity";

export type ActivityContext = {
  leadId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
};

const FORM_ID = "activity-create-form";
const HIDDEN_TYPES = ["system", "stage_change", "assignment", "task", "sms"];
const DEFAULT_HOUR = 9;
const FALLBACK_DURATION_MINUTES = 30;

const PRIORITY_DOT: Record<(typeof ACTIVITY_PRIORITIES)[number], string> = {
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
  urgent: "bg-priority-urgent",
};

const dot = (className: string) => <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className)} />;

const PRIORITY_OPTIONS: ComboboxOption[] = ACTIVITY_PRIORITIES.map((p) => ({
  value: p,
  label: p[0].toUpperCase() + p.slice(1),
  visual: dot(PRIORITY_DOT[p]),
}));

const SERVER_ERRORS: ServerErrorRule<ActivityFormInput>[] = [
  { match: /must belong to a lead, customer, or deal/i, field: "linkId", message: "Choose the lead this activity is for" },
  { match: /unknown or inactive activity type/i, field: "typeCode", message: "That type is no longer available. Choose another." },
  { match: /invalid startAt/i, field: "startAt", message: "Enter a valid start time" },
  { match: /invalid endAt/i, field: "endAt", message: "Enter a valid end time" },
  { match: /invalid dueAt/i, field: "dueAt", message: "Enter a valid date and time" },
];

function rulesOf(type?: ActivityType): ActivityTypeRules {
  return {
    datetime: Boolean(type?.requiresDatetime),
    duration: Boolean(type?.requiresDuration),
    outcome: Boolean(type?.requiresOutcome),
    notes: Boolean(type?.requiresNotes),
  };
}

export function ActivityQuickCreateDialog({
  open,
  onOpenChange,
  context,
  defaultType,
  defaultDueAt,
  defaultLinkType = "lead",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: ActivityContext;
  /** Wins over the org's default activity type. */
  defaultType?: string;
  /** Local datetime-local value, e.g. 2026-09-24T09:00 */
  defaultDueAt?: string;
  /** Which record kind the link picker starts on when there's no context. */
  defaultLinkType?: ActivityLinkType;
  onCreated?: () => void;
}) {
  const { can } = useAuth();
  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
    enabled: open,
  });
  const settingsQuery = useQuery({
    queryKey: ["org-settings", "map"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open,
    staleTime: 60_000,
  });

  if (!open || !can("activities:create")) return null;
  if (!typesQuery.isFetched || !settingsQuery.isFetched) {
    return (
      <QuickCreateDialog open onOpenChange={onOpenChange} title="Create activity">
        <LoadingState compact label="Loading form…" />
      </QuickCreateDialog>
    );
  }
  return (
    <ActivityCreateBody
      onOpenChange={onOpenChange}
      context={context}
      defaultType={defaultType}
      defaultDueAt={defaultDueAt}
      defaultLinkType={defaultLinkType}
      types={typesQuery.data ?? []}
      settings={settingsQuery.data}
      onCreated={onCreated}
    />
  );
}

function ActivityCreateBody({
  onOpenChange,
  context,
  defaultType,
  defaultDueAt,
  defaultLinkType,
  types,
  settings,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  context?: ActivityContext;
  defaultType?: string;
  defaultDueAt?: string;
  defaultLinkType: ActivityLinkType;
  types: ActivityType[];
  settings?: Record<string, string>;
  onCreated?: () => void;
}) {
  const needsLink = !context?.customerId && !context?.dealId && !context?.leadId;
  const primaryTypes = React.useMemo(() => types.filter((t) => !HIDDEN_TYPES.includes(t.code)), [types]);
  const typeOptions = React.useMemo<ComboboxOption[]>(
    () => primaryTypes.map((t) => ({ value: t.code, label: t.name, visual: dot(typeDotClass(t.code, t.color)) })),
    [primaryTypes],
  );
  const typeByCode = React.useCallback((code: string) => types.find((t) => t.code === code), [types]);
  const durationMinutes = Number(settings?.["crm.default_activity_duration_minutes"]) || FALLBACK_DURATION_MINUTES;
  const baseTime = React.useMemo(() => defaultDueAt || tomorrowAt(DEFAULT_HOUR), [defaultDueAt]);

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [initialValues] = React.useState<ActivityFormInput>(() => {
    const has = (code?: string) => Boolean(code && primaryTypes.some((t) => t.code === code));
    const typeCode =
      [defaultType, settings?.["crm.default_activity_type"], "follow_up"].find(has) ?? primaryTypes[0]?.code ?? "";
    const rules = rulesOf(typeByCode(typeCode));
    const scheduled = rules.datetime || rules.duration || Boolean(defaultDueAt);
    return {
      linkType: defaultLinkType,
      linkId: "",
      linkCustomerId: "",
      typeCode,
      priority: "medium",
      dueAt: scheduled ? baseTime : "",
      startAt: rules.duration ? baseTime : "",
      endAt: rules.duration ? addMinutesLocal(baseTime, durationMinutes) : "",
      title: "",
      outcome: "",
      notes: "",
    };
  });

  const [schemaTypeCode, setSchemaTypeCode] = React.useState(initialValues.typeCode);
  const rules = React.useMemo(() => rulesOf(typeByCode(schemaTypeCode)), [typeByCode, schemaTypeCode]);
  const schema = React.useMemo(() => activitySchema(rules, { needsLink }), [rules, needsLink]);

  const form = useZodForm(schema, { defaultValues: initialValues });
  const typeCode = useWatch({ control: form.control, name: "typeCode" });
  if (typeCode !== schemaTypeCode) setSchemaTypeCode(typeCode);

  React.useEffect(() => {
    const sub = form.watch((v, { name, type }) => {
      if (type !== "change") return;
      if (name === "typeCode") {
        const next = rulesOf(typeByCode(v.typeCode ?? ""));
        if (next.duration && !v.startAt) {
          const start = v.dueAt || baseTime;
          form.setValue("startAt", start);
          if (!v.endAt) form.setValue("endAt", addMinutesLocal(start, durationMinutes));
        } else if (next.datetime && !next.duration && !v.dueAt) {
          form.setValue("dueAt", v.startAt || baseTime);
        }
      }
      if (name === "startAt" && v.startAt) {
        const end = v.endAt ? new Date(v.endAt).getTime() : NaN;
        if (!(end > new Date(v.startAt).getTime())) {
          form.setValue("endAt", addMinutesLocal(v.startAt, durationMinutes), {
            shouldValidate: form.getFieldState("endAt").isTouched,
          });
        }
      }
    });
    return () => sub.unsubscribe();
  }, [form, typeByCode, baseTime, durationMinutes]);

  const onInvalid: SubmitErrorHandler<ActivityFormInput> = () => focusFirstInvalid(bodyRef.current);

  const save = async (values: ActivityFormValues) => {
    setFormError(null);
    const r = rulesOf(typeByCode(values.typeCode));
    const link = needsLink
      ? {
          customerId:
            values.linkType === "customer"
              ? values.linkId
              : values.linkType === "deal"
                ? values.linkCustomerId || null
                : null,
          leadId: values.linkType === "lead" ? values.linkId : null,
          dealId: values.linkType === "deal" ? values.linkId : null,
        }
      : {
          customerId: context?.customerId || null,
          leadId: context?.leadId || null,
          dealId: context?.dealId || null,
        };
    const schedule = r.duration
      ? { startAt: localToIso(values.startAt), endAt: localToIso(values.endAt), dueAt: localToIso(values.startAt) }
      : r.datetime
        ? { startAt: localToIso(values.dueAt), endAt: null, dueAt: localToIso(values.dueAt) }
        : { startAt: null, endAt: null, dueAt: localToIso(values.dueAt) };
    try {
      await crmApi.createActivity({
        title: values.title || undefined,
        typeCode: values.typeCode,
        kind: values.typeCode,
        priority: values.priority,
        status: "upcoming",
        notes: values.notes,
        outcome: values.outcome || undefined,
        ...link,
        ...schedule,
      });
    } catch (err) {
      if (applyServerError(form, err, SERVER_ERRORS)) {
        focusFirstInvalid(bodyRef.current);
        return;
      }
      setFormError(err instanceof Error && err.message ? err.message : copy.error.generic);
      return;
    }
    toast.success("Activity created");
    onOpenChange(false);
    onCreated?.();
  };

  const selectedType = typeByCode(typeCode);

  const footer = (
    <div className="flex w-full flex-col gap-2">
      {formError ? (
        <p role="alert" className="text-caption text-danger">
          {formError}
        </p>
      ) : null}
      <div className="flex w-full justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <SubmitButton form={FORM_ID}>Create activity</SubmitButton>
      </div>
    </div>
  );

  return (
    <FormScope form={form} schema={schema}>
      <QuickCreateDialog
        open
        onOpenChange={onOpenChange}
        title="Create activity"
        description="Times use your local timezone."
        footer={footer}
      >
        <div ref={bodyRef}>
          <Form id={FORM_ID} form={form} schema={schema} onSubmit={save} onInvalid={onInvalid} className="space-y-5">
            <div className="space-y-4">
              {needsLink ? <LinkField control={form.control} /> : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ComboboxField name="typeCode" label="Type" options={typeOptions} placeholder="Choose a type" />
                <ComboboxField name="priority" label="Priority" options={PRIORITY_OPTIONS} />
              </div>

              {rules.duration ? (
                <>
                  <DateTimeField name="startAt" label="Starts" deps={["endAt"]} />
                  <DateTimeField name="endAt" label="Ends" />
                </>
              ) : rules.datetime ? (
                <DateTimeField name="dueAt" label="When" />
              ) : (
                <DateTimeField name="dueAt" label="Due" helper="Optional" placeholder="No due date" />
              )}
            </div>

            <div className="space-y-4 border-t border-line pt-5">
              <TextField
                name="title"
                label="Title"
                autoComplete="off"
                placeholder={selectedType?.name ?? "Defaults to the activity type"}
                helper="Optional. Up to three words. Defaults to the activity type."
              />

              {rules.outcome ? (
                <TextField name="outcome" label="Outcome" placeholder="Connected, no answer, voicemail…" />
              ) : null}

              <TextareaField name="notes" label="Notes" rows={3} />
            </div>
          </Form>
        </div>
      </QuickCreateDialog>
    </FormScope>
  );
}

type ActivityControl = Control<ActivityFormInput, unknown, ActivityFormValues>;

function LinkField({ control }: { control: ActivityControl }) {
  const link = useController({ control, name: "linkId" });
  const error = link.fieldState.error?.message;
  const [lead, setLead] = React.useState<LeadOption | null>(null);
  const picked = lead && lead.value === link.field.value ? lead : null;

  return (
    <div>
      <Field label="Lead" required error={error}>
        <LeadCombobox
          value={link.field.value || null}
          selected={picked}
          onChange={(id, option) => {
            setLead(option);
            link.field.onChange(id ?? "");
            link.field.onBlur();
          }}
          triggerClassName={formTriggerClass}
        />
      </Field>
      <div aria-live="polite">{picked ? <SelectedLead lead={picked} /> : null}</div>
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/** Confirms who the activity is for once a lead is picked. */
function SelectedLead({ lead }: { lead: LeadOption }) {
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-md bg-surface-muted px-2.5 py-2">
      <Avatar size="sm">
        <AvatarFallback>{initials(lead.label)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-ink">{lead.label}</p>
        {lead.contact ? <p className="truncate text-caption text-ink-muted">{lead.contact}</p> : null}
      </div>
      {lead.stageName ? (
        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-caption font-medium text-brand-dark">
          {lead.stageName}
        </span>
      ) : null}
    </div>
  );
}
