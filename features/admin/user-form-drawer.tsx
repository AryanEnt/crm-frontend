"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { Button } from "@/components/ui/console/button";
import { ConfirmDialog } from "@/components/ui/console/dialog";
import { Drawer, DrawerSection } from "@/components/ui/console/drawer";
import { Field } from "@/components/ui/console/field";
import { Input } from "@/components/ui/console/input";
import { Select } from "@/components/ui/console/select";
import { useToast } from "@/components/ui/console/toast";

export type UserFormFocus = "role" | "team" | "password";

type Role = { id: string; code: string; name: string };

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
  teamId: string;
  isActive: boolean;
};

type FieldKey = keyof Values;

const FIELD_ORDER: FieldKey[] = ["firstName", "roleId", "teamId", "password", "email"];

function initialValuesFor(initial: AdminUser | null | undefined): Values {
  const parts = (initial?.fullName ?? "").trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    password: "",
    roleId: initial?.roleId ?? "",
    teamId: initial?.teamIds?.[0] ?? "",
    isActive: initial?.isActive ?? true,
  };
}

/** Mount with a fresh `key` per opening; it stays mounted through the close animation. */
export function UserFormDrawer({
  open,
  onOpenChange,
  roles,
  initial,
  focusField,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  initial?: AdminUser | null;
  focusField?: UserFormFocus;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const toast = useToast();
  const [initialValues] = React.useState(() => initialValuesFor(initial));
  const [values, setValues] = React.useState(initialValues);
  const [submitted, setSubmitted] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [teamConfirm, setTeamConfirm] = React.useState<{
    previousName: string;
    newName: string;
  } | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const firstNameRef = React.useRef<HTMLInputElement>(null);
  const roleRef = React.useRef<HTMLSelectElement>(null);
  const teamRef = React.useRef<HTMLSelectElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const initialFocusRef =
    focusField === "role" ? roleRef : focusField === "team" ? teamRef : focusField === "password" ? passwordRef : firstNameRef;

  const teamsQuery = useQuery({
    queryKey: ["teams", "user-form"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });
  const teams = teamsQuery.data?.data ?? [];

  const { firstName, lastName, email, phone, password, teamId, isActive } = values;
  const roleId = values.roleId || roles[0]?.id || "";
  const selectedRole = roles.find((r) => r.id === roleId);
  const requiresTeam = selectedRole?.code === "sales_executive" || selectedRole?.code === "sales_manager";
  const selectedTeam = teams.find((t) => t.id === teamId);

  const set = <K extends FieldKey>(key: K, value: Values[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const dirty = (Object.keys(initialValues) as FieldKey[]).some((key) => values[key] !== initialValues[key]);

  const validate = () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!email.trim()) errors.email = "Email is required";
    if (!roleId) errors.roleId = "Role is required";
    if (requiresTeam && !teamId) {
      errors.teamId =
        selectedRole?.code === "sales_manager"
          ? "Team is required for Team Leads"
          : "Team is required for Sales Executives";
    } else if (
      requiresTeam &&
      selectedRole?.code === "sales_executive" &&
      selectedTeam &&
      !selectedTeam.teamLeadUserId
    ) {
      errors.teamId = "Selected team does not have a Team Lead configured";
    }
    if (!initial && password.length < 8) errors.password = "Password must be at least 8 characters";
    return errors;
  };

  const errors = submitted ? validate() : {};

  const buildPayload = (confirmTeamChange = false) => {
    const fullName = [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(" ");
    const payload: Record<string, unknown> = {
      fullName,
      email,
      phone,
      roleId,
      isActive,
    };
    if (requiresTeam) {
      payload.teamId = teamId;
      payload.teamIds = teamId ? [teamId] : [];
    } else if (selectedRole?.code === "super_admin") {
      payload.teamIds = [];
    } else if (teamId) {
      payload.teamId = teamId;
      payload.teamIds = [teamId];
    } else if (initial) {
      payload.teamIds = [];
    }
    if (!initial) payload.password = password;
    if (initial && password) payload.password = password;
    if (confirmTeamChange) payload.confirmTeamChange = true;
    return payload;
  };

  const save = async (confirmTeamChange = false) => {
    setSubmitted(true);
    setFormError(null);
    const found = validate();
    const firstInvalid = FIELD_ORDER.find((key) => found[key]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const teamChanged = !!initial && requiresTeam && (initial.teamIds?.[0] ?? "") !== teamId;
    if (teamChanged && !confirmTeamChange) {
      const prevTeam = teams.find((t) => t.id === initial.teamIds?.[0]);
      setTeamConfirm({
        previousName: prevTeam?.name ?? "previous team",
        newName: selectedTeam?.name ?? "new team",
      });
      return;
    }

    setLoading(true);
    try {
      await onSubmit(buildPayload(confirmTeamChange));
      setTeamConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save. Check required fields and try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const requestClose = () => {
    if (loading) return;
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  };

  return (
    <>
      <Drawer
        open={open}
        onRequestClose={requestClose}
        title={initial ? "Edit user" : "New user"}
        description={
          initial
            ? initial.email
            : "Assign role and team. Team Lead is derived from the selected team for Sales Executives."
        }
        initialFocusRef={initialFocusRef}
        formProps={{
          ref: formRef,
          noValidate: true,
          onSubmit: (event) => {
            event.preventDefault();
            void save(false);
          },
        }}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {initial ? "Save changes" : "Create user"}
            </Button>
          </>
        }
      >
        {formError ? (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-cell text-danger"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>{formError}</p>
          </div>
        ) : null}

        <fieldset disabled={loading} className="min-w-0">
          <DrawerSection title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName}>
                <Input
                  ref={firstNameRef}
                  name="firstName"
                  autoComplete="off"
                  value={firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last name">
                <Input
                  name="lastName"
                  autoComplete="off"
                  value={lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </Field>
            </div>
          </DrawerSection>

          <DrawerSection title="Access" description="What this person can see and do in the CRM.">
            <Field label="Role" required error={errors.roleId}>
              <Select ref={roleRef} name="roleId" value={roleId} onChange={(e) => set("roleId", e.target.value)}>
                {roles.length === 0 ? <option value="">Loading roles…</option> : null}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedRole?.code === "super_admin" ? (
              <p className="rounded-control border border-line bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                Super Admin has access to every team and is not assigned to one.
              </p>
            ) : (
              <>
                <Field
                  label="Team"
                  required={requiresTeam}
                  error={errors.teamId}
                  helper={
                    selectedRole?.code === "sales_executive"
                      ? "A Sales Executive belongs to exactly one team. Changing the team is a transfer."
                      : selectedRole?.code === "sales_manager"
                        ? "A Team Lead leads one team. Changing the team is a transfer."
                        : undefined
                  }
                >
                  <Select ref={teamRef} name="teamId" value={teamId} onChange={(e) => set("teamId", e.target.value)}>
                    {requiresTeam ? (
                      <option value="" disabled>
                        {teamsQuery.isLoading ? "Loading teams…" : "Select a team"}
                      </option>
                    ) : (
                      <option value="">No team</option>
                    )}
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {requiresTeam && selectedRole?.code === "sales_executive" ? (
                  <div
                    className={cn(
                      "rounded-control border px-3 py-2",
                      selectedTeam && !selectedTeam.teamLeadName
                        ? "border-warning-border bg-warning-soft"
                        : "border-line bg-surface-sunken",
                    )}
                  >
                    <p className="text-overline text-ink-muted">Team Lead</p>
                    <p className="mt-0.5 text-cell font-medium text-ink">
                      {selectedTeam?.teamLeadName ||
                        (selectedTeam
                          ? "No Team Lead configured — fix team setup before creating this SE"
                          : "Select a team to see Team Lead")}
                    </p>
                  </div>
                ) : null}
              </>
            )}

            <Field label="Status">
              <Select
                name="isActive"
                value={isActive ? "active" : "inactive"}
                onChange={(e) => set("isActive", e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>

            <Field
              label={initial ? "New password" : "Password"}
              required={!initial}
              error={errors.password}
              helper={initial ? "Leave blank to keep the current password." : "At least 8 characters."}
            >
              <Input
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => set("password", e.target.value)}
              />
            </Field>
          </DrawerSection>

          <DrawerSection title="Contact">
            <Field label="Email" required error={errors.email} helper="Used to sign in.">
              <Input
                name="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <Input
                name="phone"
                type="tel"
                autoComplete="off"
                className="tabular-nums"
                value={phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </DrawerSection>
        </fieldset>
      </Drawer>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        tone="danger"
        title="Discard unsaved changes?"
        description="Your edits to this user haven't been saved and will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />

      <ConfirmDialog
        open={!!teamConfirm}
        onOpenChange={(o) => !o && setTeamConfirm(null)}
        title="Change team?"
        description={
          teamConfirm
            ? `This will move ${firstName} ${lastName} from ${teamConfirm.previousName} to ${teamConfirm.newName}. Their future team-scoped visibility will follow the new team.`
            : ""
        }
        confirmLabel="Change team"
        loading={loading}
        onConfirm={() => void save(true)}
      />
    </>
  );
}
