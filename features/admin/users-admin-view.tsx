"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import { dataScopeFor } from "@/features/auth/list-scope";
import { adminApi, type AdminUser } from "@/lib/api/admin";
import { Button, IconButton } from "@/components/ui/console/button";
import { Checkbox } from "@/components/ui/console/checkbox";
import { ConfirmDialog } from "@/components/ui/console/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/console/dropdown-menu";
import { EmptyState, ErrorCard } from "@/components/ui/console/empty-state";
import { SearchInput } from "@/components/ui/console/input";
import { ConsolePageHeader } from "@/components/ui/console/page-header";
import {
  BulkActionBar,
  Table,
  TableCard,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  useRowSelection,
  type SortDirection,
} from "@/components/ui/console/data-table";
import { ToastProvider, useToast } from "@/components/ui/console/toast";
import { ColumnsMenu, DensityToggle, FilterSelect, type ColumnOption } from "@/components/ui/console/toolbar";
import { TeamMemberDrawer } from "./team-member-drawer";
import { UserFormDrawer, type UserFormFocus } from "./user-form-drawer";
import {
  LastActiveCell,
  PhoneCell,
  RoleBadge,
  StatusCell,
  TeamCell,
  UserCell,
  UserRowSkeleton,
  displayName,
  downloadUsersCsv,
  useNow,
} from "./users-table-cells";

type SortKey = "name" | "role" | "status" | "team" | "lastActive";
type Sort = { key: SortKey; dir: SortDirection } | null;

