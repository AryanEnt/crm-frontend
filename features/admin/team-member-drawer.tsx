"use client";

import * as React from "react";
import type { SubmitErrorHandler } from "react-hook-form";
import { CircleAlert } from "lucide-react";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { operatorErrorMessage } from "@/lib/copy";
import { applyServerError, type ServerErrorRule } from "@/lib/forms/server-errors";
import { FormScope, PasswordField, SubmitButton, TextField, focusFirstInvalid, useZodForm } from "@/components/forms";
import { Button } from "@/components/ui/console/button";
import { ConfirmDialog } from "@/components/ui/console/dialog";
import { Drawer, DrawerSection } from "@/components/ui/console/drawer";
import {
  teamMemberCreateSchema,
  teamMemberEditSchema,
  type TeamMemberInput,
  type TeamMemberValues,
} from "@/validations/user";

const SERVER_ERRORS: ServerErrorRule<TeamMemberInput>[] = [
  { match: /email already exists/i, field: "email", message: "Someone already signs in with this email. Use a different one." },
  { match: /password must be/i, field: "password", message: "Use at least 8 characters" },
];

function defaultsFor(member: AdminUser | null): TeamMemberInput {
  const [firstName = "", ...rest] = (member?.fullName ?? "").trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    password: "",
  };
}

/**
 * Team Lead add/edit for a Sales Executive on their own team. Role and team aren't
 * fields: the server pins new people to the caller's team and rejects role or team changes.
 * Mount with a fresh `key` per opening; it stays mounted through the close animation.
 */
export function TeamMemberDrawer({
  open,
  onOpenChange,
  member,
  teamName,
  salesExecutiveRoleId,
  focusPassword = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: AdminUser | null;
  teamName: string | undefined;
  salesExecutiveRoleId: string | undefined;
  focusPassword?: boolean;
  onSaved: (user: AdminUser, mode: "created" | "updated") => Promise<void> | void;
}) {
  const editing = member !== null;
  const schema = editing ? teamMemberEditSchema : teamMemberCreateSchema;
  const form = useZodForm(schema, { defaultValues: defaultsFor(member) });
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const rolePending = !editing && !salesExecutiveRoleId;

  // The drawer's focus trap lands on its first focusable (the close button) during mount.
  const { setFocus } = form;
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus(focusPassword ? "password" : "firstName"));
    return () => cancelAnimationFrame(frame);
  }, [setFocus, focusPassword]);

  const save = async (values: TeamMemberValues) => {
    setFormError(null);
    const fullName = [values.firstName, values.lastName].filter(Boolean).join(" ");
    let saved: AdminUser;
    try {
      saved = editing
        ? await adminApi.updateUser(member.id, {
            fullName,
            email: values.email,
            phone: values.phone,
            ...(values.password ? { password: values.password } : {}),
          })
        : await adminApi.createUser({
            fullName,
            email: values.email,
            phone: values.phone,
            password: values.password,
            roleId: salesExecutiveRoleId,
          });
    } catch (err) {
      if (applyServerError(form, err, SERVER_ERRORS)) return;
      setFormError(operatorErrorMessage(err, editing ? "save these changes" : "add this Sales Executive"));
      return;
    }
    await onSaved(saved, editing ? "updated" : "created");
  };

  const onInvalid: SubmitErrorHandler<TeamMemberInput> = () => focusFirstInvalid(bodyRef.current);

  const requestClose = () => {
    if (form.formState.isSubmitting) return;
    if (form.formState.isDirty) setDiscardOpen(true);
    else onOpenChange(false);
  };

  const onTeam = teamName ? `on ${teamName}` : "on your team";

  return (
    <FormScope form={form} schema={schema}>
      <Drawer
        open={open}
        onRequestClose={requestClose}
        title={editing ? "Edit Sales Executive" : "Add Sales Executive"}
        description={
          editing
            ? `${member.email} · Sales Executive ${onTeam}`
            : `They'll join ${teamName ?? "your team"} as a Sales Executive and sign in with the email and password you set here.`
        }
        formProps={{
          noValidate: true,
          onSubmit: (event) => void form.handleSubmit(save, onInvalid)(event),
        }}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <SubmitButton disabled={rolePending} requireDirty={editing}>
              {editing ? "Save changes" : "Add Sales Executive"}
            </SubmitButton>
          </>
        }
      >
        <div ref={bodyRef}>
          {formError ? (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-cell text-danger"
            >
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p>{formError}</p>
            </div>
          ) : null}

          <DrawerSection title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="firstName" label="First name" autoComplete="off" />
              <TextField name="lastName" label="Last name" autoComplete="off" />
            </div>
            <TextField name="phone" label="Phone" type="tel" autoComplete="off" className="tabular-nums" />
          </DrawerSection>

          <DrawerSection
            title="Sign-in"
            description={editing ? undefined : "Share these with them directly. They can change the password after signing in."}
          >
            <TextField name="email" label="Email" type="email" autoComplete="off" helper="Used to sign in." />
            <PasswordField
              name="password"
              label={editing ? "New password" : "Password"}
              autoComplete="new-password"
              helper={editing ? "Leave blank to keep their current password." : "At least 8 characters."}
            />
          </DrawerSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        tone="danger"
        title="Discard unsaved changes?"
        description={editing ? "Your edits haven't been saved and will be lost." : "This Sales Executive hasn't been added yet."}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </FormScope>
  );
}
