"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FormFieldSlot } from "@/components/forms";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineCreateModal } from "@/components/forms/inline-create";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import {
  referralsApi,
  todayISODate,
  type ReferralInput,
  type ReferralMeta,
} from "@/lib/api/referrals";
import { toast } from "sonner";
import type { ReferralFormState } from "@/features/referrals/referral-fields";
import { emptyReferralForm, toReferralInput } from "@/features/referrals/referral-fields";

export { emptyReferralForm, toReferralInput, type ReferralFormState };

/**
 * Compact referral block with searchable referrer picker + inline partner create.
 */
export function SmartReferralFields({
  value,
  onChange,
  meta,
}: {
  value: ReferralFormState;
  onChange: (next: ReferralFormState) => void;
  meta?: ReferralMeta | null;
}) {
  const set = <K extends keyof ReferralFormState>(key: K, v: ReferralFormState[K]) =>
    onChange({ ...value, [key]: v });

  const [partnerOpen, setPartnerOpen] = React.useState(false);
  const [partnerName, setPartnerName] = React.useState("");
  const [partnerBusy, setPartnerBusy] = React.useState(false);

  const types = meta?.referrerTypes ?? [];
  const relationships = meta?.relationships ?? [];
  const typeCode = value.referrerTypeCode;

  const searchReferrer = React.useCallback(
    async (q: string) => {
      if (typeCode === "existing_customer") {
        const res = await crmApi.listCustomers(
          new URLSearchParams({ limit: "20", q: q || "" }),
        );
        return (res.data ?? []).map((c) => ({
          value: c.id,
          label: c.fullName,
          description: "Existing Customer",
          meta: c.email ?? undefined,
        }));
      }
      if (typeCode === "sales_executive" || typeCode === "employee") {
        const res = await adminApi.listUsers(
          new URLSearchParams({ limit: "20", isActive: "true", q: q || "" }),
        );
        return (res.data ?? []).map((u) => ({
          value: u.id,
          label: u.fullName,
          description: typeCode === "sales_executive" ? "Sales Executive" : "Employee",
          meta: u.email,
        }));
      }
      if (typeCode === "partner" || typeCode === "agent") {
        const partners = await referralsApi.listPartners(q || "");
        return (partners ?? []).map((p) => ({
          value: p.id,
          label: p.name,
          description: typeCode === "partner" ? "Partner" : "Agent",
          meta: p.company ?? undefined,
        }));
      }
      return [];
    },
    [typeCode],
  );

  const selectedReferrerValue =
    typeCode === "existing_customer"
      ? value.referrerCustomerId !== "none"
        ? value.referrerCustomerId
        : null
      : typeCode === "sales_executive" || typeCode === "employee"
        ? value.referrerUserId !== "none"
          ? value.referrerUserId
          : null
        : typeCode === "partner" || typeCode === "agent"
          ? value.referrerPartnerId !== "none"
            ? value.referrerPartnerId
            : null
          : null;

  return (
    <div className="space-y-3.5 border-t border-border pt-4">
      <p className="text-[13px] font-semibold text-foreground">Referral Information</p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label required>Referrer type</Label>
          <Select
            value={value.referrerTypeCode}
            onValueChange={(v) =>
              onChange({
                ...value,
                referrerTypeCode: v,
                referrerUserId: "none",
                referrerCustomerId: "none",
                referrerPartnerId: "none",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={value.relationshipCode} onValueChange={(v) => set("relationshipCode", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {relationships.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {typeCode !== "other" ? (
        <FormFieldSlot label="Referred By" required>
          <SearchableSelect
            value={selectedReferrerValue}
            selectedLabel={value.referrerName.trim() || null}
            onChange={(id, opt) => {
              if (typeCode === "existing_customer") {
                onChange({
                  ...value,
                  referrerCustomerId: id ?? "none",
                  referrerName: opt?.label ?? (id ? value.referrerName : ""),
                });
              } else if (typeCode === "sales_executive" || typeCode === "employee") {
                onChange({
                  ...value,
                  referrerUserId: id ?? "none",
                  referrerName: opt?.label ?? (id ? value.referrerName : ""),
                });
              } else {
                onChange({
                  ...value,
                  referrerPartnerId: id ?? "none",
                  referrerName: opt?.label ?? (id ? value.referrerName : ""),
                });
              }
            }}
            onSearch={searchReferrer}
            placeholder="Search referrer…"
            searchPlaceholder="Type a name or email…"
            emptyText="No matching referrers found."
            createLabel={
              typeCode === "partner" || typeCode === "agent" ? "Add new referrer" : undefined
            }
            onCreate={
              typeCode === "partner" || typeCode === "agent"
                ? () => setPartnerOpen(true)
                : undefined
            }
          />
        </FormFieldSlot>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label required={typeCode === "other" || !selectedReferrerValue}>
            Referred by (name)
          </Label>
          <Input
            value={value.referrerName}
            onChange={(e) => set("referrerName", e.target.value)}
            placeholder="John Smith"
          />
        </div>
        <div className="space-y-1.5">
          <Label required>Referral date</Label>
          <Input
            type="date"
            value={value.referralDate || todayISODate()}
            onChange={(e) => set("referralDate", e.target.value)}
          />
        </div>
      </div>

      <InlineCreateModal
        open={partnerOpen}
        onOpenChange={setPartnerOpen}
        title="Add new referrer"
        description="Create a partner/agent and select them as the referrer."
        submitLabel="Create referrer"
        loading={partnerBusy}
        onSubmit={async () => {
          if (!partnerName.trim()) {
            toast.error("Name is required");
            return;
          }
          setPartnerBusy(true);
          try {
            const p = await referralsApi.createPartner({ name: partnerName.trim() });
            onChange({
              ...value,
              referrerPartnerId: p.id,
              referrerName: p.name,
            });
            toast.success("New referrer created");
            setPartnerOpen(false);
            setPartnerName("");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't create the referrer. Try again.");
          } finally {
            setPartnerBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label required>Name</Label>
          <Input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Partner or agent name"
            autoFocus
          />
        </div>
      </InlineCreateModal>
    </div>
  );
}

export function referralStateToInput(state: ReferralFormState): ReferralInput {
  return toReferralInput(state);
}
