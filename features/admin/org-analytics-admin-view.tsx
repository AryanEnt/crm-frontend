"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
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
import { ChartCard, SoftIndigoLineChart } from "@/features/analytics/charts";

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
  });

  const teamsQuery = useQuery({
    queryKey: ["teams", "org-analytics"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: canView,
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "org-analytics"],
    queryFn: () => crmApi.listPipelines(undefined, true),
    enabled: canView,
  });

  const usersQuery = useQuery({
    queryKey: ["users", "org-analytics"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: canView,
  });

  if (!canView) {
    return (
      <ErrorState title="Access denied" description="Organization analytics requires analytics:view." />
    );
  }

  if (analyticsQuery.isLoading) return <LoadingState />;
  if (analyticsQuery.isError) {
    return <ErrorState onRetry={() => void analyticsQuery.refetch()} />;
  }

  const data = analyticsQuery.data;
  const metrics = data?.topMetrics;

  const metricCards = metrics
    ? [
        { label: "Active users", value: metrics.activeUsers },
        { label: "Teams", value: metrics.totalTeams },
        { label: "Leads", value: metrics.totalLeads },
        { label: "Customers", value: metrics.totalCustomers },
        { label: "Open deals", value: metrics.activeDeals },
        { label: "Pipeline value", value: metrics.pipelineValue, format: "currency" as const },
        { label: "Completed activities", value: metrics.completedActivities },
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
        description="Cross-team adoption, growth, and pipeline health for the whole CRM."
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
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
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
        <Select value={teamId || "all"} onValueChange={(v) => setTeamId(v === "all" ? "" : v)}>
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
        <Select value={pipelineId || "all"} onValueChange={(v) => setPipelineId(v === "all" ? "" : v)}>
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
        <Select value={ownerUserId || "all"} onValueChange={(v) => setOwnerUserId(v === "all" ? "" : v)}>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} format={m.format} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Lead growth" empty={!data?.growth.leads?.length}>
          <SoftIndigoLineChart data={toChart(data?.growth.leads)} xKey="name" />
        </ChartCard>
        <ChartCard title="Customer growth" empty={!data?.growth.customers?.length}>
          <SoftIndigoLineChart data={toChart(data?.growth.customers)} xKey="name" />
        </ChartCard>
        <ChartCard title="Deal creation" empty={!data?.growth.deals?.length}>
          <SoftIndigoLineChart data={toChart(data?.growth.deals)} xKey="name" />
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
              <li>No recent activity: {data.userAdoption.usersWithNoRecentActivity}</li>
              <li>Activities created: {data.userAdoption.activitiesCreated}</li>
              <li>Activities completed: {data.userAdoption.activitiesCompleted}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Conversion</h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
              <li>Leads: {data.conversionOverview.leads}</li>
              <li>Qualified: {data.conversionOverview.qualifiedLeads}</li>
              <li>Deals: {data.conversionOverview.deals}</li>
              <li>Rate: {data.conversionOverview.conversionRate}%</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Referrals</h3>
            <ul className="mt-2 space-y-1 text-sm text-foreground-muted">
              <li>Total: {data.referralOverview.total}</li>
              <li>Active: {data.referralOverview.active}</li>
              <li>Converted: {data.referralOverview.converted}</li>
              <li>Pipeline value: {data.referralOverview.pipelineValue.toLocaleString()}</li>
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: "currency";
}) {
  const display =
    format === "currency"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : value.toLocaleString();
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-foreground-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-dark">{display}</p>
    </div>
  );
}
