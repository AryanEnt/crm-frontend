"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  DataTable,
  SortableHeader,
  createSelectColumn,
} from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { ErrorState } from "@/components/ui/error-state";

export function UsersAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [roleId, setRoleId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<AdminUser[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<AdminUser | null>(null);
  const [confirm, setConfirm] = React.useState<{ ids: string[]; active: boolean } | null>(
    null,
  );

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: adminApi.listRoles });

  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    p.set("offset", "0");
    if (search) p.set("q", search);
    if (roleId !== "all") p.set("roleId", roleId);
    if (status !== "all") p.set("isActive", status);
    return p;
  }, [search, roleId, status]);

  const usersQuery = useQuery({
    queryKey: ["users", params.toString()],
    queryFn: () => adminApi.listUsers(params),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      if (ids.length === 1) {
        await adminApi.setUserStatus(ids[0], active);
      } else {
        await adminApi.bulkUserStatus(ids, active);
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setConfirm(null);
      setSelected([]);
      toast.success(vars.active ? "Users activated" : "Users deactivated");
    },
    onError: (err: Error) => toast.error(err.message || "Could not update users"),
  });

  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      createSelectColumn<AdminUser>(),
      {
        accessorKey: "fullName",
        header: ({ column }) => <SortableHeader column={column} title="User" />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            <p className="text-xs text-foreground-muted">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "roleName",
        header: "Role",
        cell: ({ row }) => <StatusBadge tone="brand">{row.original.roleName}</StatusBadge>,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge tone={row.original.isActive ? "success" : "danger"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "teamIds",
        header: "Team",
        cell: ({ row }) => (
          <span className="text-foreground-muted text-xs">
            {row.original.teamIds?.length ? `${row.original.teamIds.length}` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-xs text-foreground-muted">{row.original.phone || "—"}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {can("users:edit") || can("users:manage") ? (
              <Button size="sm" variant="ghost" onClick={() => setEditUser(row.original)}>
                Edit
              </Button>
            ) : null}
            {(can("users:delete") || can("users:manage")) && row.original.isActive ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirm({ ids: [row.original.id], active: false })}
              >
                Deactivate
              </Button>
            ) : null}
            {(can("users:delete") || can("users:manage")) && !row.original.isActive ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm({ ids: [row.original.id], active: true })}
              >
                Activate
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [can],
  );

  if (usersQuery.isError) {
    return <ErrorState onRetry={() => void usersQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Control Center", href: "/" }, { label: "Users" }]}
        title="Users"
        description="Create the people who operate the CRM. Assign roles and teams — Super Admin does not create their sales leads."
        actions={
          can("users:create") || can("users:manage") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New user
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users…"
        onClear={() => {
          setSearch("");
          setRoleId("all");
          setStatus("all");
        }}
      >
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {(rolesQuery.data ?? []).map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {selected.length > 0 && (can("users:delete") || can("users:manage")) ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setConfirm({ ids: selected.map((u) => u.id), active: false })
              }
            >
              Deactivate selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm({ ids: selected.map((u) => u.id), active: true })}
            >
              Activate selected
            </Button>
          </>
        ) : null}
      </FilterBar>

      <DataTable
        columns={columns}
        data={usersQuery.data?.data ?? []}
        loading={usersQuery.isLoading}
        searchValue={search}
        onRowSelectionChange={setSelected}
        pageSize={10}
      />

      <UserFormDialog
        key={createOpen ? "create" : "create-closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={rolesQuery.data ?? []}
        onSubmit={async (values) => {
          await adminApi.createUser(values);
          await qc.invalidateQueries({ queryKey: ["users"] });
          setCreateOpen(false);
          toast.success("User created");
        }}
      />

      <UserFormDialog
        key={editUser?.id ?? "edit-closed"}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        roles={rolesQuery.data ?? []}
        initial={editUser}
        onSubmit={async (values) => {
          if (!editUser) return;
          await adminApi.updateUser(editUser.id, values);
          await qc.invalidateQueries({ queryKey: ["users"] });
          setEditUser(null);
          toast.success("User updated");
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.active ? "Activate users?" : "Deactivate users?"}
        description={
          confirm?.active
            ? "Selected accounts will regain access immediately."
            : "Users are deactivated, not deleted. Historical ownership remains intact and sessions are revoked."
        }
        confirmLabel={confirm?.active ? "Activate" : "Deactivate"}
        destructive={!confirm?.active}
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (!confirm) return;
          statusMutation.mutate(confirm);
        }}
      />
    </div>
  );
}

