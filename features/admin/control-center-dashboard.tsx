"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  UsersRound,
  Layers,
  Zap,
  ScrollText,
  AlertTriangle,
  Shield,
  FormInput,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiStripSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

export function ControlCenterDashboard() {
  const { user, can } = useAuth();

  const usersQuery = useQuery({
    queryKey: ["control-center", "users"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100" })),
    enabled: can("users:view"),
  });
  const teamsQuery = useQuery({
    queryKey: ["control-center", "teams"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100" })),
    enabled: can("teams:view"),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["control-center", "pipelines"],
    queryFn: () => crmApi.listPipelines(undefined, true),
    enabled: can("pipelines:view") || can("pipelines:manage"),
  });
  const automationsQuery = useQuery({
    queryKey: ["control-center", "automations"],
    queryFn: () => adminApi.listAutomations(new URLSearchParams({ limit: "50" })),
    enabled: can("automations:view"),
  });
  const auditQuery = useQuery({
    queryKey: ["control-center", "audit"],
    queryFn: () =>
      adminApi.listAuditLogs(new URLSearchParams({ limit: "12", offset: "0" })),
    enabled: can("audit:view"),
  });
  const jobsQuery = useQuery({
    queryKey: ["control-center", "automation-jobs"],
    queryFn: () =>
      adminApi.listAutomationJobs(new URLSearchParams({ limit: "20", status: "failed" })),
    enabled: can("automations:view"),
  });

  const users = usersQuery.data?.data ?? [];
  const teams = teamsQuery.data?.data ?? [];
  const pipelines = pipelinesQuery.data ?? [];
  const automationList = automationsQuery.data?.data ?? [];
  const audit = auditQuery.data?.data ?? [];

  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = users.length - activeUsers;
  const activeTeams = teams.filter((t) => t.isActive).length;
  const activePipelines = pipelines.filter((p) => p.isActive !== false).length;
  const stageCount = pipelines.reduce((n, p) => n + (p.stages?.length ?? 0), 0);
  const activeAutomations = automationList.filter((a) => a.isActive).length;

  const loading =
    (can("users:view") && usersQuery.isLoading) ||
    (can("teams:view") && teamsQuery.isLoading);

  if (usersQuery.isError && teamsQuery.isError) {
    return <ErrorState onRetry={() => void usersQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Control Center" }, { label: "Overview" }]}
        title="Control Center"
        description={`Govern users, teams, and Setup${user?.fullName ? ` · ${user.fullName}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {can("users:create") || can("users:manage") ? (
              <Button size="sm" asChild>
                <Link href="/admin/users">Manage users</Link>
              </Button>
            ) : null}
            {can("audit:view") ? (
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/audit-logs">Audit logs</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? <KpiStripSkeleton count={5} /> : null}

      <section className="space-y-3">
        <h2 className="text-section">Organization</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <MetricCard label="Total users" value={String(users.length)} icon={Users} />
          <MetricCard label="Active users" value={String(activeUsers)} icon={Users} />
          <MetricCard label="Inactive users" value={String(inactiveUsers)} icon={Users} />
          <MetricCard label="Total teams" value={String(teams.length)} icon={UsersRound} />
          <MetricCard label="Active teams" value={String(activeTeams)} icon={UsersRound} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-section">Setup</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard label="Active pipelines" value={String(activePipelines)} icon={Layers} />
          <MetricCard label="Stages" value={String(stageCount)} icon={Layers} />
          <MetricCard label="Active automations" value={String(activeAutomations)} icon={Zap} />
          <MetricCard
            label="Custom fields"
            value="—"
            icon={FormInput}
            hint="Configure in Custom Fields"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/admin/pipelines", label: "Pipelines & stages", perm: "pipelines:manage" },
            { href: "/admin/custom-fields", label: "Custom fields", perm: "custom_fields:view" },
            { href: "/admin/lead-sources", label: "Lead sources", perm: "lead_sources:view" },
            { href: "/admin/activity-types", label: "Activity types", perm: "activity_types:view" },
            { href: "/admin/referrals", label: "Referrals", perm: "referrals:view" },
            { href: "/admin/automations", label: "Automations", perm: "automations:view" },
          ]
            .filter((c) => can(c.perm) || can(c.perm.replace(":view", ":manage")))
            .map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {c.label}
              </Link>
            ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-md border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="size-4 text-foreground-muted" />
              Recent audit events
            </h2>
            {can("audit:view") ? (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/admin/audit-logs">View all</Link>
              </Button>
            ) : null}
          </div>
          {!can("audit:view") ? (
            <EmptyState title="No audit access" description="You need audit log permission to view events here." />
          ) : auditQuery.isLoading ? (
            <KpiStripSkeleton count={1} className="grid-cols-1" />
          ) : audit.length === 0 ? (
            <EmptyState title="No recent events" description="Governance actions will show up here as people change setup." />
          ) : (
            <ul className="divide-y divide-border">
              {audit.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.action}</p>
                    <p className="truncate text-[11px] text-foreground-muted">
                      {row.resourceType}
                      {row.actorName ? ` · ${row.actorName}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-foreground-subtle">
                    {formatWhen(row.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-md border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="size-4 text-foreground-muted" />
              Governance
            </h2>
            {can("system:view") || can("audit:view") ? (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/admin/system-activity">System activity</Link>
              </Button>
            ) : null}
          </div>
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-3.5 text-warning" />
                Failed automation jobs
              </span>
              <StatusBadge tone={jobsQuery.data?.total ? "warning" : "success"}>
                {jobsQuery.isLoading ? "…" : String(jobsQuery.data?.total ?? 0)}
              </StatusBadge>
            </li>
            <li className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <Activity className="size-3.5 text-info" />
                Permission model
              </span>
              <StatusBadge tone="brand">resource:action</StatusBadge>
            </li>
            <li className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">Sales operations</span>
              <StatusBadge tone="neutral">Not assigned</StatusBadge>
            </li>
          </ul>
          <p className="text-[11px] text-foreground-muted">
            Super Admin configures the CRM. Daily sales work belongs to Manager, Sales Executive,
            and Sales Support roles.
          </p>
        </section>
      </div>
    </div>
  );
}
