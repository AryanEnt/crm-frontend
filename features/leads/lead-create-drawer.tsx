"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  QuickCreateDrawer,
  FormFieldGroup,
  FormFieldSlot,
  FormProgress,
  FormSummary,
  CrmFormSection,
  CRM_FIELD_INPUT_CLASS,
  clearFormDraft,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnzscoCombobox } from "@/components/shared/anzsco-combobox";
import { DuplicateReviewDialog } from "@/components/shared/duplicate-review-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import {
  CountryPicker,
  LeadSourceSelect,
  PipelineStagePickers,
  PriorityToggle,
  UserPicker,
} from "@/components/forms/entity-pickers";
import { useAuth } from "@/features/auth/auth-provider";
import {
  emptyReferralForm,
  SmartReferralFields,
  toReferralInput,
  type ReferralFormState,
} from "@/features/referrals/smart-referral-fields";
import { referralsApi } from "@/lib/api/referrals";
import {
  crmApi,
  DuplicateReviewError,
  type DuplicateMatch,
  type Lead,
  type Pipeline,
} from "@/lib/api/crm";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import {
  LEAD_GUIDED_STEPS,
  leadFormSchema,
  type LeadFormValues,
} from "@/validations/lead";
import type { FormMode } from "@/components/forms/types";
import { cn } from "@/lib/utils";

function defaultValues(
  userId?: string,
  pipelines?: Pipeline[],
  settings?: Record<string, string>,
): LeadFormValues {
  const defaultPipelineId = settings?.["crm.default_pipeline_id"]?.trim();
  const pipeline =
    (defaultPipelineId ? pipelines?.find((p) => p.id === defaultPipelineId) : undefined) ??
    pipelines?.[0];
  const priority = (settings?.["crm.default_lead_priority"] ?? "medium") as LeadFormValues["priority"];
  const validPriority = ["low", "medium", "high", "urgent"].includes(priority) ? priority : "medium";
  return {
    fullName: "",
    email: "",
    phone: "",
    country: "",
    nationality: "",
    location: "",
    source: settings?.["crm.default_lead_source"]?.trim() ?? "",
    priority: validPriority,
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
  };
}

function fromLead(lead: Lead, pipelines?: Pipeline[]): LeadFormValues {
  return {
    fullName: lead.fullName ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    country: lead.country ?? "",
    nationality: lead.nationality ?? "",
    location: lead.location ?? "",
    source: lead.source ?? "",
    priority: (lead.priority as LeadFormValues["priority"]) || "medium",
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
    nextActivityAt: "",
  };
}

