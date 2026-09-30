"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useController,
  useFormState,
  useWatch,
  type Control,
  type SubmitErrorHandler,
} from "react-hook-form";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  CrmFormSection,
  focusFirstInvalid,
  Form,
  FormFieldSlot,
  FormScope,
  FormSummary,
  QuickCreateDrawer,
  SubmitButton,
  TextareaField,
  TextField,
  useFormDraft,
  useZodForm,
} from "@/components/forms";
import {
  CountryPicker,
  LeadSourceSelect,
  PipelineStagePickers,
  PriorityToggle,
  UserPicker,
} from "@/components/forms/entity-pickers";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import { Button } from "@/components/ui/console/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { DuplicateReviewDialog } from "@/components/shared/duplicate-review-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { UnifiedTimeline } from "@/features/timeline/unified-timeline";
import {
  emptyReferralForm,
  SmartReferralFields,
  toReferralInput,
} from "@/features/referrals/smart-referral-fields";
import { referralsApi } from "@/lib/api/referrals";
import {
  crmApi,
  DuplicateReviewError,
  type DuplicateMatch,
  type Lead,
  type Pipeline,
} from "@/lib/api/crm";
import { copy } from "@/lib/copy";
import { localToIso, toDateTimeLocal } from "@/lib/forms/datetime";
import { messages } from "@/lib/forms/messages";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { cn } from "@/lib/utils";
import {
  isReferralSource,
  LEAD_PRIORITIES,
  leadFormSchema,
  type LeadFormInput,
  type LeadFormValues,
} from "@/validations/lead";

const FORM_ID = "lead-form";

/** Fields that live under "More details" on create; revealed when one of them fails validation. */
const MORE_DETAIL_FIELDS = new Set<string>([
  "ownerUserId",
  "priority",
  "pipelineId",
  "stageId",
  "potentialValue",
  "nextActivityAt",
  "country",
  "nationality",
  "location",
  "occupation",
  "anzscoId",
  "jobTitle",
  "employer",
  "tags",
  "notes",
]);

const REFERRER_MESSAGE = "Choose who referred this lead, or type their name";

const SERVER_ERRORS: ServerErrorRule<LeadFormInput>[] = [
  { match: /full name is required/i, field: "fullName", message: messages.enter("the lead's name") },
  { match: /lead source is required/i, field: "source", message: messages.choose("where this lead came from") },
  { match: /referred by is required|referral details are required/i, field: "referral.referrerName", message: REFERRER_MESSAGE },
  { match: /invalid priority/i, field: "priority", message: messages.choose("a priority") },
  { match: /invalid nextActivityAt/i, field: "nextActivityAt", message: "Enter a valid date and time" },
];

type Settings = Record<string, string>;

function defaultValues(userId?: string, pipelines?: Pipeline[], settings?: Settings): LeadFormInput {
  const defaultPipelineId = settings?.["crm.default_pipeline_id"]?.trim();
  const pipeline =
    (defaultPipelineId ? pipelines?.find((p) => p.id === defaultPipelineId) : undefined) ?? pipelines?.[0];
  const priority = settings?.["crm.default_lead_priority"] as LeadFormInput["priority"] | undefined;
  return {
    fullName: "",
    email: "",
    phone: "",
    country: "",
    nationality: "",
    location: "",
    source: settings?.["crm.default_lead_source"]?.trim() ?? "",
    priority: priority && LEAD_PRIORITIES.includes(priority) ? priority : "medium",
    ownerUserId: userId ?? "",
    teamId: "",
    pipelineId: pipeline?.id ?? "",
    stageId: pipeline?.stages[0]?.id ?? "",
    anzscoId: null,
    occupation: "",
    jobTitle: "",
    employer: "",
    potentialValue: "",
    tags: "",
    notes: "",
    nextActivityAt: "",
    referral: emptyReferralForm(),
  };
}

