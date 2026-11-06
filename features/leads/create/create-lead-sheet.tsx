"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CalendarDays,
  NotebookPen,
  UserRound,
  UserRoundPlus,
  X,
} from "lucide-react";
import { FormProvider, useFormContext, useFormState, useWatch, type FieldErrors } from "react-hook-form";
import { focusFirstInvalid, useZodForm } from "@/components/forms";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-provider";
import type { SessionUser } from "@/features/auth/types";
import { canAttachLeadScreenshot } from "@/features/leads/can-attach-screenshot";
import { emptyReferralForm, referralToForm } from "@/features/referrals/smart-referral-fields";
import { crmApi, type DuplicateMatch, type Lead, type LeadSource, type Pipeline } from "@/lib/api/crm";
import { referralsApi, type Referral } from "@/lib/api/referrals";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  CREATE_LEAD_PRIORITIES,
  DETAIL_SECTION_FIELDS,
  createLeadSchema,
  editLeadSchema,
  emptyCreateLead,
  leadToForm,
  parseTags,
  sectionForField,
  type CreateLeadDefaults,
  type CreateLeadInput,
  type CreateLeadPriority,
  type DetailSection,
} from "./create-lead-schema";
import { duplicateKey, useDuplicateCheck } from "./duplicate-notice";
import { FIELD_CONTROL } from "./field-ui";
import { formatFollowUp, fromLocalInput } from "./follow-up";
import { MoreDetailsAccordion } from "./more-details-accordion";
import { DEFAULT_PHONE_COUNTRY, detectDialCountry, formatPhone } from "./phone";
import { AboutSection, WorkSection } from "./profile-section";
import { QuickAddFields } from "./quick-add-fields";
import { SalesSection, useOwnerChoices } from "./sales-section";
import { loadSourceUsage, pickDefaultSource, rankSources } from "./source-usage";
import { useCreateLead } from "./use-create-lead";

const FORM_ID = "create-lead-form";

type Settings = Record<string, string>;

const REQUIRED_KEYS = ["fullName", "source", "country", "nationality", "location"] as const;

export type CreateLeadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start in this pipeline (e.g. the one on screen); otherwise the default pipeline. */
  pipelineId?: string;
  onCreated?: (lead: Lead) => void;
  /** Edit this lead instead of creating one. */
  lead?: Lead | null;
  onSaved?: (lead: Lead) => void;
};