const COLUMNS: ColumnOption[] = [
  { id: "user", label: "User", required: true },
  { id: "role", label: "Role" },
  { id: "status", label: "Status" },
  { id: "team", label: "Team" },
  { id: "phone", label: "Phone" },
  { id: "lastActive", label: "Last active" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function UsersAdminView() {
  return (
    <ToastProvider>
      <UsersConsole />
    </ToastProvider>
  );
}

function UsersConsole() {
  const { can, user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();

  /** Team Leads see the people on their own team; the server scopes every request the same way. */
  const teamScoped = dataScopeFor(me, "users:view") !== "organization";
  const canCreate = can("users:create") || can("users:manage");
  const canEdit = can("users:edit") || can("users:manage");
  const canChangeStatus = can("users:delete") || can("users:manage");
  const canManage = (user: AdminUser) =>
    !teamScoped || (user.roleCode === "sales_executive" && user.id !== me?.id);
  const columns = teamScoped ? COLUMNS.filter((c) => c.id !== "team") : COLUMNS;

  const [search, setSearch] = React.useState("");
  const [roleId, setRoleId] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<string | null>(() => {
    const fromUrl = searchParams.get("status");
    return fromUrl === "active" ? "true" : fromUrl === "inactive" ? "false" : null;
  });
  const [teamId, setTeamId] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<Sort>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [hiddenColumns, setHiddenColumns] = React.useState<ReadonlySet<string>>(() => new Set());
  const [drawer, setDrawer] = React.useState<{
    open: boolean;
    key: number;
    user: AdminUser | null;
    focus?: UserFormFocus;
  }>({ open: false, key: 0, user: null });
  const [confirm, setConfirm] = React.useState<{ ids: string[]; active: boolean; name?: string } | null>(null);
  const [confirmView, setConfirmView] = React.useState(confirm);
  if (confirm && confirm !== confirmView) setConfirmView(confirm);

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: adminApi.listRoles });
  const teamsQuery = useQuery({
    queryKey: ["teams", "lookup"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100" })),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "50");
    p.set("offset", "0");
    if (search) p.set("q", search);
    if (roleId) p.set("roleId", roleId);
    if (status) p.set("isActive", status);
    if (teamId) p.set("teamId", teamId);
    return p;
  }, [search, roleId, status, teamId]);

  const usersQuery = useQuery({
    queryKey: ["users", params.toString()],
    queryFn: () => adminApi.listUsers(params),
  });

  const users = React.useMemo(() => {
    const rows = usersQuery.data?.data ?? [];
    return teamScoped ? rows.filter((user) => user.id !== me?.id) : rows;
  }, [usersQuery.data, teamScoped, me?.id]);
  const total = teamScoped ? users.length : (usersQuery.data?.total ?? users.length);
  const roles = rolesQuery.data ?? [];
  const salesExecutiveRoleId = roles.find((role) => role.code === "sales_executive")?.id;
  const teamNames = React.useMemo(
    () => new Map((teamsQuery.data?.data ?? []).map((team) => [team.id, team.name] as const)),
    [teamsQuery.data],
  );
  const myTeamName = teamScoped
    ? me?.teamIds?.map((id) => teamNames.get(id)).find(Boolean)
    : undefined;

  const sorted = React.useMemo(() => {
    if (!sort) return users;
    const dir = sort.dir === "asc" ? 1 : -1;
    const text = (user: AdminUser) => {
      switch (sort.key) {
        case "name":
          return user.fullName;
        case "role":
          return user.roleName;
        case "status":
          return user.isActive ? "0" : "1";
        case "team":
          return user.teamIds?.[0] ? (teamNames.get(user.teamIds[0]) ?? "") : "\uffff";
        default:
          return "";
      }
    };
    return [...users].sort((a, b) => {
      if (sort.key === "lastActive") {
        const ta = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : null;
        const tb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : null;
        if (ta === tb) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return (ta - tb) * dir;
      }
      return collator.compare(text(a), text(b)) * dir;
    });
  }, [users, sort, teamNames]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = React.useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );
  const pageIds = React.useMemo(
    () =>
      pageRows
        .filter((user) => !teamScoped || (user.roleCode === "sales_executive" && user.id !== me?.id))
        .map((user) => user.id),
    [pageRows, teamScoped, me?.id],
  );
  const selection = useRowSelection(pageIds);
  const selectedUsers = users.filter((user) => selection.isSelected(user.id));

  const statusMutation = useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean; undo?: boolean }) => {
      if (ids.length === 1) {
        await adminApi.setUserStatus(ids[0], active);
      } else {
        await adminApi.bulkUserStatus(ids, active);
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      setConfirm(null);
      selection.clear();
      const subject = vars.ids.length === 1 ? "User" : `${vars.ids.length} users`;
      if (vars.undo) {
        toast.info(`${subject} ${vars.active ? "reactivated" : "deactivated again"}`);
        return;
      }
      toast.success(`${subject} ${vars.active ? "activated" : "deactivated"}`, {
        description: vars.active ? undefined : "Active sessions were signed out.",
        action: {
          label: "Undo",
          onClick: () => statusMutation.mutate({ ids: vars.ids, active: !vars.active, undo: true }),
        },
      });
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't update users. Try again."),
  });

  const filtersActive = roleId !== null || status !== null || teamId !== null;
  const anyFilter = filtersActive || search !== "";

  const resetView = () => {
    setPage(1);
    selection.clear();
  };
  const clearFilters = () => {
    setRoleId(null);
    setStatus(null);
    setTeamId(null);
    resetView();
  };
  const clearAll = () => {
    setSearch("");
    clearFilters();
  };

  const show = (column: string) => columns.some((c) => c.id === column) && !hiddenColumns.has(column);
  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev?.key !== key ? { key, dir: "asc" } : prev.dir === "asc" ? { key, dir: "desc" } : null,
    );
  const sortedBy = (key: SortKey) => (sort?.key === key ? sort.dir : false);

  const openDrawer = (user: AdminUser | null, focus?: UserFormFocus) =>
    setDrawer((prev) => ({ open: true, key: prev.key + 1, user, focus }));
  const closeDrawer = () => setDrawer((prev) => ({ ...prev, open: false }));

  const bulkActive = selectedUsers.length > 0;
  const loading = usersQuery.isLoading;

  const tableHead = (
    <thead>
      <tr>
        <TableHead className="w-10 pr-0">
          <Checkbox
            aria-label="Select all users on this page"
            checked={selection.allState === true}
            indeterminate={selection.allState === "indeterminate"}
            disabled={loading || pageIds.length === 0}
            onCheckedChange={(checked) => selection.toggleAll(checked)}
          />
        </TableHead>
        <TableHead sortable sorted={sortedBy("name")} onSort={() => toggleSort("name")}>
          User
        </TableHead>
        {show("role") ? (
          <TableHead sortable sorted={sortedBy("role")} onSort={() => toggleSort("role")}>
            Role
          </TableHead>
        ) : null}
        {show("status") ? (
          <TableHead sortable sorted={sortedBy("status")} onSort={() => toggleSort("status")}>
            Status
          </TableHead>
        ) : null}
        {show("team") ? (
          <TableHead sortable sorted={sortedBy("team")} onSort={() => toggleSort("team")}>
            Team
          </TableHead>
        ) : null}
        {show("phone") ? <TableHead className="hidden lg:table-cell">Phone</TableHead> : null}
        {show("lastActive") ? (
          <TableHead
            className="hidden lg:table-cell"
            sortable
            sorted={sortedBy("lastActive")}
            onSort={() => toggleSort("lastActive")}
          >
            Last active
          </TableHead>
        ) : null}
        <TableHead className="w-12">
          <span className="sr-only">Actions</span>
        </TableHead>
      </tr>
    </thead>
  );

  let body: React.ReactNode;
  if (usersQuery.isError) {
    body = <ErrorCard onRetry={() => void usersQuery.refetch()} retrying={usersQuery.isFetching} />;
  } else if (loading) {
    body = (
      <Table aria-busy="true">
        <caption className="sr-only">Loading users</caption>
        {tableHead}
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <UserRowSkeleton key={i} show={show} />
          ))}
        </tbody>
      </Table>
    );
  } else if (users.length === 0) {
    body = anyFilter ? (
      <EmptyState
        icon={SearchX}
        title="No users match your filters"
        description="Try a different search term or remove a filter."
        action={<Button onClick={clearAll}>Clear filters</Button>}
      />
    ) : teamScoped ? (
      <EmptyState
        icon={UsersRound}
        title="No team members yet."
        description={`Add a Sales Executive to ${myTeamName ?? "your team"}. They'll work their own leads, customers and deals, and you'll see everything they do.`}
        action={
          canCreate ? (
            <Button variant="primary" onClick={() => openDrawer(null)}>
              <UserPlus aria-hidden />
              Add Sales Executive
            </Button>
          ) : null
        }
      />
    ) : (
      <EmptyState
        icon={Users}
        title="No users yet"
        description="Add the people who'll work in the CRM, then give them a role and a team."
        action={
          canCreate ? (
            <Button variant="primary" onClick={() => openDrawer(null)}>
              <Plus aria-hidden />
              New user
            </Button>
          ) : null
        }
      />
    );
  } else {
    body = (
      <Table>
        <caption className="sr-only">Users</caption>
        {tableHead}
        <tbody>
          {pageRows.map((user) => {
            const name = displayName(user.fullName);
            const selected = selection.isSelected(user.id);
            const manageable = canManage(user);
            return (
              <TableRow
                key={user.id}
                selected={selected}
                onActivate={canEdit && manageable ? () => openDrawer(user) : undefined}
              >
                <TableCell className="w-10 pr-0" data-row-ignore>
                  <Checkbox
                    aria-label={`Select ${name}`}
                    checked={selected}
                    disabled={!manageable}
                    onCheckedChange={(checked, { shiftKey }) => selection.toggle(user.id, checked, { shiftKey })}
                  />
                </TableCell>
                <TableCell className="max-w-72">
                  <UserCell user={user} />
                </TableCell>
                {show("role") ? (
                  <TableCell>
                    <RoleBadge user={user} />
                  </TableCell>
                ) : null}
                {show("status") ? (
                  <TableCell>
                    <StatusCell active={user.isActive} />
                  </TableCell>
                ) : null}
                {show("team") ? (
                  <TableCell>
                    <TeamCell teamIds={user.teamIds} teamNames={teamNames} loading={teamsQuery.isLoading} />
                  </TableCell>
                ) : null}
                {show("phone") ? (
                  <TableCell className="hidden lg:table-cell">
                    <PhoneCell phone={user.phone} />
                  </TableCell>
                ) : null}
                {show("lastActive") ? (
                  <TableCell className="hidden lg:table-cell">
                    <LastActiveCell value={user.lastLoginAt} now={now} />
                  </TableCell>
                ) : null}
                <TableCell className="w-12" align="right">
                  <RowActions
                    user={user}
                    name={name}
                    canEdit={canEdit && manageable}
                    canReassign={!teamScoped}
                    canChangeStatus={canChangeStatus && manageable}
                    onEdit={(focus) => openDrawer(user, focus)}
                    onSetActive={(active) => setConfirm({ ids: [user.id], active, name })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </tbody>
      </Table>
    );
  }

  const confirmCount = confirmView?.ids.length ?? 0;
  const confirmSubject = confirmCount === 1 ? (confirmView?.name ?? "this user") : `${confirmCount} users`;

  return (
    <div className="flex flex-col gap-4">
      <ConsolePageHeader
        breadcrumbs={
          teamScoped
            ? [{ label: "Workspace", href: "/" }, { label: "My team" }]
            : [{ label: "Control Center", href: "/" }, { label: "Users" }]
        }
        title={teamScoped ? (myTeamName ?? "My team") : "Users"}
        count={usersQuery.isSuccess ? total : undefined}
        description={
          teamScoped
            ? "The Sales Executives you lead. Add people, keep their details current, and pause access when someone leaves."
            : "Manage who can access the CRM, their roles and teams."
        }
        actions={
          <>
            <Button onClick={() => downloadUsersCsv(sorted, teamNames)} disabled={users.length === 0}>
              <Download aria-hidden />
              Export
            </Button>
            {canCreate ? (
              <Button variant="primary" onClick={() => openDrawer(null)}>
                {teamScoped ? <UserPlus aria-hidden /> : <Plus aria-hidden />}
                {teamScoped ? "Add Sales Executive" : "New user"}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid min-h-9 items-center [&>*]:[grid-area:1/1]">
        <div
          inert={bulkActive}
          className={cn(
            "flex flex-wrap items-center gap-2 transition-opacity duration-150 ease-standard",
            bulkActive && "pointer-events-none opacity-0",
          )}
        >
          <SearchInput
            value={search}
            onValueChange={(value) => {
              setSearch(value);
              resetView();
            }}
            placeholder="Search by name or email…"
            aria-label={teamScoped ? "Search your team" : "Search users"}
            className="w-full sm:w-72"
          />
          {teamScoped ? null : (
            <FilterSelect
              label="Role"
              icon={ShieldCheck}
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              value={roleId}
              onChange={(value) => {
                setRoleId(value);
                resetView();
              }}
            />
          )}
          <FilterSelect
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(value) => {
              setStatus(value);
              resetView();
            }}
          />
          {teamScoped ? null : (
            <FilterSelect
              label="Team"
              icon={UsersRound}
              options={(teamsQuery.data?.data ?? []).map((team) => ({ value: team.id, label: team.name }))}
              value={teamId}
              onChange={(value) => {
                setTeamId(value);
                resetView();
              }}
            />
          )}
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <DensityToggle />
            <ColumnsMenu
              columns={columns}
              visible={new Set(columns.filter((c) => show(c.id)).map((c) => c.id))}
              onToggle={(id, visible) =>
                setHiddenColumns((prev) => {
                  const next = new Set(prev);
                  if (visible) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          </div>
        </div>

        <BulkActionBar count={selectedUsers.length} onClear={selection.clear}>
          {canChangeStatus && selectedUsers.some((u) => !u.isActive) ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirm({ ids: selectedUsers.map((u) => u.id), active: true })}
            >
              <UserCheck aria-hidden />
              Activate
            </Button>
          ) : null}
          {canChangeStatus && selectedUsers.some((u) => u.isActive) ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setConfirm({ ids: selectedUsers.map((u) => u.id), active: false })}
            >
              <UserX aria-hidden />
              Deactivate
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => downloadUsersCsv(selectedUsers, teamNames)}>
            <Download aria-hidden />
            Export
          </Button>
        </BulkActionBar>
      </div>

      <TableCard
        scrollClassName="max-h-[calc(100dvh-17rem)]"
        footer={
          !usersQuery.isError && !loading && users.length > 0 ? (
            <TablePagination
              page={currentPage}
              pageSize={pageSize}
              total={sorted.length}
              itemLabel={sorted.length === 1 ? "user" : "users"}
              onPageChange={(next) => setPage(next)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          ) : null
        }
      >
        {body}
      </TableCard>

      {drawer.key > 0 && teamScoped ? (
        <TeamMemberDrawer
          key={drawer.key}
          open={drawer.open}
          onOpenChange={(open) => {
            if (!open) closeDrawer();
          }}
          member={drawer.user}
          teamName={myTeamName}
          salesExecutiveRoleId={salesExecutiveRoleId}
          focusPassword={drawer.focus === "password"}
          onSaved={async (saved, mode) => {
            await qc.invalidateQueries({ queryKey: ["users"] });
            closeDrawer();
            if (mode === "created") {
              toast.success("Sales Executive added", {
                description: `${displayName(saved.fullName)} can sign in with ${saved.email}.`,
              });
            } else {
              toast.success("Sales Executive updated");
            }
          }}
        />
      ) : null}

      {drawer.key > 0 && !teamScoped ? (
        <UserFormDrawer
          key={drawer.key}
          open={drawer.open}
          onOpenChange={(open) => {
            if (!open) closeDrawer();
          }}
          roles={roles}
          initial={drawer.user}
          focusField={drawer.focus}
          onSubmit={async (values) => {
            if (drawer.user) {
              await adminApi.updateUser(drawer.user.id, values);
            } else {
              await adminApi.createUser(values);
            }
            await qc.invalidateQueries({ queryKey: ["users"] });
            closeDrawer();
            toast.success(drawer.user ? "User updated" : "User created");
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone={confirmView?.active ? "default" : "danger"}
        icon={confirmView?.active ? UserCheck : UserX}
        title={confirmView?.active ? `Activate ${confirmSubject}?` : `Deactivate ${confirmSubject}?`}
        description={
          confirmView?.active
            ? "Access to the CRM is restored immediately."
            : "Access is removed immediately and any active sessions are signed out. Users are deactivated, not deleted: their leads, deals and history stay intact, and you can reactivate them at any time."
        }
        confirmLabel={confirmView?.active ? "Activate" : "Deactivate"}
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (!confirm) return;
          statusMutation.mutate({ ids: confirm.ids, active: confirm.active });
        }}
      />
    </div>
  );
}

function RowActions({
  user,
  name,
  canEdit,
  canReassign,
  canChangeStatus,
  onEdit,
  onSetActive,
}: {
  user: AdminUser;
  name: string;
  canEdit: boolean;
  /** Role and team changes are Super Admin only; the server rejects them for everyone else. */
  canReassign: boolean;
  canChangeStatus: boolean;
  onEdit: (focus?: UserFormFocus) => void;
  onSetActive: (active: boolean) => void;
}) {
  if (!canEdit && !canChangeStatus) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <IconButton
          label={`Actions for ${name}`}
          size="sm"
          tooltip={false}
          className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
        >
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={`Actions for ${name}`}>
        {canEdit ? (
          <>
            <DropdownMenuItem icon={Pencil} onSelect={() => onEdit()}>
              Edit
            </DropdownMenuItem>
            {canReassign ? (
              <DropdownMenuItem icon={ShieldCheck} onSelect={() => onEdit("role")}>
                Change role
              </DropdownMenuItem>
            ) : null}
            {canReassign && user.roleCode !== "super_admin" ? (
              <DropdownMenuItem icon={UsersRound} onSelect={() => onEdit("team")}>
                Assign team
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem icon={KeyRound} onSelect={() => onEdit("password")}>
              Reset password
            </DropdownMenuItem>
          </>
        ) : null}
        {canChangeStatus ? (
          <>
            {canEdit ? <DropdownMenuSeparator /> : null}
            {user.isActive ? (
              <DropdownMenuItem icon={UserX} tone="danger" onSelect={() => onSetActive(false)}>
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem icon={UserCheck} onSelect={() => onSetActive(true)}>
                Activate
              </DropdownMenuItem>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
