"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { SubmitErrorHandler, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { toReferralInput } from "@/features/referrals/smart-referral-fields";
import { crmApi, DuplicateReviewError, type DuplicateMatch, type Lead, type LeadBoard, type LeadBoardCard } from "@/lib/api/crm";
import { copy } from "@/lib/copy";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { cardFromLead, insertLeadCard, isUnfilteredBoardKey, replaceLeadCard } from "./board-insert";
import {
  toCreatePayload,
  toUpdatePayload,
  valuesForNextLead,
  type CreateLeadDefaults,
  type CreateLeadInput,
  type CreateLeadValues,
} from "./create-lead-schema";
import { zonedInputToIso } from "./follow-up";
import { toE164 } from "./phone";
import { loadSourceUsage, recordSourceUse, saveSourceUsage } from "./source-usage";

const SERVER_ERRORS: ServerErrorRule<CreateLeadInput>[] = [
  { match: /full name is required/i, field: "fullName", message: "Add a name to continue" },
  { match: /lead source is required/i, field: "source", message: "Choose where this lead came from" },
  { match: /referred by is required|referral details are required/i, field: "referral", message: "Add who referred this lead" },
  { match: /invalid priority/i, field: "priority", message: "Choose a priority" },
  { match: /invalid nextActivityAt/i, field: "nextActivityAt", message: "Pick a follow-up date" },
];

type Snapshot = [readonly unknown[], LeadBoard | undefined];

export type SubmitOptions = { andAnother?: boolean; force?: boolean };

