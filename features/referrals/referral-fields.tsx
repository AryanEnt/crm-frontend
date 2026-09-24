"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import {
  referralsApi,
  todayISODate,
  type ReferralInput,
  type ReferralMeta,
} from "@/lib/api/referrals";

export type ReferralFormState = {
  referrerTypeCode: string;
  referrerUserId: string;
  referrerCustomerId: string;
  referrerPartnerId: string;
  referrerName: string;
  relationshipCode: string;
  referralDate: string;
  referralSource: string;
  notes: string;
  referralCode: string;
};

export function emptyReferralForm(): ReferralFormState {
  return {
    referrerTypeCode: "existing_customer",
    referrerUserId: "none",
    referrerCustomerId: "none",
    referrerPartnerId: "none",
    referrerName: "",
    relationshipCode: "none",
    referralDate: todayISODate(),
    referralSource: "",
    notes: "",
    referralCode: "",
  };
}

export function toReferralInput(form: ReferralFormState): ReferralInput {
  return {
    referrerTypeCode: form.referrerTypeCode,
    referrerUserId: form.referrerUserId !== "none" ? form.referrerUserId : null,
    referrerCustomerId:
      form.referrerCustomerId !== "none" ? form.referrerCustomerId : null,
    referrerPartnerId: form.referrerPartnerId !== "none" ? form.referrerPartnerId : null,
    referrerName: form.referrerName.trim(),
    relationshipCode:
      form.relationshipCode !== "none" ? form.relationshipCode : null,
    referralDate: form.referralDate || todayISODate(),
    referralSource: form.referralSource.trim(),
    notes: form.notes,
    referralCode: form.referralCode.trim() || null,
    statusCode: "active",
  };
}

export function ReferralFields({
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

  const usersQuery = useQuery({
    queryKey: ["users", "referral-form"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "referral-form"],
    queryFn: () => crmApi.listCustomers(new URLSearchParams({ limit: "100" })),
  });
  const partnersQuery = useQuery({
    queryKey: ["referral-partners"],
    queryFn: () => referralsApi.listPartners(""),
  });

  const types = meta?.referrerTypes ?? [];
  const relationships = meta?.relationships ?? [];
  const typeCode = value.referrerTypeCode;

  return (
    <div className="sm:col-span-2 grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-2">
      <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Referral details
      </p>
      <p className="sm:col-span-2 text-[11px] text-foreground-subtle">
        Lead source stays as Referral. These fields capture who referred and how — separately from
        source.
      </p>

      <div className="space-y-1.5">
        <Label required>Referrer type</Label>
        <Select value={value.referrerTypeCode} onValueChange={(v) => set("referrerTypeCode", v)}>
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

      {(typeCode === "sales_executive" || typeCode === "employee") && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label required>Referred by (user)</Label>
          <Select value={value.referrerUserId} onValueChange={(v) => set("referrerUserId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select…</SelectItem>
              {(usersQuery.data?.data ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {typeCode === "existing_customer" && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label required>Referred by (customer)</Label>
          <Select
            value={value.referrerCustomerId}
            onValueChange={(v) => set("referrerCustomerId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select…</SelectItem>
              {(customersQuery.data?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(typeCode === "partner" || typeCode === "agent") && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Partner / agent</Label>
          <Select
            value={value.referrerPartnerId}
            onValueChange={(v) => set("referrerPartnerId", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select partner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — use name below</SelectItem>
              {(partnersQuery.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.company ? ` (${p.company})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5 sm:col-span-2">
        <Label required={typeCode === "other" || value.referrerUserId === "none"}>
          Referred by (name)
        </Label>
        <Input
          value={value.referrerName}
          onChange={(e) => set("referrerName", e.target.value)}
          placeholder="John Smith"
          required={typeCode === "other"}
        />
      </div>

      <div className="space-y-1.5">
        <Label required>Referral date</Label>
        <Input
          type="date"
          value={value.referralDate}
          onChange={(e) => set("referralDate", e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Referral source</Label>
        <Input
          value={value.referralSource}
          onChange={(e) => set("referralSource", e.target.value)}
          placeholder="Campaign, event, channel…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Referral code</Label>
        <Input
          value={value.referralCode}
          onChange={(e) => set("referralCode", e.target.value)}
          placeholder="Optional code"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label>Referral notes</Label>
        <Input value={value.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    </div>
  );
}
