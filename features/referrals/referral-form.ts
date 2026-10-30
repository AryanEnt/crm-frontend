import type { Referral, ReferralInput } from "../../lib/api/referrals.ts";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

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

export function referralToForm(r: Referral | null | undefined): ReferralFormState {
  if (!r) return emptyReferralForm();
  return {
    referrerTypeCode: r.referrerTypeCode || "existing_customer",
    referrerUserId: r.referrerUserId || "none",
    referrerCustomerId: r.referrerCustomerId || "none",
    referrerPartnerId: r.referrerPartnerId || "none",
    referrerName: r.referrerName?.trim() || r.referrerDisplayName || "",
    relationshipCode: r.relationshipCode || "none",
    referralDate: r.referralDate || todayISODate(),
    referralSource: r.referralSource || "",
    notes: r.notes || "",
    referralCode: r.referralCode || "",
  };
}

export function toReferralInput(form: ReferralFormState): ReferralInput {
  return {
    referrerTypeCode: form.referrerTypeCode,
    referrerUserId: form.referrerUserId !== "none" ? form.referrerUserId : null,
    referrerCustomerId: form.referrerCustomerId !== "none" ? form.referrerCustomerId : null,
    referrerPartnerId: form.referrerPartnerId !== "none" ? form.referrerPartnerId : null,
    referrerName: form.referrerName.trim(),
    relationshipCode: form.relationshipCode !== "none" ? form.relationshipCode : null,
    referralDate: form.referralDate || todayISODate(),
    referralSource: form.referralSource.trim(),
    notes: form.notes,
    referralCode: form.referralCode.trim() || null,
    statusCode: "active",
  };
}
