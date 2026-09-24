"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Timeline } from "@/components/ui/timeline";
import {
  dashboardMetrics,
  dashboardPipeline,
  dashboardTarget,
} from "@/features/dashboard/seed";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { formatInTimezone } from "@/lib/timezone";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

export function DashboardView() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const timezone = user?.timezone || "UTC";
  const isTeamLead = user?.roleCode === "sales_manager";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const todayQuery = useQuery({
    queryKey: ["dashboard-activities", salesExecutiveId],
    queryFn: () => {
      const p = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        limit: "20",
      });
      if (isTeamLead) {
        if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
      } else if (user?.id) {
        p.set("ownerUserId", user.id);
      }
      return crmApi.listActivities(p);
    },
    enabled: !!user?.id,
  });

  const overdueQuery = useQuery({
    queryKey: ["dashboard-overdue", salesExecutiveId],
    queryFn: () => {
      const p = new URLSearchParams({ status: "overdue", limit: "10" });
      if (isTeamLead) {
        if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
      } else if (user?.id) {
        p.set("ownerUserId", user.id);
      }
      return crmApi.listActivities(p);
    },
    enabled: !!user?.id,
  });

  const teamMetaQuery = useQuery({
    queryKey: ["dashboard-team", user?.teamIds?.[0]],
    enabled: isTeamLead && !!user?.teamIds?.[0],
    queryFn: async () => {
      const teamId = user!.teamIds[0];
      const [teams, ses, leads] = await Promise.all([
        adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
        adminApi.listUsers(
          new URLSearchParams({
            limit: "100",
            isActive: "true",
            roleCode: "sales_executive",
            teamId,
          }),
        ),
        crmApi.listLeads(new URLSearchParams({ limit: "1", offset: "0" })),
      ]);
      const team = teams.data.find((t) => t.id === teamId);
      return {
        teamName: team?.name ?? "My Team",
        seCount: ses.data.length,
        leadTotal: leads.total,
      };
    },
  });

  const activities = todayQuery.data?.data ?? [];
  const overdue = overdueQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace" }, { label: "Dashboard" }]}
        title={
          isTeamLead
            ? teamMetaQuery.data?.teamName ?? "My Team"
            : `Good morning${user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`
        }
        description={
          isTeamLead
            ? `Team supervision · ${timezone}`
            : `Pipeline health and follow-ups · ${timezone}`
        }
        actions={
          <div className="flex items-center gap-2">
            {isTeamLead ? (
              <TeamMemberFilterChip value={salesExecutiveId} onChange={setSalesExecutiveId} />
            ) : null}
            {can("activities:create") ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                Activity
              </Button>
            ) : null}
          </div>
        }
      />

      {isTeamLead ? (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Sales Executives"
            value={String(teamMetaQuery.data?.seCount ?? "—")}
            hint="Active on your team"
          />
          <MetricCard
            label="Active Leads"
            value={String(teamMetaQuery.data?.leadTotal ?? "—")}
            hint="In team scope"
          />
          <MetricCard label="Overdue Activities" value={String(overdue.length)} hint="Needs attention" />
          <MetricCard label="Upcoming (7d)" value={String(activities.length)} hint="Scheduled" />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {dashboardMetrics.map((m) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              delta={m.delta}
              hint={m.hint}
              icon={m.icon}
            />
          ))}
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Pipeline overview</h2>
            <StatusBadge tone="brand">This quarter</StatusBadge>
          </div>
          <div className="space-y-2.5">
            {dashboardPipeline.map((stage) => (
              <div
                key={stage.name}
                className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2"
              >
                <span className="truncate text-xs text-foreground-muted">{stage.name}</span>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-brand/80"
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
                <span className="text-right text-xs font-medium tabular-nums text-foreground">
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Target progress</h2>
            <StatusBadge tone="success">{dashboardTarget.percent}%</StatusBadge>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {dashboardTarget.current}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            of {dashboardTarget.goal} quarterly revenue target
          </p>
          <ProgressBar value={dashboardTarget.percent} className="mt-3" />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Your week</h2>
          <ul className="space-y-2">
            {activities.length === 0 ? (
              <li className="text-xs text-foreground-muted">No upcoming activities.</li>
            ) : (
              activities.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{a.title}</span>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    {formatInTimezone(a.startAt || a.dueAt || a.createdAt, timezone, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Needs attention</h2>
          <ul className="space-y-2">
            {overdue.length === 0 ? (
              <li className="text-xs text-foreground-muted">Nothing overdue.</li>
            ) : (
              overdue.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-foreground-muted">
                      {a.customerName || a.dealTitle || a.typeName}
                    </p>
                  </div>
                  <StatusBadge tone="warning">Overdue</StatusBadge>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-3.5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent</h2>
        <Timeline
          items={activities.slice(0, 5).map((a) => ({
            id: a.id,
            title: a.title,
            description: a.customerName || a.dealTitle || undefined,
            timestamp: formatInTimezone(a.createdAt, timezone, {
              month: "short",
              day: "numeric",
            }),
            tone: a.displayStatus === "overdue" ? "warning" : "brand",
          }))}
        />
      </section>

      <ActivityQuickCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void qc.invalidateQueries({ queryKey: ["dashboard-activities"] });
          void qc.invalidateQueries({ queryKey: ["dashboard-overdue"] });
        }}
      />
    </div>
  );
}
