"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  QuickCreateDrawer,
  FormFieldGroup,
  FormFieldSlot,
  SearchableSelect,
  UserPicker,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";

export type ActivityContext = {
  leadId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
};

export function ActivityQuickCreateDialog({
  open,
  onOpenChange,
  context,
  defaultType = "follow_up",
  defaultDueAt,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: ActivityContext;
  defaultType?: string;
  /** Local datetime-local value, e.g. 2026-09-24T09:00 */
  defaultDueAt?: string;
  onCreated?: () => void;
}) {
  const { user, can } = useAuth();
  const [title, setTitle] = React.useState("");
  const [typeCode, setTypeCode] = React.useState(defaultType);
  const [priority, setPriority] = React.useState("medium");
  const [status, setStatus] = React.useState("upcoming");
  const [ownerUserId, setOwnerUserId] = React.useState(user?.id ?? "");
  const [startAt, setStartAt] = React.useState("");
  const [endAt, setEndAt] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [customerId, setCustomerId] = React.useState(context?.customerId ?? "");
  const dealId = context?.dealId ?? "";
  const leadId = context?.leadId ?? "";
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const typesQuery = useQuery({
    queryKey: ["activity-types"],
    queryFn: () => crmApi.listActivityTypes(),
    enabled: open,
  });

  const settingsQuery = useQuery({
    queryKey: ["settings", "activity-default"],
    queryFn: () => crmApi.getSettingsMap(),
    enabled: open,
  });

  const defaultFromSettings = settingsQuery.data?.["crm.default_activity_type"];

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setTypeCode(defaultFromSettings || defaultType);
    setPriority("medium");
    setStatus("upcoming");
    setOwnerUserId(user?.id ?? "");
    setStartAt("");
    setEndAt("");
    setDueAt(defaultDueAt ?? "");
    setNotes("");
    setOutcome("");
    setCustomerId(context?.customerId ?? "");
    setError(null);
  }, [open, defaultType, defaultFromSettings, user?.id, context?.customerId, defaultDueAt]);

  const primaryTypes = (typesQuery.data ?? []).filter(
    (t) => !["system", "stage_change", "assignment", "task", "sms"].includes(t.code),
  );

  const selectedType =
    primaryTypes.find((t) => t.code === typeCode) ??
    (typesQuery.data ?? []).find((t) => t.code === typeCode);

  const requiresDatetime = selectedType?.requiresDatetime ?? false;
  const requiresDuration = selectedType?.requiresDuration ?? false;
  const requiresOutcome = selectedType?.requiresOutcome ?? false;
  const requiresNotes = selectedType?.requiresNotes ?? false;
  const showSchedule = requiresDatetime || requiresDuration;

  if (!can("activities:create")) return null;

  const toIso = (local: string) => {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  return (
    <QuickCreateDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create activity"
      description="Schedule a call, follow-up, or task. Times use your local timezone."
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                setError(null);
                try {
                  const cid = context?.customerId || customerId || null;
                  const did = context?.dealId || dealId || null;
                  const lid = context?.leadId || leadId || null;
                  if (!cid && !did && !lid) {
                    setError("Link a lead, customer, or deal");
                    toast.error("Link a lead, customer, or deal");
                    return;
                  }
                  if (requiresOutcome && !outcome.trim()) {
                    setError("Outcome is required for this activity type");
                    toast.error("Outcome is required");
                    return;
                  }
                  if (requiresNotes && !notes.trim()) {
                    setError("Notes are required for this activity type");
                    toast.error("Notes are required");
                    return;
                  }
                  if (showSchedule && requiresDuration && (!startAt || !endAt)) {
                    setError("Start and end are required");
                    toast.error("Start and end are required");
                    return;
                  }
                  if (showSchedule && requiresDatetime && !requiresDuration && !dueAt && !startAt) {
                    setError("Date/time is required");
                    toast.error("Date/time is required");
                    return;
                  }
                  await crmApi.createActivity({
                    title: title || undefined,
                    typeCode,
                    kind: typeCode,
                    priority,
                    status,
                    notes,
                    outcome: outcome || undefined,
                    ownerUserId: ownerUserId === "none" || !ownerUserId ? null : ownerUserId,
                    customerId: cid,
                    dealId: did,
                    leadId: lid,
                    startAt: toIso(startAt),
                    endAt: toIso(endAt),
                    dueAt: toIso(dueAt || startAt),
                  });
                  onOpenChange(false);
                  onCreated?.();
                  toast.success("Activity created");
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Create failed";
                  setError(message);
                  toast.error(message);
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Create activity
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <FormFieldSlot label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Subject (defaults to activity type)"
          />
        </FormFieldSlot>

        <FormFieldGroup>
          <FormFieldSlot label="Type" required>
            <Select value={typeCode} onValueChange={setTypeCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {primaryTypes.map((t) => (
                  <SelectItem key={t.id} value={t.code}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldSlot>
          <FormFieldSlot label="Priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["low", "medium", "high", "urgent"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldSlot>
        </FormFieldGroup>

        <UserPicker value={ownerUserId} onChange={setOwnerUserId} label="Owner" />

        {showSchedule ? (
          requiresDuration ? (
            <FormFieldGroup>
              <FormFieldSlot label="Start" required={requiresDuration}>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </FormFieldSlot>
              <FormFieldSlot label="End" required={requiresDuration}>
                <Input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </FormFieldSlot>
            </FormFieldGroup>
          ) : (
            <FormFieldSlot label="Due / start" required={requiresDatetime}>
              <Input
                type="datetime-local"
                value={dueAt || startAt}
                onChange={(e) => {
                  setDueAt(e.target.value);
                  setStartAt(e.target.value);
                }}
              />
            </FormFieldSlot>
          )
        ) : (
          <FormFieldSlot label="Due (optional)">
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </FormFieldSlot>
        )}

        {requiresOutcome ? (
          <FormFieldSlot label="Outcome" required>
            <Input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Connected, no answer, voicemail…"
            />
          </FormFieldSlot>
        ) : null}

        {!context?.customerId && !context?.dealId && !context?.leadId ? (
          <FormFieldSlot label="Customer" required>
            <SearchableSelect
              value={customerId || null}
              onChange={(v) => setCustomerId(v ?? "")}
              onSearch={async (q) => {
                const res = await crmApi.listCustomers(
                  new URLSearchParams({ limit: "20", q: q || "" }),
                );
                return (res.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.fullName,
                  meta: c.email ?? undefined,
                }));
              }}
              placeholder="Search customer…"
              emptyText="No matching customers found."
            />
          </FormFieldSlot>
        ) : null}

        <FormFieldSlot label="Notes" required={requiresNotes}>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormFieldSlot>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </QuickCreateDrawer>
  );
}