function fromLead(lead: Lead, pipelines?: Pipeline[]): LeadFormInput {
  const priority = lead.priority as LeadFormInput["priority"];
  return {
    fullName: lead.fullName ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    country: lead.country ?? "",
    nationality: lead.nationality ?? "",
    location: lead.location ?? "",
    source: lead.source ?? "",
    priority: LEAD_PRIORITIES.includes(priority) ? priority : "medium",
    ownerUserId: lead.ownerUserId ?? "",
    teamId: lead.teamId ?? "",
    pipelineId: lead.pipelineId ?? pipelines?.[0]?.id ?? "",
    stageId: lead.stageId ?? "",
    anzscoId: lead.anzscoId ?? null,
    occupation: lead.occupation ?? "",
    jobTitle: lead.jobTitle ?? "",
    employer: lead.employer ?? "",
    potentialValue: lead.potentialValue?.toString() ?? "",
    tags: (lead.tags ?? []).join(", "),
    notes: lead.notes ?? "",
    nextActivityAt: toDateTimeLocal(lead.nextActivityAt),
    referral: undefined,
  };
}

function toPayload(
  values: LeadFormValues,
  opts: {
    isUpdate: boolean;
    force: boolean;
    customFields: Record<string, unknown>;
    canAssignOwner: boolean;
    currentUserId?: string;
  },
) {
  const { isUpdate } = opts;
  // The update endpoint treats null as "leave unchanged" and "" as "clear".
  const empty = isUpdate ? "" : null;
  const payload: Record<string, unknown> = {
    fullName: values.fullName,
    email: values.email || empty,
    phone: values.phone || empty,
    country: values.country,
    nationality: values.nationality,
    location: values.location,
    teamId: values.teamId && values.teamId !== "none" ? values.teamId : "",
    source: values.source,
    priority: values.priority,
    tags: values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    anzscoId: values.anzscoId || empty,
    pipelineId: values.pipelineId && values.pipelineId !== "none" ? values.pipelineId : null,
    stageId: values.stageId && values.stageId !== "none" ? values.stageId : null,
    notes: values.notes,
    occupation: values.occupation,
    jobTitle: values.jobTitle,
    employer: values.employer,
    potentialValue: values.potentialValue ? Number(values.potentialValue) : null,
    nextActivityAt: localToIso(values.nextActivityAt) ?? empty,
    // Create accepts forceCreate, update accepts forceUpdate; the API rejects unknown fields.
    ...(isUpdate ? { forceUpdate: opts.force } : { forceCreate: opts.force }),
    ...(Object.keys(opts.customFields).length ? { customFields: opts.customFields } : {}),
  };
  if (!isUpdate && isReferralSource(values.source) && values.referral) {
    payload.referral = toReferralInput(values.referral);
  }
  if (opts.canAssignOwner) {
    payload.ownerUserId = values.ownerUserId && values.ownerUserId !== "none" ? values.ownerUserId : "";
  } else if (!isUpdate) {
    payload.ownerUserId = opts.currentUserId ?? "";
  }
  return payload;
}

export function LeadCreateDrawer({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Lead | null;
  onSaved: (lead?: Lead) => void;
}) {
  const { user } = useAuth();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
    enabled: open,
  });
  const settingsQuery = useQuery({
    queryKey: ["org-settings", "map"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open && !initial,
    staleTime: 60_000,
  });
  const ready = pipelinesQuery.isFetched && (Boolean(initial) || settingsQuery.isFetched);

  if (!open) return null;
  if (!ready) {
    return (
      <QuickCreateDrawer open={open} onOpenChange={onOpenChange} title={initial ? "Edit lead" : "Create lead"}>
        <LoadingState compact label="Loading form…" />
      </QuickCreateDrawer>
    );
  }
  return (
    <LeadFormBody
      key={initial?.id ?? "new"}
      onOpenChange={onOpenChange}
      initial={initial}
      pipelines={pipelinesQuery.data ?? []}
      settings={settingsQuery.data}
      userId={user?.id}
      onSaved={onSaved}
    />
  );
}

