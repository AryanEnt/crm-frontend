"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useController, useWatch, type Control, type SubmitErrorHandler } from "react-hook-form";
import { toast } from "sonner";
import {
  focusFirstInvalid,
  Form,
  FormFieldSlot,
  FormScope,
  QuickCreateDrawer,
  SearchableSelect,
  SelectField,
  SubmitButton,
  TextareaField,
  TextField,
  useZodForm,
} from "@/components/forms";
import { Button } from "@/components/ui/console/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type ActivityType } from "@/lib/api/crm";
import { copy } from "@/lib/copy";
import { addMinutesLocal, localToIso, tomorrowAt } from "@/lib/forms/datetime";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_LINK_TYPES,
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

const LINK_LABELS: Record<ActivityLinkType, string> = { customer: "Customer", lead: "Lead", deal: "Deal" };

const SERVER_ERRORS: ServerErrorRule<ActivityFormInput>[] = [
  { match: /must belong to a lead, customer, or deal/i, field: "linkId", message: "Choose the record this activity is for" },
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
  defaultLinkType = "customer",
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
      <QuickCreateDrawer open onOpenChange={onOpenChange} title="Create activity">
        <LoadingState compact label="Loading form…" />
      </QuickCreateDrawer>
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
      <QuickCreateDrawer
        open
        onOpenChange={onOpenChange}
        title="Create activity"
        description="Times use your local timezone."
        className="shadow-[-6px_0_24px_rgba(42,40,56,0.06)] sm:max-w-[460px]"
        footer={footer}
      >
        <div ref={bodyRef}>
          <Form id={FORM_ID} form={form} schema={schema} onSubmit={save} onInvalid={onInvalid} className="space-y-4">
            {needsLink ? <LinkField control={form.control} /> : null}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <SelectField name="typeCode" label="Type">
                {primaryTypes.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
              <SelectField name="priority" label="Priority">
                {ACTIVITY_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </SelectField>
            </div>

            {rules.duration ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <TextField name="startAt" label="Starts" type="datetime-local" deps={["endAt"]} />
                <TextField name="endAt" label="Ends" type="datetime-local" />
              </div>
            ) : rules.datetime ? (
              <TextField name="dueAt" label="When" type="datetime-local" />
            ) : (
              <TextField name="dueAt" label="Due" type="datetime-local" helper="Optional" />
            )}

            <TextField
              name="title"
              label="Title"
              autoComplete="off"
              placeholder={selectedType?.name ?? "Defaults to the activity type"}
              helper="Optional. Defaults to the activity type."
            />

            {rules.outcome ? (
              <TextField name="outcome" label="Outcome" placeholder="Connected, no answer, voicemail…" />
            ) : null}

            <TextareaField name="notes" label="Notes" />
          </Form>
        </div>
      </QuickCreateDrawer>
    </FormScope>
  );
}

type ActivityControl = Control<ActivityFormInput, unknown, ActivityFormValues>;

function LinkField({ control }: { control: ActivityControl }) {
  const linkType = useController({ control, name: "linkType" });
  const link = useController({ control, name: "linkId" });
  const linkCustomer = useController({ control, name: "linkCustomerId" });
  const dealCustomers = React.useRef(new Map<string, string>());
  const kind = linkType.field.value;
  const error = link.fieldState.error?.message;

  const search = React.useCallback(
    async (q: string) => {
      const params = new URLSearchParams({ limit: "20", q });
      if (kind === "lead") {
        const res = await crmApi.listLeads(params);
        return (res.data ?? []).map((l) => ({
          value: l.id,
          label: l.fullName,
          description: l.email ?? l.phone ?? undefined,
        }));
      }
      if (kind === "deal") {
        const res = await crmApi.listDeals(params);
        for (const d of res.data ?? []) dealCustomers.current.set(d.id, d.customerId);
        return (res.data ?? []).map((d) => ({ value: d.id, label: d.title, description: d.customerName }));
      }
      const res = await crmApi.listCustomers(params);
      return (res.data ?? []).map((c) => ({ value: c.id, label: c.fullName, description: c.email ?? undefined }));
    },
    [kind],
  );

  return (
    <FormFieldSlot label="For" required error={error}>
      <div className="space-y-2" data-invalid={error ? "true" : undefined}>
        <div role="radiogroup" aria-label="Record type" className="grid grid-cols-3 gap-1 rounded-control bg-surface-muted p-0.5">
          {ACTIVITY_LINK_TYPES.map((t) => {
            const active = kind === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  if (active) return;
                  linkType.field.onChange(t);
                  link.field.onChange("");
                  linkCustomer.field.onChange("");
                }}
                className={cn(
                  "h-7 rounded-[calc(var(--radius-control)-2px)] text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                  active ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink",
                )}
              >
                {LINK_LABELS[t]}
              </button>
            );
          })}
        </div>
        <SearchableSelect
          key={kind}
          value={link.field.value || null}
          onChange={(id) => {
            link.field.onChange(id ?? "");
            linkCustomer.field.onChange(kind === "deal" && id ? (dealCustomers.current.get(id) ?? "") : "");
            link.field.onBlur();
          }}
          onSearch={search}
          placeholder={`Search ${LINK_LABELS[kind].toLowerCase()}s…`}
          searchPlaceholder="Type a name…"
          emptyText={`No matching ${LINK_LABELS[kind].toLowerCase()}s found.`}
          error={Boolean(error)}
        />
      </div>
    </FormFieldSlot>
  );
}