function UserFormDialog({
  open,
  onOpenChange,
  roles,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Array<{ id: string; code: string; name: string }>;
  initial?: AdminUser | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const nameParts = React.useMemo(() => {
    const parts = (initial?.fullName ?? "").trim().split(/\s+/);
    return {
      first: parts[0] ?? "",
      last: parts.slice(1).join(" "),
    };
  }, [initial?.fullName]);

  const [firstName, setFirstName] = React.useState(nameParts.first);
  const [lastName, setLastName] = React.useState(nameParts.last);
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [password, setPassword] = React.useState("");
  const [roleId, setRoleId] = React.useState(initial?.roleId ?? roles[0]?.id ?? "");
  const [teamId, setTeamId] = React.useState(initial?.teamIds?.[0] ?? "");
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [teamConfirm, setTeamConfirm] = React.useState<{
    previousName: string;
    newName: string;
    payload: Record<string, unknown>;
  } | null>(null);

  const teamsQuery = useQuery({
    queryKey: ["teams", "user-form"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });

  const selectedRole = roles.find((r) => r.id === roleId);
  const requiresTeam =
    selectedRole?.code === "sales_executive" || selectedRole?.code === "sales_manager";
  const selectedTeam = (teamsQuery.data?.data ?? []).find((t) => t.id === teamId);

  React.useEffect(() => {
    if (!open) return;
    setFirstName(nameParts.first);
    setLastName(nameParts.last);
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setRoleId(initial?.roleId ?? roles[0]?.id ?? "");
    setTeamId(initial?.teamIds?.[0] ?? "");
    setIsActive(initial?.isActive ?? true);
    setPassword("");
    setError(null);
  }, [open, initial, nameParts, roles]);

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
    setLoading(true);
    setError(null);
    try {
      if (!firstName.trim()) throw new Error("First name is required");
      if (!email.trim()) throw new Error("Email is required");
      if (!roleId) throw new Error("Role is required");
      if (requiresTeam && !teamId) {
        throw new Error(
          selectedRole?.code === "sales_manager"
            ? "Team is required for Team Leads"
            : "Team is required for Sales Executives",
        );
      }
      if (requiresTeam && selectedRole?.code === "sales_executive" && selectedTeam && !selectedTeam.ownerUserId) {
        throw new Error("Selected team does not have a Team Lead configured");
      }
      if (!initial && password.length < 8) throw new Error("Password must be at least 8 characters");

      const teamChanged =
        !!initial &&
        requiresTeam &&
        (initial.teamIds?.[0] ?? "") !== teamId;

      if (teamChanged && !confirmTeamChange) {
        const prevTeam = (teamsQuery.data?.data ?? []).find((t) => t.id === initial.teamIds?.[0]);
        setTeamConfirm({
          previousName: prevTeam?.name ?? "previous team",
          newName: selectedTeam?.name ?? "new team",
          payload: buildPayload(false),
        });
        setLoading(false);
        return;
      }

      await onSubmit(buildPayload(confirmTeamChange));
      setTeamConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>{initial ? "Edit user" : "Create user"}</ModalTitle>
            <ModalDescription>
              Assign role and team. Team Lead is derived from the selected team for Sales Executives.
            </ModalDescription>
          </ModalHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label required>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label required>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label required={!initial}>{initial ? "New password (optional)" : "Password"}</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required={!initial}
              />
            </div>
            <div className="space-y-1.5">
              <Label required>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label required={requiresTeam}>Team{requiresTeam ? "" : ""}</Label>
              <Select value={teamId || "none"} onValueChange={(v) => setTeamId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {!requiresTeam ? <SelectItem value="none">No team</SelectItem> : null}
                  {(teamsQuery.data?.data ?? []).map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {requiresTeam && selectedRole?.code === "sales_executive" ? (
              <div className="space-y-1 sm:col-span-2 rounded-md border border-border bg-[#EEECFF]/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-foreground-muted">Team Lead</p>
                <p className="text-sm font-medium text-foreground">
                  {selectedTeam?.ownerName ||
                    (selectedTeam
                      ? "No Team Lead configured — fix team setup before creating this SE"
                      : "Select a team to see Team Lead")}
                </p>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Status</Label>
              <Select value={isActive ? "active" : "inactive"} onValueChange={(v) => setIsActive(v === "active")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button loading={loading} onClick={() => void save(false)}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={!!teamConfirm}
        onOpenChange={(o) => !o && setTeamConfirm(null)}
        title="Change Team?"
        description={
          teamConfirm
            ? `This will move ${firstName} ${lastName} from ${teamConfirm.previousName} to ${teamConfirm.newName}. Their future team-scoped visibility will follow the new team.`
            : ""
        }
        confirmLabel="Change Team"
        loading={loading}
        onConfirm={() => void save(true)}
      />
    </>
  );
}