export function CreateLeadSheet({ open, onOpenChange, pipelineId, onCreated, lead, onSaved }: CreateLeadSheetProps) {
  const { user } = useAuth();
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const hasChangesRef = React.useRef<() => boolean>(() => false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // Set before close so a deferred outside-click from the sheet cannot reopen the prompt.
  const discardConfirmedRef = React.useRef(false);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
    enabled: open,
  });
  const settingsQuery = useQuery({
    queryKey: ["org-settings", "map"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open,
    staleTime: 60_000,
  });
  const sourcesQuery = useQuery({
    queryKey: ["lead-sources", "form"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    enabled: open,
    staleTime: 60_000,
  });
  const referralQuery = useQuery({
    queryKey: ["referrals", "subject", lead?.id],
    queryFn: () => referralsApi.bySubject({ leadId: lead!.id }),
    enabled: open && Boolean(lead?.id),
  });
  const ready =
    Boolean(user) &&
    pipelinesQuery.isFetched &&
    settingsQuery.isFetched &&
    sourcesQuery.isFetched &&
    (!lead || referralQuery.isFetched);

  React.useEffect(() => {
    if (open) discardConfirmedRef.current = false;
  }, [open]);

  const requestClose = () => {
    if (discardConfirmedRef.current) {
      discardConfirmedRef.current = false;
      setConfirmDiscard(false);
      onOpenChange(false);
      return;
    }
    if (hasChangesRef.current()) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  return (
    <>
      <Modal open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <ModalContent
          ref={contentRef}
          showClose={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (confirmDiscard) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (confirmDiscard) e.preventDefault();
          }}
          overlayClassName="z-[60] bg-[#2e2474]/25 backdrop-blur-[2px]"
          className={cn(
            "create-lead-aurora z-[60] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-xl",
            "inset-0 left-0 top-0 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92vh,900px)] sm:w-[min(980px,calc(100%-2rem))] sm:max-w-[980px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:border sm:border-[color:var(--aurora-line)]",
            "motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none",
          )}
        >
          <div className="create-lead-shell flex min-h-0 flex-1 flex-col">
            <CreateLeadHeader editing={Boolean(lead)} onClose={requestClose} />
            {ready && user ? (
              <CreateLeadForm
                key={lead?.id ?? "new"}
                lead={lead ?? undefined}
                existingReferral={lead ? (referralQuery.data ?? null) : undefined}
                user={user}
                pipelines={pipelinesQuery.data ?? []}
                settings={settingsQuery.data}
                sources={sourcesQuery.data ?? []}
                initialPipelineId={pipelineId}
                pasteTarget={contentRef}
                hasChangesRef={hasChangesRef}
                onCancel={requestClose}
                onClose={() => onOpenChange(false)}
                onCreated={lead ? onSaved : onCreated}
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
                <LoadingState compact label="Getting the form ready…" />
              </div>
            )}
          </div>
        </ModalContent>
      </Modal>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={lead ? "Discard your changes?" : "Discard this lead?"}
        description={
          lead
            ? "Your edits to this lead haven't been saved. If you close now, they'll be lost."
            : "You've started filling this in. If you close now, it won't be saved."
        }
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        className="z-[80]"
        overlayClassName="z-[80]"
        onConfirm={() => {
          discardConfirmedRef.current = true;
          setConfirmDiscard(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function CreateLeadHeader({ editing, onClose }: { editing: boolean; onClose: () => void }) {
  return (
    <ModalHeader className="shrink-0 border-b border-[color:var(--aurora-line)] px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-start gap-3 pr-10">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-xs ring-1 ring-brand/15">
          <UserRoundPlus aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <ModalTitle className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
            {editing ? "Edit lead" : "Create New Lead"}
          </ModalTitle>
          <ModalDescription className="text-caption text-ink-muted sm:text-cell">
            {editing
              ? "Update this lead’s details in your sales pipeline."
              : "Add a potential customer to your sales pipeline."}
          </ModalDescription>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 sm:right-4 sm:top-4"
      >
        <X aria-hidden className="size-4" />
      </button>
    </ModalHeader>
  );
}

function RequiredProgress({ values }: { values: CreateLeadInput }) {
  const filled = REQUIRED_KEYS.filter((key) => String(values[key] ?? "").trim().length > 0).length;
  const total = REQUIRED_KEYS.length;
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-3" aria-label={`${filled} of ${total} required fields complete`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-soft">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9c86f0] via-brand to-[#5a63d8] transition-[width] duration-300 ease-standard"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-caption tabular-nums text-ink-muted">
        {filled}/{total} required
      </span>
    </div>
  );
}

function buildDefaults({
  user,
  pipelines,
  settings,
  rankedSources,
  initialPipelineId,
}: {
  user: SessionUser;
  pipelines: Pipeline[];
  settings?: Settings;
  rankedSources: string[];
  initialPipelineId?: string;
}): CreateLeadDefaults {
  const settingsPipeline = settings?.["crm.default_pipeline_id"]?.trim();
  const pipeline =
    (initialPipelineId ? pipelines.find((p) => p.id === initialPipelineId) : undefined) ??
    pipelines.find((p) => p.isDefault) ??
    (settingsPipeline ? pipelines.find((p) => p.id === settingsPipeline) : undefined) ??
    pipelines[0];
  const stage = [...(pipeline?.stages ?? [])]
    .sort((a, b) => a.position - b.position)
    .find((s) => s.isActive && !s.isWon && !s.isLost);
  const orgPriority = settings?.["crm.default_lead_priority"] as CreateLeadPriority | undefined;
  return {
    source: pickDefaultSource(rankedSources, loadSourceUsage(user.id), settings?.["crm.default_lead_source"]?.trim()),
    ownerUserId: user.id,
    priority: orgPriority && (CREATE_LEAD_PRIORITIES as readonly string[]).includes(orgPriority) ? orgPriority : "medium",
    pipelineId: pipeline?.id ?? "",
    stageId: stage?.id ?? "",
    phoneCountry: DEFAULT_PHONE_COUNTRY,
    referral: emptyReferralForm(),
  };
}

const NEXT_FIELD =
  'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled])';

function focusNextField(root: HTMLElement, current: HTMLElement) {
  const fields = Array.from(root.querySelectorAll<HTMLElement>(NEXT_FIELD)).filter(
    (el) => !el.closest("[inert]") && el.getClientRects().length > 0,
  );
  fields[fields.indexOf(current) + 1]?.focus();
}

function CreateLeadForm({
  lead,
  existingReferral,
  user,
  pipelines,
  settings,
  sources,
  initialPipelineId,
  pasteTarget,
  hasChangesRef,
  onCancel,
  onClose,
  onCreated,
}: {
  lead?: Lead;
  existingReferral?: Referral | null;
  user: SessionUser;
  pipelines: Pipeline[];
  settings?: Settings;
  sources: LeadSource[];
  initialPipelineId?: string;
  pasteTarget: React.RefObject<HTMLElement | null>;
  hasChangesRef: React.RefObject<() => boolean>;
  onCancel: () => void;
  onClose: () => void;
  onCreated?: (lead: Lead) => void;
}) {
  const { can } = useAuth();
  const canAssignOwner = can("leads:assign") && user.roleCode !== "sales_executive";
  const canAttachScreenshot = canAttachLeadScreenshot(can, user);
  const timeZone = user.timezone || undefined;
  const me = React.useMemo(() => ({ id: user.id, fullName: user.fullName }), [user.id, user.fullName]);

  const [rankedSources] = React.useState(() => {
    const ranked = rankSources(
      sources.map((s) => ({ name: s.name, usageCount: s.usageCount, position: s.position })),
      loadSourceUsage(user.id),
    );
    const current = lead?.source.trim();
    return current && !ranked.some((s) => s.toLowerCase() === current.toLowerCase()) ? [...ranked, current] : ranked;
  });
  const [defaults] = React.useState(() =>
    buildDefaults({ user, pipelines, settings, rankedSources, initialPipelineId }),
  );
  const [editing] = React.useState(() =>
    lead
      ? {
          lead,
          initial: leadToForm(lead, {
            defaultCountry: defaults.phoneCountry,
            timeZone,
            referral: referralToForm(existingReferral),
          }),
        }
      : undefined,
  );
  const form = useZodForm(editing ? editLeadSchema : createLeadSchema, {
    defaultValues: editing ? editing.initial : emptyCreateLead(defaults),
  });
  const { isSubmitting, isDirty, errors } = useFormState({ control: form.control });
  const values = useWatch({ control: form.control }) as CreateLeadInput;

  const ownerOptions = useOwnerChoices(canAssignOwner, me);
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [customFields, setCustomFields] = React.useState<Record<string, unknown>>({});
  const [openSections, setOpenSections] = React.useState<ReadonlySet<DetailSection>>(new Set());
  const [acknowledged, setAcknowledged] = React.useState<ReadonlySet<string>>(new Set());
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    hasChangesRef.current = () => isDirty || screenshot !== null;
    return () => {
      hasChangesRef.current = () => false;
    };
  }, [hasChangesRef, isDirty, screenshot]);

  const onInvalid = (errs: FieldErrors<CreateLeadInput>) => {
    const sections = Object.keys(errs)
      .map(sectionForField)
      .filter((s): s is DetailSection => s !== null);
    if (sections.length) setOpenSections((prev) => new Set([...prev, ...sections]));
    requestAnimationFrame(() => focusFirstInvalid(bodyRef.current));
  };

  const ownerName = (id: string) =>
    id === user.id ? user.fullName : (ownerOptions.find((o) => o.value === id)?.label ?? null);

  const createLead = useCreateLead({
    form,
    defaults,
    user: me,
    canAssignOwner,
    canAttachScreenshot,
    ownerName,
    timeZone,
    screenshot,
    customFields,
    editing,
    onInvalid,
    onCreated,
    onClose,
    onReset: () => {
      setScreenshot(null);
      setCustomFields({});
      setOpenSections(new Set());
      setAcknowledged(new Set());
      bodyRef.current?.scrollTo({ top: 0 });
      requestAnimationFrame(() => nameRef.current?.focus());
    },
  });

  const phoneChanged = !editing || values.phone !== editing.initial.phone || values.phoneCountry !== editing.initial.phoneCountry;
  const emailChanged = !editing || values.email.trim() !== editing.initial.email.trim();
  const lookedUp = useDuplicateCheck({
    phone: phoneChanged ? values.phone : "",
    phoneCountry: values.phoneCountry,
    email: emailChanged ? values.email : "",
    enabled: true,
    excludeId: lead?.id,
  });
  const serverMatches = createLead.serverDuplicatesFor(values);
  const matches: DuplicateMatch[] = (serverMatches.length ? serverMatches : lookedUp).filter(
    (m) => !acknowledged.has(duplicateKey(m)),
  );
  const force = lookedUp.length > 0 && lookedUp.every((m) => acknowledged.has(duplicateKey(m)));

  const onCreateAnyway = () => {
    if (serverMatches.length) {
      void createLead.confirmDuplicates();
      return;
    }
    setAcknowledged((prev) => new Set([...prev, ...lookedUp.map(duplicateKey)]));
  };

  const submit = (andAnother = false) => void createLead.submit({ andAnother, force });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      if (!isSubmitting) submit();
      return;
    }
    if (e.shiftKey || e.altKey) return;
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || !formRef.current?.contains(target)) return;
    if (["checkbox", "radio", "file", "button", "submit"].includes(target.type)) return;
    e.preventDefault();
    focusNextField(formRef.current, target);
  };

  const applyExtract = (found: { fullName?: string; phone?: string; email?: string }) => {
    const opts = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;
    if (found.fullName) form.setValue("fullName", found.fullName, opts);
    if (found.email) form.setValue("email", found.email, opts);
    if (found.phone) {
      const code = detectDialCountry(found.phone, values.phoneCountry) ?? values.phoneCountry;
      form.setValue("phoneCountry", code, opts);
      form.setValue("phone", formatPhone(found.phone, code), opts);
    }
  };

  const pipeline = pipelines.find((p) => p.id === values.pipelineId);
  const stageName = pipeline?.stages.find((s) => s.id === values.stageId)?.name;
  const followUp = fromLocalInput(values.nextActivityAt);
  const aboutSummary = [values.country, values.nationality, values.location, values.occupation]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");
  const salesSummary = [
    canAssignOwner && values.ownerUserId && values.ownerUserId !== user.id
      ? `Owner ${ownerName(values.ownerUserId) ?? ""}`.trim()
      : null,
    !editing && (values.pipelineId !== defaults.pipelineId || values.stageId !== defaults.stageId) ? stageName : null,
    followUp ? `Follow up ${formatFollowUp(followUp)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const workSummary = [values.jobTitle.trim(), values.employer.trim()].filter(Boolean).join(" · ");
  const tagCount = parseTags(values.tags).length;
  const notesSummary = [
    values.notes.trim() ? "Note added" : null,
    tagCount ? (tagCount === 1 ? "1 tag" : `${tagCount} tags`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sectionInvalid = (section: DetailSection) =>
    (DETAIL_SECTION_FIELDS[section] as readonly string[]).some((f) => f in errors);
  const anzscoLabel =
    lead?.anzscoCode && lead.anzscoTitle ? `${lead.anzscoCode} — ${lead.anzscoTitle}` : null;

  const toggleSection = (id: DetailSection) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <FormProvider {...form}>
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
        <div className="shrink-0 border-b border-[color:var(--aurora-line)] px-5 py-2.5 sm:px-7">
          <RequiredProgress values={values} />
        </div>

        <div ref={bodyRef} className="crm-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <form
            id={FORM_ID}
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mx-auto flex max-w-[52rem] flex-col gap-3 pb-2"
          >
            <QuickAddFields
              nameRef={nameRef}
              sources={rankedSources}
              duplicates={matches}
              onCreateAnyway={onCreateAnyway}
              duplicateBusy={isSubmitting}
              editing={Boolean(editing)}
              screenshot={screenshot}
              onScreenshotChange={setScreenshot}
              pasteTarget={pasteTarget}
              extractEnabled={!editing && env.features.leadScreenshotExtract}
              onApplyExtract={applyExtract}
              showScreenshot={canAttachScreenshot}
            />

            <MoreDetailsAccordion<DetailSection>
              open={openSections}
              onToggle={toggleSection}
              sections={[
                {
                  id: "about",
                  title: "About Them",
                  icon: UserRound,
                  summary: aboutSummary || undefined,
                  placeholder: "Country, nationality, location and occupation",
                  invalid: sectionInvalid("about"),
                  content: <AboutSection anzscoLabel={anzscoLabel} />,
                },
                {
                  id: "sales",
                  title: "Follow-up and Ownership",
                  icon: CalendarDays,
                  summary: salesSummary || undefined,
                  placeholder: "Set a reminder, owner or stage",
                  invalid: sectionInvalid("sales"),
                  content: (
                    <SalesSection
                      pipelines={pipelines}
                      canAssignOwner={canAssignOwner}
                      ownerOptions={ownerOptions}
                      timeZone={timeZone}
                      editing={Boolean(editing)}
                      ownerLabel={editing ? (lead?.ownerName ?? "Unassigned") : "You"}
                    />
                  ),
                },
                {
                  id: "work",
                  title: "Job Details",
                  icon: BriefcaseBusiness,
                  summary: workSummary || undefined,
                  placeholder: "Occupation, title and employer",
                  invalid: sectionInvalid("work"),
                  content: (
                    <>
                      <WorkSection />
                      <CustomFieldsSection
                        entity="lead"
                        recordId={lead?.id}
                        values={customFields}
                        onChange={setCustomFields}
                        pipelineId={values.pipelineId || undefined}
                        stageId={values.stageId || undefined}
                      />
                    </>
                  ),
                },
                {
                  id: "notes",
                  title: "Notes & Tags",
                  icon: NotebookPen,
                  summary: notesSummary || undefined,
                  placeholder: "Add notes or tags to remember important details",
                  invalid: sectionInvalid("notes"),
                  content: (
                    <>
                      <NotesField />
                      <TagsField />
                    </>
                  ),
                },
              ]}
            />
          </form>
        </div>

        <div className="shrink-0 border-t border-[color:var(--aurora-line)] bg-surface/90 px-5 py-3.5 backdrop-blur-sm sm:px-7 sm:py-4">
          {createLead.formError ? (
            <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-caption text-danger">
              {createLead.formError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-3 py-2 text-cell font-medium text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
            >
              Cancel
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {editing ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={() => submit(true)}
                  className="h-10 rounded-xl border-brand/25 bg-surface px-4 hover:border-brand/40 hover:bg-brand-soft/60"
                >
                  Save and add another
                </Button>
              )}
              <Button
                type="submit"
                form={FORM_ID}
                size="lg"
                loading={isSubmitting}
                className="create-lead-primary h-10 rounded-xl px-5 font-semibold hover:bg-transparent"
              >
                {editing ? "Save changes" : "Create Lead"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}

function NotesField() {
  const { register } = useFormContext<CreateLeadInput>();
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-medium text-ink-secondary">
        Notes <span className="font-normal text-ink-muted">· optional</span>
      </label>
      <textarea
        id={id}
        {...register("notes")}
        rows={3}
        placeholder="Anything worth remembering from the first chat"
        className={cn(FIELD_CONTROL, "h-auto min-h-24 resize-y py-2.5")}
      />
    </div>
  );
}

function TagsField() {
  const { register } = useFormContext<CreateLeadInput>();
  const id = React.useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-medium text-ink-secondary">
        Tags <span className="font-normal text-ink-muted">· optional</span>
      </label>
      <input
        id={id}
        {...register("tags")}
        aria-describedby={hintId}
        autoComplete="off"
        placeholder="vip, follow-up"
        className={FIELD_CONTROL}
      />
      <p id={hintId} className="text-caption text-ink-muted">
        Separate tags with commas.
      </p>
    </div>
  );
}