function LeadFormBody({
  onOpenChange,
  initial,
  pipelines,
  settings,
  userId,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  initial?: Lead | null;
  pipelines: Pipeline[];
  settings?: Settings;
  userId?: string;
  onSaved: (lead?: Lead) => void;
}) {
  const router = useRouter();
  const { can, user } = useAuth();
  const canAssignOwner = user?.roleCode === "sales_manager";
  const isEdit = Boolean(initial);
  const canConvert = Boolean(initial && !initial.convertedCustomerId && can("customers:create"));

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [moreDetails, setMoreDetails] = React.useState(isEdit);
  const [created, setCreated] = React.useState<Lead | null>(null);
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);
  const [andAnotherPending, setAndAnotherPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [customFields, setCustomFields] = React.useState<Record<string, unknown>>({});
  const [convertOpen, setConvertOpen] = React.useState(false);
  const [converting, setConverting] = React.useState(false);

  const leadSourcesQuery = useQuery({
    queryKey: ["lead-sources", "form"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
  });
  const metaQuery = useQuery({
    queryKey: ["referrals", "meta"],
    queryFn: () => referralsApi.meta(),
    enabled: !isEdit,
  });
  const sourceNames = React.useMemo(
    () => (leadSourcesQuery.data ?? []).map((s) => s.name),
    [leadSourcesQuery.data],
  );

  const form = useZodForm(leadFormSchema, {
    defaultValues: initial ? fromLead(initial, pipelines) : defaultValues(userId, pipelines, settings),
  });
  const { isSubmitting } = useFormState({ control: form.control });
  const [source, pipelineId, stageId] = useWatch({
    control: form.control,
    name: ["source", "pipelineId", "stageId"],
  });
  const { restorePrompt, clearDraft } = useFormDraft({
    form,
    draftKey: isEdit ? undefined : `lead-create:v2:${userId ?? "anon"}`,
    enabled: !isEdit,
  });

  const resetForAnother = (keep: Pick<LeadFormInput, "source" | "ownerUserId" | "pipelineId" | "stageId" | "priority">) => {
    form.reset({ ...defaultValues(userId, pipelines, settings), ...keep });
    setCustomFields({});
    setCreated(null);
    setMoreDetails(false);
    setFormError(null);
    requestAnimationFrame(() => form.setFocus("fullName"));
  };

  const onInvalid: SubmitErrorHandler<LeadFormInput> = (errors) => {
    if (Object.keys(errors).some((name) => MORE_DETAIL_FIELDS.has(name))) setMoreDetails(true);
    focusFirstInvalid(bodyRef.current);
  };

  const save = async (values: LeadFormValues, { force = false, andAnother = false } = {}) => {
    setFormError(null);
    try {
      const payload = toPayload(values, {
        isUpdate: isEdit,
        force,
        customFields,
        canAssignOwner,
        currentUserId: userId,
      });
      setDuplicates([]);
      if (initial) {
        const updated = await crmApi.updateLead(initial.id, payload);
        toast.success("Lead updated");
        onOpenChange(false);
        onSaved(updated);
        return;
      }
      const lead = await crmApi.createLead(payload);
      clearDraft();
      onSaved(lead);
      if (andAnother) {
        resetForAnother(values);
        toast.success(`${lead.fullName} created. Ready for the next one.`);
      } else {
        toast.success("Lead created");
        setCreated(lead);
      }
    } catch (err) {
      if (err instanceof DuplicateReviewError) {
        setAndAnotherPending(andAnother);
        setDuplicates(err.duplicates);
        return;
      }
      if (applyServerError(form, err, SERVER_ERRORS)) {
        focusFirstInvalid(bodyRef.current);
        return;
      }
      setFormError(err instanceof Error && err.message ? err.message : copy.error.generic);
    }
  };

  const submit = (options?: { force?: boolean; andAnother?: boolean }) =>
    form.handleSubmit((values) => save(values, options), onInvalid)();

  const convert = async () => {
    if (!initial) return;
    setConverting(true);
    try {
      const customer = await crmApi.convertLead(initial.id);
      setConvertOpen(false);
      onOpenChange(false);
      onSaved();
      toast.success("Lead converted to customer");
      router.push(`/customers/${customer.id}`);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't convert this lead. Try again.");
    } finally {
      setConverting(false);
    }
  };

  const pipeline = pipelines.find((p) => p.id === pipelineId);

  const footer = created ? null : (
    <div className="flex w-full flex-col gap-2">
      {formError ? (
        <p role="alert" className="text-caption text-danger">
          {formError}
        </p>
      ) : null}
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {canConvert ? (
          <Button variant="ghost" className="mr-auto" disabled={isSubmitting} onClick={() => setConvertOpen(true)}>
            Convert to customer
          </Button>
        ) : null}
        <Button variant="ghost" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        {!isEdit ? (
          <Button variant="secondary" disabled={isSubmitting} onClick={() => void submit({ andAnother: true })}>
            Create &amp; add another
          </Button>
        ) : null}
        <SubmitButton form={FORM_ID}>{isEdit ? "Save changes" : "Create lead"}</SubmitButton>
      </div>
    </div>
  );

  return (
    <FormScope form={form} schema={leadFormSchema}>
      <QuickCreateDrawer
        open
        onOpenChange={onOpenChange}
        title={created ? "Lead created" : isEdit ? "Edit lead" : "Create lead"}
        description={created || isEdit ? undefined : "A name and source are enough to start. Add the rest now or later."}
        wide={moreDetails}
        className={cn(
          "shadow-[-6px_0_24px_rgba(42,40,56,0.06)]",
          !moreDetails && "sm:max-w-[460px]",
        )}
        footer={footer}
      >
        {created ? (
          <FormSummary
            title="Lead created successfully"
            headline={created.fullName}
            details={[pipeline?.name ?? created.pipelineName, created.stageName, created.source].filter(Boolean) as string[]}
            actions={[
              {
                label: "View Lead",
                onClick: () => {
                  onOpenChange(false);
                  router.push(`/leads`);
                },
                variant: "default",
              },
              {
                label: "Add Activity",
                onClick: () => {
                  onOpenChange(false);
                  router.push(`/activities?leadId=${created.id}`);
                },
              },
              {
                label: "Create another",
                onClick: () => resetForAnother(form.getValues()),
                variant: "secondary",
              },
            ]}
          />
        ) : (
          <div ref={bodyRef}>
            <Form id={FORM_ID} form={form} schema={leadFormSchema} onSubmit={(values) => save(values)} onInvalid={onInvalid} className="space-y-5">
              <CrmFormSection title="Contact">
                <TextField name="fullName" label="Full name" autoFocus autoComplete="off" />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <TextField name="phone" label="Phone" type="tel" inputMode="tel" autoComplete="off" />
                  <TextField name="email" label="Email" type="email" autoComplete="off" />
                </div>
              </CrmFormSection>

              <CrmFormSection title="Source" divided>
                <SourceField control={form.control} sources={sourceNames} />
                {isReferralSource(source) ? (
                  isEdit ? (
                    <p className="text-caption text-ink-muted">Referral details can’t be changed from this form.</p>
                  ) : (
                    <ReferralField control={form.control} meta={metaQuery.data} />
                  )
                ) : null}
              </CrmFormSection>

              {moreDetails ? (
                <>
                  <CrmFormSection title="Sales" divided>
                    {canAssignOwner ? <OwnerField control={form.control} /> : null}
                    <PriorityField control={form.control} />
                    <PipelineStageField control={form.control} pipelines={pipelines} />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <TextField name="potentialValue" label="Potential value" type="number" inputMode="decimal" min={0} step="0.01" />
                      <TextField name="nextActivityAt" label="Next follow-up" type="datetime-local" />
                    </div>
                  </CrmFormSection>

                  <CrmFormSection title="Profile" divided>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <CountryField control={form.control} />
                      <TextField name="nationality" label="Nationality" />
                      <TextField name="location" label="Location" className="sm:col-span-2" />
                      <TextField name="occupation" label="Occupation" />
                      <TextField name="jobTitle" label="Job title" />
                      <TextField name="employer" label="Employer" className="sm:col-span-2" />
                    </div>
                    <AnzscoField control={form.control} />
                  </CrmFormSection>

                  <CrmFormSection title="Notes" divided>
                    <TextField name="tags" label="Tags" helper="Separate tags with commas" />
                    <TextareaField name="notes" label="Notes" />
                  </CrmFormSection>

                  <CustomFieldsSection
                    entity="lead"
                    recordId={initial?.id}
                    values={customFields}
                    onChange={setCustomFields}
                    pipelineId={pipelineId}
                    stageId={stageId}
                  />
                </>
              ) : (
                <button
                  type="button"
                  aria-expanded={false}
                  className="inline-flex items-center gap-1 text-caption font-medium text-ink-secondary transition-colors hover:text-ink"
                  onClick={() => setMoreDetails(true)}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                  More details
                  <span className="font-normal text-ink-muted">· owner, pipeline, value, follow-up, profile, notes</span>
                </button>
              )}
            </Form>
            {initial ? (
              <div className="mt-5 space-y-5">
                <CrmFormSection title="Timeline" divided>
                  <UnifiedTimeline leadId={initial.id} />
                </CrmFormSection>
              </div>
            ) : null}
          </div>
        )}
      </QuickCreateDrawer>

      <DuplicateReviewDialog
        open={duplicates.length > 0}
        onOpenChange={(next) => !next && setDuplicates([])}
        duplicates={duplicates}
        loading={isSubmitting}
        onConfirm={() => void submit({ force: true, andAnother: andAnotherPending })}
      />
      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={`Convert ${initial?.fullName ?? "this lead"} to a customer?`}
        description="This creates a customer from the lead and opens it. Unsaved changes in this form aren't included."
        confirmLabel="Convert"
        loading={converting}
        onConfirm={convert}
      />
      {restorePrompt}
    </FormScope>
  );
}

type LeadControl = Control<LeadFormInput, unknown, LeadFormValues>;

function SourceField({ control, sources }: { control: LeadControl; sources: string[] }) {
  const { field, fieldState } = useController({ control, name: "source" });
  return (
    <LeadSourceSelect
      value={field.value}
      onChange={field.onChange}
      sources={sources}
      required
      error={fieldState.error?.message}
    />
  );
}

function ReferralField({
  control,
  meta,
}: {
  control: LeadControl;
  meta?: Awaited<ReturnType<typeof referralsApi.meta>>;
}) {
  const { field, formState } = useController({ control, name: "referral" });
  return (
    <SmartReferralFields
      value={field.value ?? emptyReferralForm()}
      onChange={field.onChange}
      meta={meta}
      error={formState.errors.referral?.referrerName?.message}
    />
  );
}

function OwnerField({ control }: { control: LeadControl }) {
  const { field } = useController({ control, name: "ownerUserId" });
  return <UserPicker value={field.value} onChange={field.onChange} label="Owner" />;
}

function PriorityField({ control }: { control: LeadControl }) {
  const { field } = useController({ control, name: "priority" });
  return <PriorityToggle value={field.value} onChange={field.onChange} />;
}

function PipelineStageField({ control, pipelines }: { control: LeadControl; pipelines: Pipeline[] }) {
  const pipeline = useController({ control, name: "pipelineId" });
  const stage = useController({ control, name: "stageId" });
  return (
    <PipelineStagePickers
      pipelines={pipelines}
      pipelineId={pipeline.field.value}
      stageId={stage.field.value}
      onPipelineChange={(pid, sid) => {
        pipeline.field.onChange(pid);
        stage.field.onChange(sid);
      }}
      onStageChange={stage.field.onChange}
    />
  );
}

function CountryField({ control }: { control: LeadControl }) {
  const { field } = useController({ control, name: "country" });
  return (
    <FormFieldSlot label="Country">
      <CountryPicker value={field.value} onChange={field.onChange} />
    </FormFieldSlot>
  );
}

function AnzscoField({ control }: { control: LeadControl }) {
  const { field } = useController({ control, name: "anzscoId" });
  return (
    <FormFieldSlot label="ANZSCO">
      <AnzscoCombobox value={field.value} onChange={(id) => field.onChange(id)} />
    </FormFieldSlot>
  );
}

/** Back-compat alias used by existing call sites. */
export const LeadFormDialog = LeadCreateDrawer;
