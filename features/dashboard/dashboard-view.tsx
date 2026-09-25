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
import { KpiStripSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { formatInTimezone } from "@/lib/timezone";
import { formatMoney } from "@/features/analytics/charts";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

function quarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), q * 3, 1);
  const to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  return { from: from.toISOString(), to: to.toISOString() };
}

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

  const activityScope = React.useCallback(
    (p: URLSearchParams) => {
      if (isTeamLead) {
        if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
      } else if (user?.id) {
        p.set("ownerUserId", user.id);
      }
      return p;
    },
    [isTeamLead, salesExecutiveId, user?.id],
  );

  const todayQuery = useQuery({
    queryKey: ["dashboard-activities", salesExecutiveId],
    queryFn: () => {
      const p = activityScope(
        new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: "20",
        }),
      );
      return crmApi.listActivities(p);
    },
    enabled: !!user?.id,
  });

  const overdueQuery = useQuery({
    queryKey: ["dashboard-overdue", salesExecutiveId],
    queryFn: () => {
      const p = activityScope(new URLSearchParams({ status: "overdue", limit: "10" }));
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

  const analyticsParams = React.useMemo(() => {
    const { from: f, to: t } = quarterRange();
    const p = new URLSearchParams({ from: f, to: t });
    if (isTeamLead && salesExecutiveId !== "all") {
      p.set("salesExecutiveId", salesExecutiveId);
    }
    return p;
  }, [isTeamLead, salesExecutiveId]);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", analyticsParams.toString()],
    queryFn: () => crmApi.analyticsSummary(analyticsParams),
    enabled: !!user?.id && !isTeamLead,
  });

  const pipelineQuery = useQuery({
    queryKey: ["dashboard-pipeline", analyticsParams.toString()],
    queryFn: () => crmApi.analyticsPipeline(analyticsParams),
    enabled: !!user?.id,
  });

  const targetsQuery = useQuery({
    queryKey: ["dashboard-targets"],
    queryFn: () => crmApi.listTargetProgress(new URLSearchParams({ limit: "5", offset: "0" })),
    enabled: !!user?.id && can("targets:view"),
  });

  const activities = todayQuery.data?.data ?? [];
  const overdue = overdueQuery.data?.data ?? [];
  const pipelineStages = pipelineQuery.data?.openValueByStage ?? [];
  const maxStageValue = Math.max(1, ...pipelineStages.map((s) => Number(s.value) || 0));
  const activeTarget = targetsQuery.data?.data?.[0];
  const targetPct = activeTarget?.progressPct != null
    ? Math.min(100, Math.round(activeTarget.progressPct))
    : 0;

  const kpiLoading =
    (isTeamLead && teamMetaQuery.isLoading) ||
    (!isTeamLead && summaryQuery.isLoading) ||
    overdueQuery.isLoading;

  if (todayQuery.isError && overdueQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void todayQuery.refetch();
          void overdueQuery.refetch();
        }}
      />
    );
  }

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

      {kpiLoading ? (
        <KpiStripSkeleton count={4} />
      ) : isTeamLead ? (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Sales executives"
            value={String(teamMetaQuery.data?.seCount ?? "—")}
            hint="Active on your team"
          />
          <MetricCard
            label="Active leads"
            value={String(teamMetaQuery.data?.leadTotal ?? "—")}
            hint="In team scope"
          />
          <MetricCard
            label="Overdue activities"
            value={String(overdue.length)}
            hint="Needs attention"
          />
          <MetricCard
            label="Upcoming (7d)"
            value={String(activities.length)}
            hint="Scheduled"
          />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Open pipeline"
            value={formatMoney(summaryQuery.data?.pipelineValue ?? 0)}
            hint="This quarter"
          />
          <MetricCard
            label="Open deals"
            value={String(pipelineQuery.data?.openDeals ?? summaryQuery.data?.deals ?? "—")}
            hint="In scope"
          />
          <MetricCard
            label="Overdue"
            value={String(overdue.length)}
            hint="Activities"
          />
          <MetricCard
            label="Conversion"
            value={
              summaryQuery.data
                ? `${summaryQuery.data.conversionRate.toFixed(1)}%`
                : "—"
            }
            hint="Lead → win rate"
          />
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-surface p-3.5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-section">Pipeline overview</h2>
            <StatusBadge tone="brand">This quarter</StatusBadge>
          </div>
          {pipelineQuery.isLoading ? (
            <KpiStripSkeleton count={1} className="grid-cols-1" />
          ) : pipelineStages.length === 0 ? (
            <p className="text-meta">No open pipeline value for this period.</p>
          ) : (
            <div className="space-y-2.5">
              {pipelineStages.map((stage) => {
                const value = Number(stage.value) || 0;
                const pct = Math.round((value / maxStageValue) * 100);
                return (
                  <div
                    key={String(stage.label)}
                    className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-2"
                  >
                    <span className="truncate text-meta">{stage.label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-right text-data text-xs text-foreground">
                      {formatMoney(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-section">Target progress</h2>
            {activeTarget ? (
              <StatusBadge tone="success">{targetPct}%</StatusBadge>
            ) : null}
          </div>
          {activeTarget ? (
            <>
              <p className="text-kpi">
                {formatMoney(activeTarget.actual, "AUD")}
              </p>
              <p className="mt-0.5 text-meta">
                of {formatMoney(activeTarget.target.targetValue, "AUD")} ·{" "}
                {activeTarget.target.name}
              </p>
              <ProgressBar value={targetPct} className="mt-3" />
            </>
          ) : (
            <p className="text-meta">No active target in scope.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3.5">
          <h2 className="mb-2 text-section">Your week</h2>
          <ul className="space-y-2">
            {activities.length === 0 ? (
              <li className="text-meta">No upcoming activities.</li>
            ) : (
              activities.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{a.title}</span>
                  <span className="shrink-0 text-meta">
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

        <div className="rounded-lg border border-border bg-surface p-3.5">
          <h2 className="mb-2 text-section">Needs attention</h2>
          <ul className="space-y-2">
            {overdue.length === 0 ? (
              <li className="text-meta">Nothing overdue.</li>
            ) : (
              overdue.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-meta">
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

      <section className="rounded-lg border border-border bg-surface p-3.5">
        <h2 className="mb-3 text-section">Recent</h2>
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
