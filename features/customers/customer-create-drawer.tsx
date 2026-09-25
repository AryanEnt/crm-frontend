"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  QuickCreateDrawer,
  FormFieldSlot,
  FormSummary,
  LeadSourceSelect,
  UserPicker,
  PriorityToggle,
  CrmFormSection,
  CRM_FIELD_INPUT_CLASS,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DuplicateReviewDialog } from "@/components/shared/duplicate-review-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { CustomFieldsSection } from "@/components/forms/custom-fields-section";
import {
  SmartReferralFields,
  emptyReferralForm,
  toReferralInput,
  type ReferralFormState,
} from "@/features/referrals/smart-referral-fields";
import { referralsApi } from "@/lib/api/referrals";
import {
  crmApi,
  DuplicateReviewError,
  type Customer,
  type DuplicateMatch,
} from "@/lib/api/crm";

const fieldInputClass = CRM_FIELD_INPUT_CLASS;

export function CustomerCreateDrawer({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Customer | null;
  onSaved: (customer?: Customer) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const canAssignOwner = user?.roleCode === "sales_manager";
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [source, setSource] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "medium" | "high" | "urgent">("medium");
  const [ownerUserId, setOwnerUserId] = React.useState(user?.id ?? "");
  const [country, setCountry] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | undefined>();
  const [sourceError, setSourceError] = React.useState<string | undefined>();
  const [duplicates, setDuplicates] = React.useState<DuplicateMatch[]>([]);
  const [dupOpen, setDupOpen] = React.useState(false);
  const [created, setCreated] = React.useState<Customer | null>(null);
  const [customFields, setCustomFields] = React.useState<Record<string, unknown>>({});
  const [referral, setReferral] = React.useState<ReferralFormState>(emptyReferralForm);

  const leadSourcesQuery = useQuery({
    queryKey: ["lead-sources", "customer-form"],
    queryFn: () => crmApi.listLeadSources({ activeOnly: true }),
    enabled: open,
  });
  const sourceNames = React.useMemo(
    () => (leadSourcesQuery.data ?? []).map((s) => s.name),
    [leadSourcesQuery.data],
  );
  const referralMetaQuery = useQuery({
    queryKey: ["referrals", "meta"],
    queryFn: () => referralsApi.meta(),
    enabled: open,
  });
  const isReferral = source.trim().toLowerCase() === "referral";

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setFullName(initial.fullName);
      setEmail(initial.email ?? "");
      setPhone(initial.phone ?? "");
      setSource(initial.source ?? "");
      setPriority((initial.priority as typeof priority) || "medium");
      setOwnerUserId(initial.ownerUserId ?? user?.id ?? "");
      setCountry(initial.country ?? "");
      setNotes(initial.notes ?? "");
    } else {
      setFullName("");
      setEmail("");
      setPhone("");
      setSource("");
      setPriority("medium");
      setOwnerUserId(user?.id ?? "");
      setCountry("");
      setNotes("");
      setCreated(null);
      setError(null);
      setCustomFields({});
      setReferral(emptyReferralForm());
    }
    setNameError(undefined);
    setSourceError(undefined);
  }, [open, initial, user?.id]);

  const save = async (force: boolean) => {
    let valid = true;
    if (!fullName.trim()) {
      setNameError("Full name is required");
      valid = false;
    } else {
      setNameError(undefined);
    }
    if (!source.trim()) {
      setSourceError("Lead source is required");
      valid = false;
    } else {
      setSourceError(undefined);
    }
    const hasReferrer =
      (referral.referrerUserId && referral.referrerUserId !== "none") ||
      (referral.referrerCustomerId && referral.referrerCustomerId !== "none") ||
      (referral.referrerPartnerId && referral.referrerPartnerId !== "none") ||
      Boolean(referral.referrerName.trim());
    if (isReferral && !hasReferrer) {
      toast.error("Enter who referred this customer");
      valid = false;
    }
    if (!valid) {
      if (!isReferral || hasReferrer) {
        toast.error("Fix the highlighted fields, then continue.");
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        source,
        priority,
        country,
        notes,
        ...(Object.keys(customFields).length ? { customFields } : {}),
      };
      if (canAssignOwner) {
        payload.ownerUserId =
          ownerUserId && ownerUserId !== "none" ? ownerUserId : null;
      } else if (!initial) {
        // Sales executives / support: always own what they create.
        payload.ownerUserId = user?.id ?? null;
      }
      // On edit without assign rights, omit ownerUserId so it cannot be changed.
      if (isReferral && !initial) {
        payload.referral = toReferralInput(referral);
      }
      const customer = initial
        ? await crmApi.updateCustomer(initial.id, { ...payload, forceUpdate: force })
        : await crmApi.createCustomer({ ...payload, forceCreate: force });
      setDupOpen(false);
      toast.success(initial ? "Customer updated" : "Customer created");
      if (initial) {
        onOpenChange(false);
        onSaved(customer);
      } else {
        setCreated(customer);
        onSaved(customer);
      }
    } catch (err) {
      if (err instanceof DuplicateReviewError) {
        setDuplicates(err.duplicates);
        setDupOpen(true);
        toast.warning("Possible duplicates found");
      } else {
        const message = err instanceof Error ? err.message : "Save failed";
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <QuickCreateDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={created ? "Customer created" : initial ? "Edit Customer" : "Create Customer"}
        description={
          created
            ? undefined
            : "Add the essentials now. Enrich the profile anytime."
        }
        className="max-w-full shadow-[-6px_0_24px_rgba(42,40,56,0.06)] sm:max-w-[460px]"
        footer={
          created ? null : (
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-[13px] text-foreground-muted"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-9 px-4 text-[13px]"
                loading={loading}
                onClick={() => void save(false)}
              >
                {initial ? "Save changes" : "Create Customer"}
              </Button>
            </div>
          )
        }
      >
        {created ? (
          <FormSummary
            title="Customer created successfully"
            headline={created.fullName}
            details={[created.source, created.email].filter(Boolean) as string[]}
            actions={[
              {
                label: "View Customer",
                variant: "default",
                onClick: () => {
                  onOpenChange(false);
                  router.push(`/customers/${created.id}`);
                },
              },
              {
                label: "Create Deal",
                onClick: () => {
                  onOpenChange(false);
                  router.push(`/deals`);
                },
              },
              {
                label: "Create another",
                variant: "secondary",
                onClick: () => {
                  setCreated(null);
                  setFullName("");
                  setEmail("");
                  setPhone("");
                  setSource("");
                  setPriority("medium");
                  setCountry("");
                  setNotes("");
                },
              },
            ]}
          />
        ) : (
          <div className="space-y-5">
            <CrmFormSection title="Contact">
              <FormFieldSlot label="Full Name" required error={nameError}>
                <Input
                  autoFocus
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (nameError) setNameError(undefined);
                  }}
                  placeholder="Full name"
                  error={Boolean(nameError)}
                  className={fieldInputClass}
                  aria-required="true"
                />
              </FormFieldSlot>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <FormFieldSlot label="Phone">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    className={fieldInputClass}
                  />
                </FormFieldSlot>
                <FormFieldSlot label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className={fieldInputClass}
                  />
                </FormFieldSlot>
              </div>
            </CrmFormSection>

            <CrmFormSection title="Lead details" divided>
              <LeadSourceSelect
                value={source}
                onChange={(v) => {
                  setSource(v);
                  if (sourceError) setSourceError(undefined);
                  if (v.toLowerCase() === "referral") {
                    setReferral({
                      ...referral,
                      referralDate: referral.referralDate || emptyReferralForm().referralDate,
                    });
                  }
                }}
                sources={sourceNames}
                required
                error={Boolean(sourceError)}
                triggerClassName={fieldInputClass}
              />
              {isReferral ? (
                <SmartReferralFields
                  value={referral}
                  onChange={setReferral}
                  meta={referralMetaQuery.data}
                />
              ) : null}
              {canAssignOwner ? (
                <UserPicker
                  value={ownerUserId}
                  onChange={setOwnerUserId}
                  label="Owner"
                  triggerClassName={fieldInputClass}
                />
              ) : null}
              <PriorityToggle value={priority} onChange={setPriority} />
            </CrmFormSection>

            <CrmFormSection title="Location" divided>
              <FormFieldSlot label="Country">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                  className={fieldInputClass}
                />
              </FormFieldSlot>
            </CrmFormSection>

            <CrmFormSection title="Additional" divided>
              <FormFieldSlot label="Notes">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a short note…"
                  className={fieldInputClass}
                />
              </FormFieldSlot>
            </CrmFormSection>

            <CustomFieldsSection
              entity="customer"
              recordId={initial?.id}
              values={customFields}
              onChange={setCustomFields}
              enabled={open}
            />

            {error ? (
              <p className="text-[12px] text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </QuickCreateDrawer>
      <DuplicateReviewDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        duplicates={duplicates}
        loading={loading}
        onConfirm={() => void save(true)}
      />
    </>
  );
}

/** Back-compat: customers table still imports CustomerFormDialog */
export function CustomerFormDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Customer | null;
  onSaved: (customer?: Customer) => void;
}) {
  return <CustomerCreateDrawer {...props} />;
}
