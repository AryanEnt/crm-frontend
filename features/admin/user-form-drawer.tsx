"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminApi, type AdminTeam, type AdminUser } from "@/lib/api/admin";
import { Button } from "@/components/ui/console/button";
import { ConfirmDialog } from "@/components/ui/console/dialog";
import { Drawer, DrawerSection } from "@/components/ui/console/drawer";
import { Field } from "@/components/ui/console/field";
import { Input } from "@/components/ui/console/input";
import { Select } from "@/components/ui/console/select";
import { useToast } from "@/components/ui/console/toast";
import { assignableRoles } from "@/features/admin/assignable-roles";

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

/** Sentinel value in the team select — opens the inline “create team” fields. */
const CREATE_TEAM_VALUE = "__create_team__";

const FIELD_ORDER: FieldKey[] = ["email", "password", "firstName", "roleId", "teamId"];

function teamAvailableForLead(team: AdminTeam, editingUserId?: string | null): boolean {
  if (!team.teamLeadUserId) return true;
  return !!editingUserId && team.teamLeadUserId === editingUserId;
}

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
  const qc = useQueryClient();
  const [initialValues] = React.useState(() => initialValuesFor(initial));
  const [values, setValues] = React.useState(initialValues);
  const [submitted, setSubmitted] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [creatingTeam, setCreatingTeam] = React.useState(false);
  const [newTeamName, setNewTeamName] = React.useState("");
  const [newTeamDescription, setNewTeamDescription] = React.useState("");
  const [teamConfirm, setTeamConfirm] = React.useState<{
    previousName: string;
    newName: string;
  } | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const roleRef = React.useRef<HTMLSelectElement>(null);
  const teamRef = React.useRef<HTMLSelectElement>(null);
  const newTeamNameRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const initialFocusRef =
    focusField === "role" ? roleRef : focusField === "team" ? teamRef : focusField === "password" ? passwordRef : emailRef;

  const teamsQuery = useQuery({
    queryKey: ["teams", "user-form"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });
  const teams = teamsQuery.data?.data ?? [];
  const roleOptions = assignableRoles(roles, initial?.roleId);

  const { firstName, lastName, email, phone, password, teamId, isActive } = values;
  const roleId = values.roleId || roleOptions[0]?.id || "";
  const selectedRole = roleOptions.find((r) => r.id === roleId) ?? roles.find((r) => r.id === roleId);
  const isTeamLeadRole = selectedRole?.code === "sales_manager";
  const isSalesExecRole = selectedRole?.code === "sales_executive";
  const requiresTeam = isTeamLeadRole || isSalesExecRole;
  const selectedTeam = teams.find((t) => t.id === teamId);

  const teamsForLead = React.useMemo(
    () => teams.filter((t) => teamAvailableForLead(t, initial?.id)),
    [teams, initial?.id],
  );
  const teamsTakenByOtherLead = React.useMemo(
    () =>
      isTeamLeadRole
        ? teams.filter((t) => t.teamLeadUserId && t.teamLeadUserId !== initial?.id)
        : [],
    [teams, isTeamLeadRole, initial?.id],
  );
  const teamsForSelect = isTeamLeadRole ? teamsForLead : teams;

  const set = <K extends FieldKey>(key: K, value: Values[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  const dirty =
    creatingTeam ||
    newTeamName !== "" ||
    newTeamDescription !== "" ||
    (Object.keys(initialValues) as FieldKey[]).some((key) => values[key] !== initialValues[key]);

  React.useEffect(() => {
    if (!creatingTeam) return;
    const id = window.setTimeout(() => newTeamNameRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [creatingTeam]);

  const validate = () => {
    const errors: Partial<Record<FieldKey, string>> = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!email.trim()) errors.email = "Email is required";
    if (!roleId) errors.roleId = "Role is required";
    if (requiresTeam && creatingTeam) {
      if (!newTeamName.trim()) errors.teamId = "Enter a name for the new team";
    } else if (requiresTeam && !teamId) {
      errors.teamId = isTeamLeadRole
        ? "Team is required for Team Leads — pick one without a lead, or create a new team"
        : "Team is required for Sales Executives";
    } else if (isSalesExecRole && selectedTeam && !selectedTeam.teamLeadUserId) {
      errors.teamId = "Selected team does not have a Team Lead configured";
    } else if (
      isTeamLeadRole &&
      selectedTeam &&
      selectedTeam.teamLeadUserId &&
      selectedTeam.teamLeadUserId !== initial?.id
    ) {
      errors.teamId = `“${selectedTeam.name}” already has ${selectedTeam.teamLeadName ?? "a Team Lead"}. Pick another team or create a new one.`;
    }
    if (!initial && password.length < 8) errors.password = "Password must be at least 8 characters";
    return errors;
  };

  const errors = submitted ? validate() : {};

  const buildPayload = (resolvedTeamId: string, confirmTeamChange = false) => {
    const fullName = [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(" ");
    const payload: Record<string, unknown> = {
      fullName,
      email,
      phone,
      roleId,
      isActive,
    };
    if (requiresTeam) {
      payload.teamId = resolvedTeamId;
      payload.teamIds = resolvedTeamId ? [resolvedTeamId] : [];
    } else if (selectedRole?.code === "super_admin") {
      payload.teamIds = [];
    } else if (resolvedTeamId) {
      payload.teamId = resolvedTeamId;
      payload.teamIds = [resolvedTeamId];
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
      if (firstInvalid === "teamId" && creatingTeam) newTeamNameRef.current?.focus();
      else formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    const nextTeamName = creatingTeam ? newTeamName.trim() : (selectedTeam?.name ?? "new team");
    const teamChanged =
      !!initial && requiresTeam && !creatingTeam && (initial.teamIds?.[0] ?? "") !== teamId;
    if (teamChanged && !confirmTeamChange) {
      const prevTeam = teams.find((t) => t.id === initial.teamIds?.[0]);
      setTeamConfirm({
        previousName: prevTeam?.name ?? "previous team",
        newName: nextTeamName,
      });
      return;
    }
    if (creatingTeam && !!initial && !confirmTeamChange) {
      const prevTeam = teams.find((t) => t.id === initial.teamIds?.[0]);
      setTeamConfirm({
        previousName: prevTeam?.name ?? "previous team",
        newName: nextTeamName,
      });
      return;
    }

    setLoading(true);
    try {
      let resolvedTeamId = teamId;
      if (creatingTeam) {
        const created = await adminApi.createTeam({
          name: newTeamName.trim(),
          description: newTeamDescription.trim(),
          teamLeadUserId: "",
          memberIds: [],
        });
        resolvedTeamId = created.id;
        await qc.invalidateQueries({ queryKey: ["teams"] });
      }
      await onSubmit(buildPayload(resolvedTeamId, confirmTeamChange));
      setTeamConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save. Check required fields and try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onTeamSelectChange = (value: string) => {
    if (value === CREATE_TEAM_VALUE) {
      setCreatingTeam(true);
      set("teamId", "");
      return;
    }
    setCreatingTeam(false);
    setNewTeamName("");
    setNewTeamDescription("");
    set("teamId", value);
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
          <DrawerSection title="Sign-in">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" required error={errors.email} helper="Used to sign in.">
                <Input
                  ref={emailRef}
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => set("email", e.target.value)}
                />
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
            </div>
          </DrawerSection>

          <DrawerSection title="Profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={errors.firstName}>
                <Input
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

          <DrawerSection title="Access" description="What this person can see and do in the CRM.">
            <Field label="Role" required error={errors.roleId}>
              <Select
                ref={roleRef}
                name="roleId"
                value={roleId}
                onChange={(e) => {
                  const nextRoleId = e.target.value;
                  const nextCode =
                    roleOptions.find((r) => r.id === nextRoleId)?.code ??
                    roles.find((r) => r.id === nextRoleId)?.code;
                  set("roleId", nextRoleId);
                  if (nextCode !== "sales_manager") {
                    setCreatingTeam(false);
                    setNewTeamName("");
                    setNewTeamDescription("");
                  }
                }}
              >
                {roleOptions.length === 0 ? <option value="">Loading roles…</option> : null}
                {roleOptions.map((role) => (
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
                    isSalesExecRole
                      ? "A Sales Executive belongs to exactly one team. Changing the team is a transfer."
                      : isTeamLeadRole
                        ? "A Team Lead leads exactly one team. Only teams without a lead are listed — or create one below."
                        : undefined
                  }
                >
                  <Select
                    ref={teamRef}
                    name="teamId"
                    value={creatingTeam ? CREATE_TEAM_VALUE : teamId}
                    onChange={(e) => onTeamSelectChange(e.target.value)}
                    invalid={Boolean(errors.teamId)}
                  >
                    {requiresTeam ? (
                      <option value="" disabled>
                        {teamsQuery.isLoading ? "Loading teams…" : "Select a team"}
                      </option>
                    ) : (
                      <option value="">No team</option>
                    )}
                    {teamsForSelect.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                        {isTeamLeadRole && team.teamLeadUserId === initial?.id ? " (current)" : ""}
                      </option>
                    ))}
                    {isTeamLeadRole ? (
                      <option value={CREATE_TEAM_VALUE}>+ Create new team…</option>
                    ) : null}
                  </Select>
                </Field>

                {isTeamLeadRole && creatingTeam ? (
                  <div className="space-y-3 rounded-control border border-brand/30 bg-brand/5 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                      <div className="min-w-0 flex-1">
                        <p className="text-cell font-medium text-ink">New team</p>
                        <p className="text-caption text-ink-muted">
                          This person will become the Team Lead when you save.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => {
                          setCreatingTeam(false);
                          setNewTeamName("");
                          setNewTeamDescription("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <Field label="Team name" required error={submitted && !newTeamName.trim() ? errors.teamId : undefined}>
                      <Input
                        ref={newTeamNameRef}
                        name="newTeamName"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="e.g. Sydney Enterprise"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Description">
                      <Input
                        name="newTeamDescription"
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                ) : null}

                {isTeamLeadRole && !creatingTeam && teamsForLead.length === 0 ? (
                  <div className="rounded-control border border-warning-border bg-warning-soft px-3 py-2 text-caption text-ink">
                    <p className="font-medium">No open teams</p>
                    <p className="mt-0.5 text-ink-muted">
                      Every active team already has a Team Lead. Choose{" "}
                      <button
                        type="button"
                        className="font-medium text-brand underline-offset-2 hover:underline"
                        onClick={() => onTeamSelectChange(CREATE_TEAM_VALUE)}
                      >
                        Create new team…
                      </button>{" "}
                      above.
                    </p>
                    {teamsTakenByOtherLead.length > 0 ? (
                      <p className="mt-1.5 text-ink-muted">
                        Taken: {teamsTakenByOtherLead.map((t) => `${t.name} (${t.teamLeadName})`).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {isTeamLeadRole && !creatingTeam && selectedTeam && !selectedTeam.teamLeadUserId ? (
                  <p className="rounded-control border border-line bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                    “{selectedTeam.name}” has no Team Lead yet — this user will lead it.
                  </p>
                ) : null}

                {isSalesExecRole ? (
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
