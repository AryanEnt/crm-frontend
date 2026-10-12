"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import { cn } from "@/lib/utils";
import { ChartCard, SoftIndigoLineChart } from "@/features/analytics/charts";
import { formatLeadMoney } from "@/features/leads/lead-format";

function defaultFrom() {
  return format(subDays(new Date(), 30), "yyyy-MM-dd");
}

function defaultTo() {
  return format(new Date(), "yyyy-MM-dd");
}

export function OrgAnalyticsAdminView() {
  const { can } = useAuth();
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);
  const [period, setPeriod] = React.useState("day");
  const [teamId, setTeamId] = React.useState("");
  const [pipelineId, setPipelineId] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState("");

  const canView = can("analytics:view");

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ from, to, period });
    if (teamId) p.set("teamId", teamId);
    if (pipelineId) p.set("pipelineId", pipelineId);
    if (ownerUserId) p.set("ownerUserId", ownerUserId);
    return p;
  }, [from, to, period, teamId, pipelineId, ownerUserId]);

  const analyticsQuery = useQuery({
    queryKey: ["org-analytics", params.toString()],
    queryFn: () => adminApi.getOrganizationAnalytics(params),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const insightParams = React.useMemo(() => {
    const p = new URLSearchParams({ from, to, owner: ownerUserId || "all" });
    if (teamId) p.set("teamId", teamId);
    if (pipelineId) p.set("pipelineId", pipelineId);
    return p;
  }, [from, to, teamId, pipelineId, ownerUserId]);

  const overviewQuery = useQuery({
    queryKey: ["lead-insights", "overview", insightParams.toString()],
    queryFn: () => crmApi.leadOverview(insightParams),
    enabled: canView && can("leads:view"),
    placeholderData: keepPreviousData,
  });

  const teamsQuery = useQuery({
    queryKey: ["teams", "org-analytics"],
    queryFn: () =>
      adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: canView,
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "org-analytics"],
    queryFn: () => crmApi.listPipelines("leads", true),
    enabled: canView,
  });

  const usersQuery = useQuery({
    queryKey: ["users", "org-analytics"],
    queryFn: () =>
      adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: canView,
  });

  if (!canView) {
    return (
      <ErrorState
        title="Access denied"
        description="Organization analytics requires analytics:view."
      />
    );
  }

  const data = analyticsQuery.data;
  const metrics = data?.topMetrics;
  const lead = overviewQuery.data;

  const metricCards: Array<{ label: string; value: string }> = metrics
    ? [
        { label: "Active users", value: metrics.activeUsers.toLocaleString() },
        { label: "Teams", value: metrics.totalTeams.toLocaleString() },
        { label: "Leads", value: metrics.totalLeads.toLocaleString() },
        { label: "Open leads", value: lead ? lead.openLeads.toLocaleString() : "—" },
        { label: "Open pipeline value", value: lead ? formatLeadMoney(lead.openValue, lead.currency) : "—" },
        { label: "Won leads (range)", value: lead ? lead.wonLeads.toLocaleString() : "—" },
        { label: "Win rate (range)", value: lead?.winRate != null ? `${lead.winRate.toFixed(1)}%` : "—" },
        { label: "Completed activities", value: metrics.completedActivities.toLocaleString() },
      ]
    : [];

  const toChart = (points: { key: string; label: string; value: number }[] | undefined) =>
    (points ?? []).map((p) => ({ name: p.label || p.key, value: p.value }));

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "Organization Analytics" },
        ]}
        title="Organization Analytics"
        description="Cross-team adoption, lead growth, and pipeline health for the whole CRM."
      />

      <FilterBar
        onClear={() => {
          setFrom(defaultFrom());
          setTo(defaultTo());
          setPeriod("day");
          setTeamId("");
          setPipelineId("");
          setOwnerUserId("");
        }}
      >
        <DatePicker aria-label="From" value={from} max={to} onChange={setFrom} uiSize="md" className="w-[150px]" />
        <DatePicker aria-label="To" value={to} min={from} onChange={setTo} uiSize="md" className="w-[150px]" />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={teamId || "all"}
          onValueChange={(v) => setTeamId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {(teamsQuery.data?.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={pipelineId || "all"}
          onValueChange={(v) => setPipelineId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Pipeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pipelines</SelectItem>
            {(pipelinesQuery.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={ownerUserId || "all"}
          onValueChange={(v) => setOwnerUserId(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {(usersQuery.data?.data ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {analyticsQuery.isLoading ? (
        <LoadingState />
      ) : analyticsQuery.isError && !data ? (
        <ErrorState onRetry={() => void analyticsQuery.refetch()} />
      ) : (
        <div
          aria-busy={analyticsQuery.isFetching || undefined}
          className={cn(
            "space-y-3 transition-opacity duration-150",
            analyticsQuery.isPlaceholderData && "opacity-60",
          )}
        >
          {analyticsQuery.isError ? (
            <ErrorState
              title="Couldn't apply these filters"
              description="Showing the previous results. Try again, or change the filters."
              onRetry={() => void analyticsQuery.refetch()}
            />
          ) : null}

          <p className="text-caption text-ink-muted">
            Totals are current and follow the team, pipeline and owner filters. Charts and
            the summaries below also use the date range.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCards.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Lead growth" empty={!data?.growth.leads?.length}>
              <SoftIndigoLineChart data={toChart(data?.growth.leads)} xKey="name" />
            </ChartCard>
            <ChartCard title="Activities logged" empty={!data?.growth.activities?.length}>
              <SoftIndigoLineChart data={toChart(data?.growth.activities)} xKey="name" />
            </ChartCard>
          </div>

          {data ? (
            <section className="grid gap-3 rounded-lg border border-border bg-surface p-4 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold">User adoption</h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
                  <li>Users with activity: {data.userAdoption.usersWithActivity}</li>
                  <li>
                    No recent activity: {data.userAdoption.usersWithNoRecentActivity}
                  </li>
                  <li>Activities created: {data.userAdoption.activitiesCreated}</li>
                  <li>Activities completed: {data.userAdoption.activitiesCompleted}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Lead outcomes</h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
                  <li>Leads created: {data.conversionOverview.leads}</li>
                  <li>Won: {lead?.wonLeads ?? "—"}</li>
                  <li>Lost: {lead?.lostLeads ?? "—"}</li>
                  <li>Needing attention: {lead?.needingAttention ?? "—"}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Referrals</h3>
                <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
                  <li>Total: {data.referralOverview.total}</li>
                  <li>Active: {data.referralOverview.active}</li>
                  <li>Converted: {data.referralOverview.converted}</li>
                  <li>
                    Pipeline value: {data.referralOverview.pipelineValue.toLocaleString()}
                  </li>
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-dark">{value}</p>
    </div>
  );
}
