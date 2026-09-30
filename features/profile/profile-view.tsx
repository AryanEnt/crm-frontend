"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ErrorState } from "@/components/ui/error-state";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { Form, SubmitButton, useZodForm } from "@/components/forms/form";
import { SelectField, TextField } from "@/components/forms/fields";
import { useAuth } from "@/features/auth/auth-provider";
import { changePassword, updateProfile } from "@/lib/api/auth";
import { adminApi } from "@/lib/api/admin";
import { messages } from "@/lib/forms/messages";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { commonTimezones } from "@/lib/timezone";
import { copy } from "@/lib/copy";
import { PASSWORD_MIN_LENGTH, newPasswordSchema } from "@/validations/common";
import { ApiError } from "@/types/api";

export function ProfileView() {
  const { user, refresh, isLoading, can } = useAuth();

  const teamsQuery = useQuery({
    queryKey: ["teams", "profile"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "200" })),
    enabled: !!user && can("teams:view"),
    retry: false,
  });

  if (isLoading && !user) return <DetailSkeleton />;
  if (!user) {
    return <ErrorState title="Not signed in" description="Sign in to view your profile." />;
  }

  const initials = user.fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const teamNames = (teamsQuery.data?.data ?? [])
    .filter((t) => (user.teamIds ?? []).includes(t.id))
    .map((t) => t.name);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Profile" }]}
        title="Profile"
        description="Your account details and security settings."
      />

      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{initials || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-section truncate">{user.fullName}</p>
            <p className="text-meta truncate">{user.email}</p>
          </div>
        </div>

        <dl className="mb-4 grid gap-3 sm:grid-cols-2">
          <ReadOnly label="Email" value={user.email} />
          <ReadOnly label="Role" value={user.roleName || user.roleCode} />
          <ReadOnly
            label="Team"
            value={
              teamNames.length > 0
                ? teamNames.join(", ")
                : user.roleCode === "super_admin"
                  ? "Organization-wide (not assigned)"
                  : "—"
            }
          />
          <ReadOnly label="Status" value={user.isActive ? "Active" : "Inactive"} />
        </dl>

        <ProfileForm
          key={`${user.fullName}|${user.phone ?? ""}|${user.timezone ?? "UTC"}`}
          initial={{
            fullName: user.fullName,
            phone: user.phone ?? "",
            timezone: user.timezone || "UTC",
          }}
          onSaved={refresh}
        />
      </section>

      <ChangePasswordCard />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function unknownErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === "network_error") return copy.error.network;
  if (err instanceof ApiError && err.message) return err.message;
  return copy.error.generic;
}

const profileSchema = z.object({
  fullName: z.string().trim().min(1, messages.enter("your name")),
  phone: z.string().trim(),
  timezone: z.string().min(1, messages.choose("a timezone")),
});

const profileServerErrors: ServerErrorRule<z.input<typeof profileSchema>>[] = [
  { match: /full name is required/i, field: "fullName", message: messages.enter("your name") },
  { match: /timezone/i, field: "timezone", message: messages.choose("a timezone from the list") },
];

function ProfileForm({
  initial,
  onSaved,
}: {
  initial: z.input<typeof profileSchema>;
  onSaved: () => Promise<unknown>;
}) {
  const form = useZodForm(profileSchema, { defaultValues: initial });

  const zones = React.useMemo(() => {
    const list = commonTimezones();
    return list.includes(initial.timezone) ? list : [initial.timezone, ...list];
  }, [initial.timezone]);

  return (
    <Form
      form={form}
      schema={profileSchema}
      className="space-y-3 border-t border-border pt-4"
      onSubmit={async (values) => {
        try {
          await updateProfile(values);
          form.reset(values);
          toast.success("Profile updated");
          await onSaved();
        } catch (err) {
          if (applyServerError(form, err, profileServerErrors)) return;
          toast.error(unknownErrorMessage(err));
        }
      }}
    >
      <h3 className="text-section">Editable details</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="fullName" label="Full name" autoComplete="name" className="sm:col-span-2" />
        <TextField name="phone" label="Phone" type="tel" autoComplete="tel" />
        <SelectField name="timezone" label="Timezone">
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex justify-end">
        <SubmitButton requireDirty>Save changes</SubmitButton>
      </div>
    </Form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, messages.enter("your current password")),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => !v.confirmPassword || v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: messages.passwordsMatch,
    when: () => true,
  })
  .refine((v) => !v.newPassword || v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: messages.passwordDifferent,
    when: () => true,
  });

const passwordServerErrors: ServerErrorRule<z.input<typeof passwordSchema>>[] = [
  { match: /current password is incorrect/i, field: "currentPassword", message: messages.currentPasswordWrong },
  { match: /current password is required/i, field: "currentPassword", message: messages.enter("your current password") },
  { match: /at least \d+ characters/i, field: "newPassword", message: messages.minLength(PASSWORD_MIN_LENGTH) },
  { match: /must be different/i, field: "newPassword", message: messages.passwordDifferent },
];

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

function ChangePasswordCard() {
  const { refresh } = useAuth();
  const form = useZodForm(passwordSchema, { defaultValues: EMPTY_PASSWORDS });

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-section">Change password</h3>
      <p className="mt-1 text-meta">Other signed-in devices will be signed out. This session stays active.</p>
      <Form
        form={form}
        schema={passwordSchema}
        className="mt-4 space-y-3"
        onSubmit={async ({ currentPassword, newPassword }) => {
          try {
            await changePassword({ currentPassword, newPassword });
            form.reset(EMPTY_PASSWORDS);
            toast.success("Password updated. Other devices have been signed out.");
            await refresh();
          } catch (err) {
            if (applyServerError(form, err, passwordServerErrors)) return;
            toast.error(unknownErrorMessage(err));
          }
        }}
      >
        <TextField
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          deps={["newPassword"]}
        />
        <TextField
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          deps={["confirmPassword"]}
        />
        <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" />
        <div className="flex justify-end">
          <SubmitButton requireDirty>Update password</SubmitButton>
        </div>
      </Form>
    </section>
  );
}