function toPayload(
  values: LeadFormValues,
  referral: ReferralFormState,
  force: boolean,
  customFields?: Record<string, unknown>,
  isUpdate = false,
  ownerPolicy?: { canAssign: boolean; currentUserId?: string },
) {
  const isReferral = values.source.trim().toLowerCase() === "referral";
  const payload: Record<string, unknown> = {
    fullName: values.fullName.trim(),
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    country: values.country ?? "",
    nationality: values.nationality ?? "",
    location: values.location ?? "",
    teamId: values.teamId && values.teamId !== "none" ? values.teamId : "",
    source: values.source,
    priority: values.priority,
    tags: (values.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    anzscoId: values.anzscoId,
    pipelineId: values.pipelineId && values.pipelineId !== "none" ? values.pipelineId : null,
    stageId: values.stageId && values.stageId !== "none" ? values.stageId : null,
    notes: values.notes ?? "",
    occupation: values.occupation ?? "",
    jobTitle: values.jobTitle ?? "",
    employer: values.employer ?? "",
    potentialValue: values.potentialValue ? Number(values.potentialValue) : null,
    nextActivityAt: values.nextActivityAt
      ? new Date(values.nextActivityAt).toISOString()
      : null,
    // Create accepts forceCreate; update accepts forceUpdate — never both (DisallowUnknownFields).
    ...(isUpdate ? { forceUpdate: force } : { forceCreate: force }),
    referral: isReferral ? toReferralInput(referral) : undefined,
    ...(customFields && Object.keys(customFields).length
      ? { customFields }
      : {}),
  };
  if (!ownerPolicy || ownerPolicy.canAssign) {
    payload.ownerUserId =
      values.ownerUserId && values.ownerUserId !== "none" ? values.ownerUserId : "";
  } else if (!isUpdate) {
    // Sales executives / support: always own what they create.
    payload.ownerUserId = ownerPolicy.currentUserId ?? "";
  }
  // On edit without assign rights, omit ownerUserId so it cannot be changed.
  return payload;
}

export function LeadCreateDrawer({
  open,
  onOpenChange,
  initial,
  onSaved,
  defaultMode = "quick",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Lead | null;
  onSaved: (lead?: Lead) => void;
  defaultMode?: FormMode;
}) {
  const { user } = useAuth();
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
    enabled: open,
  });
  const ready = !open || pipelinesQuery.isFetched;

  if (!ready) {
    return (
      <QuickCreateDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={initial ? "Edit Lead" : "Create Lead"}
      >
        <LoadingState compact label="Loading form…" />
      </QuickCreateDrawer>
    );
  }

  return open ? (
    <LeadCreateBody
      key={`${initial?.id ?? "new"}-${pipelinesQuery.dataUpdatedAt}-${defaultMode}`}
      open={open}
      onOpenChange={onOpenChange}
      initial={initial}
      pipelines={pipelinesQuery.data ?? []}
      userId={user?.id}
      onSaved={onSaved}
      defaultMode={initial ? "edit" : defaultMode}
    />
  ) : null;
}

