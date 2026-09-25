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
import { adminApi, type AdminTeam, type AdminTeamMember, type AdminUser } from "@/lib/api/admin";
import { ErrorState } from "@/components/ui/error-state";

export function TeamsAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTeam, setEditTeam] = React.useState<AdminTeam | null>(null);
  const [viewTeam, setViewTeam] = React.useState<AdminTeam | null>(null);
  const [confirm, setConfirm] = React.useState<{ id: string; active: boolean } | null>(
    null,
  );

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (search) p.set("q", search);
    if (status !== "all") p.set("isActive", status);
    return p;
  }, [search, status]);

  const teamsQuery = useQuery({
    queryKey: ["teams", params.toString()],
    queryFn: () => adminApi.listTeams(params),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "for-teams", createOpen ? "new" : editTeam?.id ?? "idle"],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100", isActive: "true" });
      if (editTeam?.id) {
        p.set("availableForTeamId", editTeam.id);
      } else if (createOpen) {
        p.set("availableForTeamId", "new");
      }
      return adminApi.listUsers(p);
    },
    enabled: createOpen || !!editTeam,
  });
  const rosterQuery = useQuery({
    queryKey: ["teams", "roster"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "200" })),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.setTeamStatus(id, active),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
      setConfirm(null);
      toast.success(vars.active ? "Team activated" : "Team deactivated");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't update the team. Try again."),
  });

  const columns = React.useMemo<ColumnDef<AdminTeam>[]>(
    () => [
      createSelectColumn<AdminTeam>(),
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} title="Team" />,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left"
            onClick={() => setViewTeam(row.original)}
          >
            <p className="font-medium text-foreground hover:underline">{row.original.name}</p>
            <p className="text-xs text-foreground-muted line-clamp-1">
              {row.original.description || "—"}
            </p>
          </button>
        ),
      },
      {
        accessorKey: "teamLeadName",
        header: "Team Lead",
        cell: ({ row }) => (
          <span className="text-foreground-muted">{row.original.teamLeadName ?? "Unassigned"}</span>
        ),
      },
      {
        accessorKey: "memberCount",
        header: "Members",
        cell: ({ row }) => (
          <button
            type="button"
            className="text-foreground-muted hover:text-foreground hover:underline"
            onClick={() => setViewTeam(row.original)}
          >
            {row.original.memberCount}
          </button>
        ),
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
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {(can("teams:edit") || can("teams:manage") || can("teams:assign")) && (
              <Button size="sm" variant="ghost" onClick={() => setEditTeam(row.original)}>
                Edit
              </Button>
            )}
            {(can("teams:delete") || can("teams:manage")) && (
              <Button
                size="sm"
                variant="ghost"
                className={row.original.isActive ? "text-destructive" : undefined}
                onClick={() =>
                  setConfirm({ id: row.original.id, active: !row.original.isActive })
                }
              >
                {row.original.isActive ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [can],
  );

  if (teamsQuery.isError) {
    return <ErrorState onRetry={() => void teamsQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Control Center", href: "/" }, { label: "Teams" }]}
        title="Teams"
        description="Create teams, assign Team Leads, and manage membership for CRM operating roles."
        actions={
          can("teams:create") || can("teams:manage") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New team
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams…"
        onClear={() => {
          setSearch("");
          setStatus("all");
        }}
      >
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
      </FilterBar>

      <DataTable
        columns={columns}
        data={teamsQuery.data?.data ?? []}
        loading={teamsQuery.isLoading}
        searchValue={search}
        pageSize={10}
      />

      <TeamFormDialog
        key={createOpen ? "create" : "create-closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={usersQuery.data?.data ?? []}
        teams={rosterQuery.data?.data ?? []}
        onSubmit={async (values) => {
          await adminApi.createTeam(values);
          await qc.invalidateQueries({ queryKey: ["teams"] });
          await qc.invalidateQueries({ queryKey: ["users"] });
          setCreateOpen(false);
          toast.success("Team created");
        }}
      />

      <TeamFormDialog
        key={editTeam?.id ?? "edit-closed"}
        open={!!editTeam}
        onOpenChange={(open) => !open && setEditTeam(null)}
        users={usersQuery.data?.data ?? []}
        teams={rosterQuery.data?.data ?? []}
        initial={editTeam}
        onSubmit={async (values) => {
          if (!editTeam) return;
          await adminApi.updateTeam(editTeam.id, values);
          await qc.invalidateQueries({ queryKey: ["teams"] });
          await qc.invalidateQueries({ queryKey: ["users"] });
          setEditTeam(null);
          toast.success("Team updated");
        }}
      />

      <TeamMembersDialog
        team={viewTeam}
        onOpenChange={(open) => !open && setViewTeam(null)}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.active ? "Activate team?" : "Deactivate team?"}
        description="Team history and memberships are retained when a team is deactivated."
        confirmLabel={confirm?.active ? "Activate" : "Deactivate"}
        destructive={!confirm?.active}
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (confirm) statusMutation.mutate(confirm);
        }}
      />
    </div>
  );
}

function TeamMembersDialog({
  team,
  onOpenChange,
}: {
  team: AdminTeam | null;
  onOpenChange: (open: boolean) => void;
}) {
  const people = (team?.members ?? [])
    .filter((user) => user.roleCode !== "super_admin")
    .slice()
    .sort((a, b) => {
      const aLead = a.id === team?.teamLeadUserId ? 0 : 1;
      const bLead = b.id === team?.teamLeadUserId ? 0 : 1;
      if (aLead !== bLead) return aLead - bLead;
      return a.fullName.localeCompare(b.fullName);
    });

  return (
    <Modal open={!!team} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>{team?.name ?? "Team"}</ModalTitle>
          <ModalDescription>
            {team?.teamLeadName ? `Team Lead: ${team.teamLeadName}` : "No Team Lead assigned"}
          </ModalDescription>
        </ModalHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {people.length === 0 ? (
            <p className="text-sm text-foreground-muted">No members on this team yet.</p>
          ) : (
            people.map((user) => (
              <MemberRow key={user.id} user={user} leadId={team?.teamLeadUserId} />
            ))
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function MemberRow({ user, leadId }: { user: AdminTeamMember; leadId?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.fullName}</p>
        <p className="truncate text-xs text-foreground-muted">{user.email}</p>
      </div>
      <span className="shrink-0 text-xs text-foreground-subtle">
        {user.id === leadId ? "Team Lead" : user.roleName}
      </span>
    </div>
  );
}

function assignedTeamId(user: AdminUser, teams: AdminTeam[], preferTeamId?: string): string | undefined {
  if (preferTeamId) {
    const preferred = teams.find((t) => t.id === preferTeamId);
    if (
      preferred &&
      (preferred.teamLeadUserId === user.id || (preferred.memberIds ?? []).includes(user.id))
    ) {
      return preferTeamId;
    }
  }
  const fromUser = (user.teamIds ?? []).find(Boolean);
  if (fromUser) return fromUser;
  for (const team of teams) {
    if (team.teamLeadUserId === user.id) return team.id;
    if ((team.memberIds ?? []).includes(user.id)) return team.id;
  }
  return undefined;
}

/** Eligible for this team: unassigned, or already on this same team. Never Super Admin. */
function isEligibleForTeam(
  user: AdminUser,
  teams: AdminTeam[],
  currentTeamId?: string,
): boolean {
  if (user.roleCode === "super_admin") return false;
  const assigned = assignedTeamId(user, teams, currentTeamId);
  if (!assigned) return true;
  return !!currentTeamId && assigned === currentTeamId;
}

function TeamFormDialog({
  open,
  onOpenChange,
  users,
  teams,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: AdminUser[];
  teams: AdminTeam[];
  initial?: AdminTeam | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [teamLeadUserId, setTeamLeadUserId] = React.useState(initial?.teamLeadUserId ?? "none");
  const [memberIds, setMemberIds] = React.useState<string[]>(
    (initial?.memberIds ?? []).filter((id) => id !== initial?.teamLeadUserId),
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const teamLeads = users.filter(
    (u) =>
      u.roleCode === "sales_manager" &&
      (u.isActive || u.id === initial?.teamLeadUserId) &&
      isEligibleForTeam(u, teams, initial?.id),
  );
  const memberChoices = users.filter(
    (u) =>
      u.roleCode !== "super_admin" &&
      u.roleCode !== "sales_manager" &&
      (u.isActive || memberIds.includes(u.id)) &&
      isEligibleForTeam(u, teams, initial?.id),
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>{initial ? "Edit team" : "Create team"}</ModalTitle>
          <ModalDescription>
            Assign a Team Lead and the people who work on this team. Super Admin is not a member of any team.
            Sales Executives already on another team are not listed — transfer them from Users instead.
          </ModalDescription>
        </ModalHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Team Lead</Label>
            <Select value={teamLeadUserId} onValueChange={setTeamLeadUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Team Lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamLeads.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team Members</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {memberChoices.length === 0 ? (
                <p className="text-xs text-foreground-muted">
                  No available users. Unassigned Sales Executives appear here.
                </p>
              ) : null}
              {memberChoices.map((u) => {
                const checked = memberIds.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setMemberIds((prev) =>
                          e.target.checked
                            ? [...prev, u.id]
                            : prev.filter((id) => id !== u.id),
                        );
                      }}
                    />
                    <span>{u.fullName}</span>
                    <span className="text-xs text-foreground-subtle">{u.roleName}</span>
                    <span className="text-xs text-foreground-subtle">{u.email}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                setError(null);
                try {
                  await onSubmit({
                    name,
                    description,
                    teamLeadUserId: teamLeadUserId === "none" ? "" : teamLeadUserId,
                    memberIds,
                  });
                } catch (err) {
                  const message = err instanceof Error ? err.message : "Couldn't save. Check required fields and try again.";
                  setError(message);
                  toast.error(message);
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