export function useCreateLead({
  form,
  defaults,
  user,
  canAssignOwner,
  canAttachScreenshot,
  ownerName,
  timeZone,
  screenshot,
  customFields,
  editing,
  onInvalid,
  onCreated,
  onReset,
  onClose,
}: {
  form: UseFormReturn<CreateLeadInput, unknown, CreateLeadValues>;
  defaults: CreateLeadDefaults;
  customFields: Record<string, unknown>;
  /** The lead being edited and the values the form started from; saves send only the changes. */
  editing?: { lead: Lead; initial: CreateLeadInput };
  user: { id: string; fullName: string };
  canAssignOwner: boolean;
  canAttachScreenshot: boolean;
  ownerName: (ownerUserId: string) => string | null;
  timeZone?: string;
  screenshot: File | null;
  onInvalid: SubmitErrorHandler<CreateLeadInput>;
  onCreated?: (lead: Lead) => void;
  /** After "Create and add another": clear local state and put the cursor back in the name. */
  onReset: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [serverDuplicates, setServerDuplicates] = React.useState<{ key: string; matches: DuplicateMatch[] } | null>(null);
  const [pendingAnother, setPendingAnother] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  /** Shows the card on matching boards right away; returns the snapshots to roll back to. */
  const insertOptimistic = (values: CreateLeadValues, placeholder: LeadBoardCard): Snapshot[] => {
    if (!values.pipelineId || !values.stageId) return [];
    const boards = qc
      .getQueriesData<LeadBoard>({ queryKey: ["lead-board", values.pipelineId] })
      .filter(([key, data]) => data && isUnfilteredBoardKey(key, values.pipelineId));
    for (const [key, data] of boards) {
      void qc.cancelQueries({ queryKey: key, exact: true });
      const next = data ? insertLeadCard(data, placeholder) : null;
      if (next) qc.setQueryData(key, next);
    }
    return boards;
  };

  const placeholderCard = (values: CreateLeadValues): LeadBoardCard => {
    const owner = canAssignOwner ? values.ownerUserId || user.id : user.id;
    return {
      id: `new-lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      fullName: values.fullName,
      employer: values.employer,
      phone: toE164(values.phone, values.phoneCountry) || null,
      email: values.email || null,
      potentialValue: values.potentialValue ? Number(values.potentialValue) : null,
      currency: "AUD",
      stageId: values.stageId,
      status: "open",
      ownerUserId: owner,
      ownerName: ownerName(owner),
      priority: values.priority,
      tags: [],
      lastActivityAt: null,
      nextActivityAt: values.nextActivityAt ? zonedInputToIso(values.nextActivityAt, timeZone) : null,
      nextActivityTitle: null,
      nextActivityType: null,
      expectedCloseAt: null,
      stageEnteredAt: new Date().toISOString(),
      wonAt: null,
      lostAt: null,
      lostReason: "",
    };
  };

  const failSave = (err: unknown, values: CreateLeadValues, andAnother: boolean) => {
    if (err instanceof DuplicateReviewError) {
      setPendingAnother(andAnother);
      setServerDuplicates({ key: contactKey(values), matches: err.duplicates });
      return;
    }
    if (applyServerError(form, err, SERVER_ERRORS)) {
      onInvalid(form.formState.errors);
      return;
    }
    setFormError(err instanceof Error && err.message ? err.message : copy.error.generic);
  };

  const refreshLeadQueries = (leadId: string) => {
    void qc.invalidateQueries({ queryKey: ["lead-board"] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["lead-insights"] });
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["calendar"] });
    void qc.invalidateQueries({ queryKey: ["activities"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
    void qc.invalidateQueries({ queryKey: ["documents", "lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
    void qc.invalidateQueries({ queryKey: ["referrals"] });
  };

  const saveChanges = async (values: CreateLeadValues, force: boolean, { lead, initial }: { lead: Lead; initial: CreateLeadInput }) => {
    setFormError(null);
    const payload = toUpdatePayload(values, initial, { force, canAssignOwner, timeZone, customFields });
    let saved: Lead;
    try {
      saved = await crmApi.updateLead(lead.id, payload);
    } catch (err) {
      failSave(err, values, false);
      return;
    }
    setServerDuplicates(null);
    if (values.source !== initial.source) {
      saveSourceUsage(user.id, recordSourceUse(loadSourceUsage(user.id), values.source));
    }
    if (screenshot && canAttachScreenshot) await uploadScreenshot(saved, screenshot, "Lead saved");
    refreshLeadQueries(saved.id);
    onCreated?.(saved);
    toast.success("Lead updated", { description: saved.fullName });
    onClose();
  };

  const uploadScreenshot = async (lead: Lead, file: File, done = "Lead created") => {
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("name", file.name || "Screenshot");
      body.append("type", "screenshot");
      body.append("category", "screenshot");
      body.append("leadId", lead.id);
      await crmApi.uploadDocument(body);
    } catch (err) {
      toast.error(`${done}, but the screenshot didn't upload`, {
        description: err instanceof Error && err.message ? err.message : "Add it later from the lead's documents.",
      });
    }
  };

  const save = async (values: CreateLeadValues, { andAnother = false, force = false }: SubmitOptions) => {
    if (editing) return saveChanges(values, force, editing);
    setFormError(null);
    const payload = toCreatePayload(values, {
      force,
      canAssignOwner,
      currentUserId: user.id,
      timeZone,
      customFields,
      referral: values.referral ? toReferralInput(values.referral) : undefined,
    });
    const placeholder = placeholderCard(values);
    const snapshots = insertOptimistic(values, placeholder);
    const rollback = () => {
      for (const [key, data] of snapshots) qc.setQueryData(key, data);
    };

    let lead: Lead;
    try {
      lead = await crmApi.createLead(payload);
    } catch (err) {
      rollback();
      failSave(err, values, andAnother);
      return;
    }

    const saved = cardFromLead(lead, placeholder);
    for (const [key] of snapshots) {
      qc.setQueryData<LeadBoard>(key, (prev) => (prev ? replaceLeadCard(prev, placeholder.id, saved) : prev));
    }
    setServerDuplicates(null);
    saveSourceUsage(user.id, recordSourceUse(loadSourceUsage(user.id), values.source));
    if (screenshot && canAttachScreenshot) await uploadScreenshot(lead, screenshot);
    refreshLeadQueries(lead.id);
    onCreated?.(lead);

    const view = { label: "View lead", onClick: () => router.push(`/leads?leadId=${encodeURIComponent(lead.id)}`) };
    if (andAnother) {
      form.reset(valuesForNextLead(form.getValues(), defaults));
      onReset();
      toast.success("Lead created", { description: lead.fullName, action: view });
    } else {
      toast.success("Lead created", { description: lead.fullName, action: view });
      onClose();
    }
  };

  const submit = (options: SubmitOptions = {}) =>
    form.handleSubmit((values) => save(values, options), onInvalid)();

  return {
    submit,
    /** Matches from the last save attempt, while the name, phone and email are unchanged. */
    serverDuplicatesFor: (current: Pick<CreateLeadInput, "fullName" | "phone" | "email">) =>
      serverDuplicates && serverDuplicates.key === contactKey(current) ? serverDuplicates.matches : [],
    /** Re-sends with the duplicate check skipped, keeping the add-another choice from the first try. */
    confirmDuplicates: () => submit({ force: true, andAnother: pendingAnother }),
    formError,
  };
}

function contactKey(v: Pick<CreateLeadInput, "fullName" | "phone" | "email">) {
  return [v.fullName, v.phone, v.email].map((s) => s.trim().toLowerCase()).join("|");
}
