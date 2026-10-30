"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FormProvider, useFormContext, useFormState, useWatch, type FieldErrors } from "react-hook-form";
import { focusFirstInvalid, useZodForm } from "@/components/forms";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LoadingState } from "@/components/ui/loading-state";
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
import { countryFromLocale, detectDialCountry, formatPhone } from "./phone";
import { ProfileSection, WorkSection } from "./profile-section";
import { QuickAddFields } from "./quick-add-fields";
import { SalesSection, useOwnerChoices } from "./sales-section";
import { loadSourceUsage, pickDefaultSource, rankSources } from "./source-usage";
import { useCreateLead } from "./use-create-lead";

const FORM_ID = "create-lead-form";

type Settings = Record<string, string>;

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
      <Drawer open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <DrawerContent
          ref={contentRef}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (confirmDiscard) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (confirmDiscard) e.preventDefault();
          }}
          overlayClassName="z-[60]"
          className="z-[60] max-w-none bg-surface sm:w-[620px] sm:max-w-[620px] motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
        >
          <DrawerHeader className="border-b-0 px-6 pb-2 pt-6">
            <DrawerTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              {lead ? (
                <>
                  <span aria-hidden>✏️</span>Edit lead
                </>
              ) : (
                <>
                  <span aria-hidden>✨</span>New lead
                </>
              )}
            </DrawerTitle>
            <DrawerDescription className="text-cell">
              {lead
                ? "Country, nationality and location are required."
                : "Name, country, nationality and location are required. Everything else can wait."}
            </DrawerDescription>
          </DrawerHeader>
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
            <DrawerBody className="px-6">
              <LoadingState compact label="Getting the form ready…" />
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
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
        // The edit sheet is z-60 so it sits above the lead panel. This prompt has to be higher, or Discard is painted under that overlay and the click never lands.
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
    phoneCountry: countryFromLocale(typeof navigator === "undefined" ? undefined : navigator.language),
    referral: emptyReferralForm(),
  };
}

const NEXT_FIELD =
  'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), textarea:not([disabled]), button[role="combobox"]:not([disabled])';

/** Enter in a single-line field moves on, like Tab, skipping collapsed sections. */
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
  // Sales executives always own what they create; the API enforces the assign scope for everyone else.
  const canAssignOwner = can("leads:assign") && user.roleCode !== "sales_executive";
  const canAttachScreenshot = canAttachLeadScreenshot(can, user);
  const timeZone = user.timezone || undefined;
  const me = React.useMemo(() => ({ id: user.id, fullName: user.fullName }), [user.id, user.fullName]);

  const [rankedSources] = React.useState(() => {
    const ranked = rankSources(
      sources.map((s) => ({ name: s.name, usageCount: s.usageCount, position: s.position })),
      loadSourceUsage(user.id),
    );
    // A lead can carry a source that has since been retired; keep it pickable.
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
    // Wait a frame so a section that just opened is no longer inert.
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

  // When editing, only a phone or email the user changed is worth checking.
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
  // "Create anyway" on the live check skips the server's duplicate review for those same matches.
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
  const salesSummary = [
    canAssignOwner && values.ownerUserId && values.ownerUserId !== user.id ? `Owner ${ownerName(values.ownerUserId) ?? ""}`.trim() : null,
    !editing && (values.pipelineId !== defaults.pipelineId || values.stageId !== defaults.stageId) ? stageName : null,
    followUp ? `Follow up ${formatFollowUp(followUp)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const role = values.jobTitle.trim() || values.occupation.trim();
  const workSummary = [
    role && values.employer.trim() ? `${role} at ${values.employer.trim()}` : role || values.employer.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const tagCount = parseTags(values.tags).length;
  const notesSummary = [
    values.notes.trim() ? "Note added" : null,
    tagCount ? (tagCount === 1 ? "1 tag" : `${tagCount} tags`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sectionInvalid = (section: DetailSection) =>
    (DETAIL_SECTION_FIELDS[section] as readonly string[]).some((f) => f in errors);

  return (
    <FormProvider {...form}>
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
        <div ref={bodyRef} className="crm-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <form
            id={FORM_ID}
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-6"
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
            />
            <ProfileSection
              anzscoLabel={lead?.anzscoCode && lead.anzscoTitle ? `${lead.anzscoCode} — ${lead.anzscoTitle}` : null}
            />
            <MoreDetailsAccordion<DetailSection>
              open={openSections}
              onToggle={(id) =>
                setOpenSections((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              sections={[
                {
                  id: "sales",
                  title: "Follow-up and owner",
                  emoji: "📅",
                  summary: salesSummary || undefined,
                  placeholder: editing ? "Set a reminder or owner" : "Set a reminder, owner or stage",
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
                  title: "Job details",
                  emoji: "🧑‍💼",
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
                  title: "Notes",
                  emoji: "📝",
                  summary: notesSummary || undefined,
                  placeholder: "Notes or tags",
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

        <DrawerFooter className="flex-wrap justify-between gap-y-2 border-t-0 px-6 pb-5 pt-3 shadow-[0_-8px_16px_-12px_var(--line-strong)]">
          {createLead.formError ? (
            <p role="alert" className="w-full rounded-xl bg-danger-soft px-3 py-2 text-caption text-danger">
              {createLead.formError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-2 py-1 text-cell font-medium text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
          >
            Cancel
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {editing ? null : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSubmitting}
                onClick={() => submit(true)}
                className="h-10 rounded-full px-4"
              >
                Save and add another
              </Button>
            )}
            <Button type="submit" form={FORM_ID} size="lg" loading={isSubmitting} className="h-10 rounded-full px-5 font-semibold">
              {editing ? "Save changes" : "Create lead"}
            </Button>
          </div>
        </DrawerFooter>
      </div>
    </FormProvider>
  );
}

function NotesField() {
  const { register } = useFormContext<CreateLeadInput>();
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-cell font-semibold text-ink">
        Notes
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
      <label htmlFor={id} className="text-cell font-semibold text-ink">
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