function LeadCreateBody({
  open,
  onOpenChange,
  initial,
  pipelines,
  userId,
  onSaved,
  defaultMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Lead | null;
  pipelines: Pipeline[];
  userId?: string;
  onSaved: (lead?: Lead) => void;
  defaultMode: FormMode;
}) {
  const router = useRouter();
  const { can, user } = useAuth();
  const canAssignOwner = user?.roleCode === "sales_manager";
  const isEdit = Boolean(initial);
  const [mode, setMode] = React.useState<FormMode>(defaultMode);
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);
  const [dupOpen, setDupOpen] = React.useState(false);
  const [referral, setReferral] = React.useState<ReferralFormState>(emptyReferralForm);
  const [created, setCreated] = React.useState<Lead | null>(null);
  const [addAnother, setAddAnother] = React.useState(false);
  const [moreDetails, setMoreDetails] = React.useState(false);
  const [customFields, setCustomFields] = React.useState<Record<string, unknown>>({});
  const draftKey = isEdit ? undefined : `lead-create:${userId ?? "anon"}`;

  const leadSourcesQuery = useQuery({
    queryKey: ["lead-sources", "form"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    enabled: open,
  });
  const settingsQuery = useQuery({
    queryKey: ["org-settings", "map"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open && !isEdit,
    staleTime: 60_000,
  });
  const sourceNames = React.useMemo(
    () => (leadSourcesQuery.data ?? []).map((s) => s.name),
    [leadSourcesQuery.data],
  );

  const metaQuery = useQuery({
    queryKey: ["referrals", "meta"],
    queryFn: () => referralsApi.meta(),
    enabled: open,
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: initial ? fromLead(initial, pipelines) : defaultValues(userId, pipelines),
    mode: "onTouched",
  });

  React.useEffect(() => {
    if (!open || isEdit || !settingsQuery.data) return;
    const defaults = defaultValues(userId, pipelines, settingsQuery.data);
    const current = form.getValues();
    if (!current.source && defaults.source) form.setValue("source", defaults.source);
    if (defaults.pipelineId && (!current.pipelineId || current.pipelineId === pipelines[0]?.id)) {
      form.setValue("pipelineId", defaults.pipelineId);
      form.setValue("stageId", defaults.stageId ?? "");
    }
    if (defaults.priority && current.priority === "medium") {
      form.setValue("priority", defaults.priority);
    }
  }, [open, isEdit, settingsQuery.data, userId, pipelines, form]);

  const values = form.watch();
  const isReferral = values.source?.trim().toLowerCase() === "referral";

  // Draft autosave
  React.useEffect(() => {
    if (!draftKey || isEdit) return;
    const sub = form.watch((v) => {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(
            `crm-form-draft:${draftKey}`,
            JSON.stringify({ values: v, referral, savedAt: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      }, 800);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [draftKey, form, referral, isEdit]);

  const resetForAnother = () => {
    const defaults = defaultValues(userId, pipelines, settingsQuery.data);
    form.reset({
      ...defaults,
      source: values.source,
      ownerUserId: values.ownerUserId,
      pipelineId: values.pipelineId,
      stageId: values.stageId,
      priority: values.priority,
    });
    setReferral(emptyReferralForm());
    setCreated(null);
    setStep(0);
    setMode("quick");
    setMoreDetails(false);
    setError(null);
  };

  const save = async (force: boolean, andAnother = false) => {
    const ok = await form.trigger();
    if (!ok) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
      toast.error("Fix the highlighted fields, then continue.");
      return;
    }
    const data = form.getValues();
    if (data.source.trim().toLowerCase() === "referral") {
      const hasLink =
        (referral.referrerUserId && referral.referrerUserId !== "none") ||
        (referral.referrerCustomerId && referral.referrerCustomerId !== "none") ||
        (referral.referrerPartnerId && referral.referrerPartnerId !== "none") ||
        Boolean(referral.referrerName.trim());
      if (!hasLink) {
        toast.error("Select or enter who referred this lead.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setAddAnother(andAnother);
    try {
      const payload = toPayload(data, referral, force, customFields, Boolean(initial), {
        canAssign: canAssignOwner,
        currentUserId: userId,
      });
      if (initial) {
        const updated = await crmApi.updateLead(initial.id, payload);
        toast.success("Lead updated");
        if (draftKey) clearFormDraft(draftKey);
        setDupOpen(false);
        onOpenChange(false);
        onSaved(updated);
      } else {
        const lead = await crmApi.createLead(payload);
        toast.success("Lead created");
        if (draftKey) clearFormDraft(draftKey);
        setDupOpen(false);
        if (andAnother) {
          resetForAnother();
          toast.message(`${lead.fullName} created — ready for another`);
        } else {
          setCreated(lead);
        }
        onSaved(lead);
      }
    } catch (err) {
      if (err instanceof DuplicateReviewError) {
        setDuplicates(err.duplicates);
        setDupOpen(true);
        toast.warning("Possible duplicates found — review before continuing");
      } else {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Couldn't save the lead. Check required fields and try again.";
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const title = isEdit ? "Edit Lead" : mode === "guided" ? "Create Lead" : "Create Lead";
  const description = isEdit
    ? "Update details. Optional fields can stay empty."
    : "Add the essentials now. Enrich the profile anytime.";

  const pipeline = pipelines.find((p) => p.id === values.pipelineId);

  const footer =
    created ? null : (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-9 px-3 text-[13px] text-foreground-muted"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        {!isEdit && mode === "quick" ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-[13px]"
            disabled={loading}
            loading={loading}
            onClick={() => void save(false, true)}
          >
            Create & Add Another
          </Button>
        ) : null}
        {mode === "guided" && step < LEAD_GUIDED_STEPS.length - 1 ? (
          <Button
            type="button"
            className="h-9 px-4 text-[13px]"
            onClick={async () => {
              const fieldsByStep: (keyof LeadFormValues)[][] = [
                ["fullName", "email", "phone", "country"],
                ["source", "priority", "occupation", "nationality"],
                ["ownerUserId", "pipelineId", "stageId", "potentialValue"],
              ];
              const ok = await form.trigger(fieldsByStep[step]);
              if (!ok) return;
              if (step === 1 && isReferral) {
                const hasLink =
                  (referral.referrerUserId && referral.referrerUserId !== "none") ||
                  (referral.referrerCustomerId && referral.referrerCustomerId !== "none") ||
                  (referral.referrerPartnerId && referral.referrerPartnerId !== "none") ||
                  Boolean(referral.referrerName.trim());
                if (!hasLink) {
                  toast.error("Select or enter who referred this lead.");
                  return;
                }
              }
              setStep((s) => s + 1);
            }}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            className="h-9 px-4 text-[13px]"
            loading={loading}
            onClick={() => void save(false, false)}
          >
            {isEdit ? "Save changes" : "Create Lead"}
          </Button>
        )}
      </div>
    );

  return (
    <>
      <QuickCreateDrawer
        open={open}
        onOpenChange={(v) => {
          if (!v && created) {
            setCreated(null);
          }
          onOpenChange(v);
        }}
        title={created ? "Lead created" : title}
        description={created ? undefined : description}
        wide={mode === "guided" || mode === "full" || moreDetails || isEdit}
        className={cn(
          "shadow-[-6px_0_24px_rgba(42,40,56,0.06)]",
          mode === "quick" && !moreDetails && !isEdit && "sm:max-w-[460px]",
        )}
        footer={footer}
      >
        {created ? (
          <FormSummary
            title="Lead created successfully"
            headline={created.fullName}
            details={[
              pipeline?.name ?? created.pipelineName,
              created.stageName,
              created.source,
            ].filter(Boolean) as string[]}
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
                onClick: resetForAnother,
                variant: "secondary",
              },
            ]}
          />
        ) : (
          <div className="space-y-5">
            {isEdit && can("customers:create") && initial && !initial.convertedCustomerId ? (
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  void (async () => {
                    setLoading(true);
                    try {
                      const customer = await crmApi.convertLead(initial.id);
                      onOpenChange(false);
                      onSaved();
                      toast.success("Lead converted to customer");
                      router.push(`/customers/${customer.id}`);
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Couldn't convert to customer. Check required fields and try again.",
                      );
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
              >
                Convert to customer
              </Button>
            ) : null}
            {!isEdit ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 border-b border-border">
                  <ModeChip active={mode === "quick"} onClick={() => { setMode("quick"); setStep(0); }}>
                    Quick
                  </ModeChip>
                  <ModeChip
                    active={mode === "guided"}
                    onClick={() => {
                      setMode("guided");
                      setStep(0);
                    }}
                  >
                    Guided
                  </ModeChip>
                </div>
                {mode === "guided" ? (
                  <FormProgress
                    steps={[...LEAD_GUIDED_STEPS]}
                    currentStep={step}
                    onStepClick={setStep}
                  />
                ) : null}
              </div>
            ) : null}

            {(mode === "quick" || isEdit) && !moreDetails && mode !== "guided" ? (
              <QuickFields
                form={form}
                referral={referral}
                setReferral={setReferral}
                isReferral={isReferral}
                meta={metaQuery.data}
                pipelines={pipelines}
                moreDetails={moreDetails}
                onMoreDetails={() => setMoreDetails(true)}
                showExtras={isEdit || moreDetails}
                sourceNames={sourceNames}
                canAssignOwner={canAssignOwner}
              />
            ) : null}

            {mode === "guided" ? (
              <GuidedSteps
                step={step}
                form={form}
                referral={referral}
                setReferral={setReferral}
                isReferral={isReferral}
                meta={metaQuery.data}
                pipelines={pipelines}
                sourceNames={sourceNames}
                canAssignOwner={canAssignOwner}
              />
            ) : null}

            {(moreDetails || mode === "full") && mode !== "guided" ? (
              <FullDetailsFields
                form={form}
                referral={referral}
                setReferral={setReferral}
                isReferral={isReferral}
                meta={metaQuery.data}
                pipelines={pipelines}
                sourceNames={sourceNames}
                canAssignOwner={canAssignOwner}
              />
            ) : null}

            {(moreDetails || isEdit || mode === "guided") && (
              <CustomFieldsSection
                entity="lead"
                recordId={initial?.id}
                values={customFields}
                onChange={setCustomFields}
                enabled={open}
                pipelineId={values.pipelineId}
                stageId={values.stageId}
              />
            )}

            {mode === "guided" && step === LEAD_GUIDED_STEPS.length - 1 ? (
              <button
                type="button"
                className="text-[12px] font-medium text-foreground-muted transition-colors hover:text-foreground"
                onClick={() => setMoreDetails((v) => !v)}
              >
                {moreDetails ? "Hide extra details" : "Add more details"}
              </button>
            ) : null}

            {moreDetails && mode === "guided" ? (
              <ExtraOptionalFields form={form} />
            ) : null}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        )}
      </QuickCreateDrawer>

      <DuplicateReviewDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        duplicates={duplicates}
        loading={loading}
        onConfirm={() => void save(true, addAnother)}
      />
    </>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "-mb-px border-b-2 border-brand pb-2 text-[13px] font-semibold text-foreground"
          : "border-b-2 border-transparent pb-2 text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

function QuickFields({
  form,
  referral,
  setReferral,
  isReferral,
  meta,
  pipelines,
  onMoreDetails,
  showExtras,
  sourceNames,
  canAssignOwner,
}: {
  form: ReturnType<typeof useForm<LeadFormValues>>;
  referral: ReferralFormState;
  setReferral: (v: ReferralFormState) => void;
  isReferral: boolean;
  meta?: Awaited<ReturnType<typeof referralsApi.meta>>;
  pipelines: Pipeline[];
  moreDetails: boolean;
  onMoreDetails: () => void;
  showExtras: boolean;
  sourceNames: string[];
  canAssignOwner: boolean;
}) {
  const {
    register,
    control,
    formState: { errors },
    setValue,
    watch,
  } = form;
  const values = watch();

  return (
    <div className="space-y-5">
      <CrmFormSection title="Contact">
        <FormFieldSlot label="Full Name" required htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoFocus
            error={Boolean(errors.fullName)}
            {...register("fullName")}
            placeholder="Full name"
            className={CRM_FIELD_INPUT_CLASS}
          />
        </FormFieldSlot>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FormFieldSlot label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="Phone"
              className={CRM_FIELD_INPUT_CLASS}
            />
          </FormFieldSlot>
          <FormFieldSlot label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              error={Boolean(errors.email)}
              {...register("email")}
              placeholder="Email"
              className={CRM_FIELD_INPUT_CLASS}
            />
          </FormFieldSlot>
        </div>
      </CrmFormSection>

      <CrmFormSection title="Lead details" divided>
        <Controller
          control={control}
          name="source"
          render={({ field, fieldState }) => (
            <LeadSourceSelect
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                if (v.toLowerCase() === "referral") {
                  setReferral({
                    ...referral,
                    referralDate: referral.referralDate || emptyReferralForm().referralDate,
                  });
                }
              }}
              sources={sourceNames}
              required
              error={Boolean(fieldState.error)}
              triggerClassName={CRM_FIELD_INPUT_CLASS}
            />
          )}
        />
        {isReferral ? (
          <SmartReferralFields value={referral} onChange={setReferral} meta={meta} />
        ) : null}
        {canAssignOwner ? (
          <Controller
            control={control}
            name="ownerUserId"
            render={({ field }) => (
              <UserPicker
                value={field.value}
                onChange={field.onChange}
                label="Owner"
                triggerClassName={CRM_FIELD_INPUT_CLASS}
              />
            )}
          />
        ) : null}
        <PriorityToggle value={values.priority} onChange={(v) => setValue("priority", v)} />
      </CrmFormSection>

      {showExtras ? (
        <>
          <CrmFormSection title="Location" divided>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <FormFieldSlot label="Country">
                  <CountryPicker value={field.value} onChange={field.onChange} />
                </FormFieldSlot>
              )}
            />
          </CrmFormSection>
          <CrmFormSection title="Sales" divided>
            <PipelineStagePickers
              pipelines={pipelines}
              pipelineId={values.pipelineId ?? ""}
              stageId={values.stageId ?? ""}
              onPipelineChange={(pid, sid) => {
                setValue("pipelineId", pid);
                setValue("stageId", sid);
              }}
              onStageChange={(sid) => setValue("stageId", sid)}
            />
          </CrmFormSection>
        </>
      ) : (
        <button
          type="button"
          className="text-[12px] font-medium text-foreground-muted transition-colors hover:text-foreground"
          onClick={onMoreDetails}
        >
          Add more details
        </button>
      )}
    </div>
  );
}

function GuidedSteps({
  step,
  form,
  referral,
  setReferral,
  isReferral,
  meta,
  pipelines,
  sourceNames,
  canAssignOwner,
}: {
  step: number;
  form: ReturnType<typeof useForm<LeadFormValues>>;
  referral: ReferralFormState;
  setReferral: (v: ReferralFormState) => void;
  isReferral: boolean;
  meta?: Awaited<ReturnType<typeof referralsApi.meta>>;
  pipelines: Pipeline[];
  sourceNames: string[];
  canAssignOwner: boolean;
}) {
  const {
    register,
    control,
    formState: { errors },
    setValue,
    watch,
  } = form;
  const values = watch();

  if (step === 0) {
    return (
      <CrmFormSection title="Basic information">
        <FormFieldSlot label="Full Name" required error={errors.fullName?.message}>
          <Input
            autoFocus
            error={Boolean(errors.fullName)}
            {...register("fullName")}
            className={CRM_FIELD_INPUT_CLASS}
          />
        </FormFieldSlot>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <FormFieldSlot label="Phone">
            <Input {...register("phone")} className={CRM_FIELD_INPUT_CLASS} />
          </FormFieldSlot>
          <FormFieldSlot label="Email" error={errors.email?.message}>
            <Input
              type="email"
              error={Boolean(errors.email)}
              {...register("email")}
              className={CRM_FIELD_INPUT_CLASS}
            />
          </FormFieldSlot>
        </div>
        <Controller
          control={control}
          name="country"
          render={({ field }) => (
            <FormFieldSlot label="Country">
              <CountryPicker value={field.value} onChange={field.onChange} />
            </FormFieldSlot>
          )}
        />
      </CrmFormSection>
    );
  }

  if (step === 1) {
    return (
      <CrmFormSection title="Qualification">
        <FormFieldSlot label="Occupation">
          <Input
            {...register("occupation")}
            placeholder="Occupation"
            className={CRM_FIELD_INPUT_CLASS}
          />
        </FormFieldSlot>
        <FormFieldSlot label="ANZSCO">
          <Controller
            control={control}
            name="anzscoId"
            render={({ field }) => (
              <AnzscoCombobox value={field.value} onChange={(id) => field.onChange(id)} />
            )}
          />
        </FormFieldSlot>
        <FormFieldSlot label="Nationality">
          <Input
            {...register("nationality")}
            placeholder="Nationality"
            className={CRM_FIELD_INPUT_CLASS}
          />
        </FormFieldSlot>
        <Controller
          control={control}
          name="source"
          render={({ field, fieldState }) => (
            <LeadSourceSelect
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                if (v.toLowerCase() === "referral") {
                  setReferral({
                    ...referral,
                    referralDate: referral.referralDate || emptyReferralForm().referralDate,
                  });
                }
              }}
              sources={sourceNames}
              required
              error={Boolean(fieldState.error)}
              triggerClassName={CRM_FIELD_INPUT_CLASS}
            />
          )}
        />
        {isReferral ? (
          <SmartReferralFields value={referral} onChange={setReferral} meta={meta} />
        ) : null}
        <PriorityToggle value={values.priority} onChange={(v) => setValue("priority", v)} />
      </CrmFormSection>
    );
  }

  return (
    <CrmFormSection title="Sales setup">
      {canAssignOwner ? (
        <Controller
          control={control}
          name="ownerUserId"
          render={({ field }) => (
            <UserPicker
              value={field.value}
              onChange={field.onChange}
              label="Owner"
              triggerClassName={CRM_FIELD_INPUT_CLASS}
            />
          )}
        />
      ) : null}
      <PipelineStagePickers
        pipelines={pipelines}
        pipelineId={values.pipelineId ?? ""}
        stageId={values.stageId ?? ""}
        onPipelineChange={(pid, sid) => {
          setValue("pipelineId", pid);
          setValue("stageId", sid);
        }}
        onStageChange={(sid) => setValue("stageId", sid)}
      />
      <FormFieldSlot label="Potential Value">
        <Input
          type="number"
          min={0}
          step="0.01"
          {...register("potentialValue")}
          placeholder="$"
          className={CRM_FIELD_INPUT_CLASS}
        />
      </FormFieldSlot>
      <FormFieldSlot label="Next Follow-up">
        <Input type="datetime-local" {...register("nextActivityAt")} className={CRM_FIELD_INPUT_CLASS} />
      </FormFieldSlot>
    </CrmFormSection>
  );
}

function FullDetailsFields({
  form,
  referral,
  setReferral,
  isReferral,
  meta,
  pipelines,
  sourceNames,
  canAssignOwner,
}: {
  form: ReturnType<typeof useForm<LeadFormValues>>;
  referral: ReferralFormState;
  setReferral: (v: ReferralFormState) => void;
  isReferral: boolean;
  meta?: Awaited<ReturnType<typeof referralsApi.meta>>;
  pipelines: Pipeline[];
  sourceNames: string[];
  canAssignOwner: boolean;
}) {
  return (
    <div className="space-y-4">
      <QuickFields
        form={form}
        referral={referral}
        setReferral={setReferral}
        isReferral={isReferral}
        meta={meta}
        pipelines={pipelines}
        moreDetails
        onMoreDetails={() => undefined}
        showExtras
        sourceNames={sourceNames}
        canAssignOwner={canAssignOwner}
      />
      <ExtraOptionalFields form={form} />
    </div>
  );
}

function ExtraOptionalFields({ form }: { form: ReturnType<typeof useForm<LeadFormValues>> }) {
  const { register, control } = form;
  return (
    <div className="space-y-3.5 border-t border-border pt-4">
      <p className="text-[13px] font-semibold text-foreground">Additional Information</p>
      <FormFieldGroup>
        <FormFieldSlot label="Occupation">
          <Input {...register("occupation")} />
        </FormFieldSlot>
        <FormFieldSlot label="Job title">
          <Input {...register("jobTitle")} />
        </FormFieldSlot>
        <FormFieldSlot label="Employer">
          <Input {...register("employer")} />
        </FormFieldSlot>
        <FormFieldSlot label="Nationality">
          <Input {...register("nationality")} />
        </FormFieldSlot>
        <FormFieldSlot label="Location">
          <Input {...register("location")} />
        </FormFieldSlot>
        <FormFieldSlot label="Tags">
          <Input {...register("tags")} placeholder="Comma separated" />
        </FormFieldSlot>
      </FormFieldGroup>
      <FormFieldSlot label="ANZSCO">
        <Controller
          control={control}
          name="anzscoId"
          render={({ field }) => (
            <AnzscoCombobox value={field.value} onChange={(id) => field.onChange(id)} />
          )}
        />
      </FormFieldSlot>
      <FormFieldSlot label="Notes">
        <Input {...register("notes")} />
      </FormFieldSlot>
    </div>
  );
}

/** Back-compat alias used by existing call sites. */
export const LeadFormDialog = LeadCreateDrawer;
