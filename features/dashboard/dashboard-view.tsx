"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { StageRibbon, StageRibbonLegend, type RibbonSegment } from "@/components/ui/stage-ribbon";
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Activity, type TargetProgress } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { formatInTimezone } from "@/lib/timezone";
import { canAccessPath } from "@/lib/permissions";
import { formatMoney } from "@/features/analytics/charts";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

const DAY_MS = 86_400_000;

function quarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const from = new Date(now.getFullYear(), q * 3, 1);
  const to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
  return { from: from.toISOString(), to: to.toISOString() };
}

function greetingFor(now: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now),
  );
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function dayKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(value));
}

const OVERDUE_HREF = "/activities?status=overdue";

/** The record an activity belongs to; leads have no detail page, so they open the filtered list. */
function activityHref(a: Activity) {
  if (a.dealId) return `/deals/${a.dealId}`;
  if (a.customerId) return `/customers/${a.customerId}`;
  if (a.leadId && a.leadName) return `/leads?q=${encodeURIComponent(a.leadName)}`;
  return "/calendar";
}
export function DashboardView() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const timezone = user?.timezone || "UTC";
  const isTeamLead = user?.roleCode === "sales_manager";
  const { salesExecutiveId, setSalesExecutiveId } = useTeamMemberFilter(isTeamLead);
  const linkTo = (href: string) =>
    canAccessPath(user?.permissions, href.split("?")[0]) ? href : undefined;

  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);

  const userId = user?.id;
  const activityScope = React.useCallback(
    (p: URLSearchParams) => {
      if (isTeamLead) {
        if (salesExecutiveId !== "all") p.set("salesExecutiveId", salesExecutiveId);
      } else if (userId) {
        p.set("ownerUserId", userId);
      }
      return p;
    },
    [isTeamLead, salesExecutiveId, userId],
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
  const overdueTotal = overdueQuery.data?.total ?? overdue.length;
  const todayKey = dayKey(now, timezone);
  const todayCount = activities.filter(
    (a) => dayKey(a.startAt || a.dueAt || a.createdAt, timezone) === todayKey,
  ).length;
  const nextUp = activities
    .filter((a) => {
      const at = a.startAt || a.dueAt;
      return at != null && new Date(at).getTime() >= now.getTime() && a.displayStatus !== "completed";
    })
    .sort((a, b) => new Date(a.startAt || a.dueAt!).getTime() - new Date(b.startAt || b.dueAt!).getTime())[0];

  const pipelineStages = pipelineQuery.data?.openValueByStage ?? [];
  const segments: RibbonSegment[] = pipelineStages.map((s, i) => ({
    id: s.key || String(s.label),
    label: String(s.label),
    value: Number(s.value) || 0,
    slot: stageSlotFromPipeline({ position: i, openStageCount: pipelineStages.length }),
  }));
  const pipelineTotal = segments.reduce((sum, s) => sum + s.value, 0);

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

  const firstName = user?.fullName?.split(" ")[0];
  const title = isTeamLead
    ? teamMetaQuery.data?.teamName ?? "My Team"
    : `${greetingFor(now, timezone)}${firstName ? `, ${firstName}` : ""}`;
  const dateLine = formatInTimezone(now, timezone, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-8">
      <PageHeader
        display
        breadcrumbs={[{ label: "Workspace" }, { label: "Dashboard" }]}
        title={title}
        description={isTeamLead ? `Team supervision · ${dateLine}` : dateLine}
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

      <section
        aria-labelledby="focus-heading"
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]"
      >
        <div className="min-w-0 space-y-3">
          <h2 id="focus-heading" className="text-section">
            Today’s focus
          </h2>
          {overdueQuery.isLoading || todayQuery.isLoading ? (
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-48 rounded-control" />
              <Skeleton className="h-9 w-40 rounded-control" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overdueTotal > 0 ? (
                <FocusChip tone="warning" href={linkTo(OVERDUE_HREF)}>
                  <strong className="font-semibold tabular-nums">{overdueTotal}</strong>{" "}
                  {overdueTotal === 1 ? "activity is" : "activities are"} overdue
                </FocusChip>
              ) : (
                <FocusChip tone="success">
                  <Check className="size-3.5" aria-hidden />
                  Nothing overdue. Nice.
                </FocusChip>
              )}
              <FocusChip tone="neutral" href={linkTo("/calendar")}>
                <strong className="font-semibold tabular-nums">{todayCount}</strong> scheduled today
                <span className="text-ink-muted">· {activities.length} this week</span>
              </FocusChip>
            </div>
          )}
          {nextUp ? (
            <p className="text-body text-ink-secondary">
              <span className="text-ink-muted">Next up:</span>{" "}
              <span className="font-medium text-ink">{nextUp.title}</span>
              {nextUp.customerName || nextUp.dealTitle || nextUp.leadName
                ? ` with ${nextUp.customerName || nextUp.dealTitle || nextUp.leadName}`
                : ""}{" "}
              <span className="tabular-nums text-ink-muted">
                ·{" "}
                {formatInTimezone(nextUp.startAt || nextUp.dueAt, timezone, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          ) : null}
        </div>

        <TargetPanel
          loading={targetsQuery.isLoading}
          visible={can("targets:view")}
          target={targetsQuery.data?.data?.[0]}
          href={linkTo("/targets")}
        />
      </section>

      {kpiLoading ? (
        <KpiRowSkeleton />
      ) : (
        <section
          aria-label="Key numbers"
          className="grid grid-cols-2 gap-y-5 border-y border-line py-5 xl:grid-cols-4 xl:divide-x xl:divide-line [&>*]:px-0 xl:[&>*]:px-6 xl:[&>*:first-child]:pl-0"
        >
          {isTeamLead ? (
            <>
              <Kpi
                label="Sales executives"
                value={teamMetaQuery.data?.seCount}
                hint="Active on your team"
                href={linkTo("/admin/users")}
              />
              <Kpi
                label="Active leads"
                value={teamMetaQuery.data?.leadTotal}
                hint="In team scope"
                href={linkTo("/leads")}
              />
              <Kpi
                label="Overdue activities"
                value={overdueTotal}
                hint="Needs attention"
                href={linkTo(OVERDUE_HREF)}
              />
              <Kpi
                label="Upcoming (7d)"
                value={activities.length}
                hint="Scheduled"
                href={linkTo("/calendar")}
              />
            </>
          ) : (
            <>
              <Kpi
                label="Open pipeline"
                value={summaryQuery.data?.pipelineValue ?? 0}
                format={(n) => formatMoney(n)}
                hint="This quarter"
                href={linkTo("/deals")}
              />
              <Kpi
                label="Open deals"
                value={pipelineQuery.data?.openDeals ?? summaryQuery.data?.deals}
                hint="In scope"
                href={linkTo("/deals")}
              />
              <Kpi label="Overdue" value={overdueTotal} hint="Activities" href={linkTo(OVERDUE_HREF)} />
              <Kpi
                label="Conversion"
                value={summaryQuery.data?.conversionRate}
                format={(n) => `${n.toFixed(1)}%`}
                hint="Lead → win rate"
                href={linkTo("/analytics")}
              />
            </>
          )}
        </section>
      )}

      <section aria-labelledby="pipeline-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="pipeline-heading" className="text-section">
              Open pipeline by stage
            </h2>
            <p className="text-meta">This quarter · width is each stage’s share of open value</p>
          </div>
          <div className="flex items-end gap-4">
            {pipelineTotal > 0 ? <PipelineTotal value={pipelineTotal} /> : null}
            <SectionLink href={linkTo("/deals")}>View deals</SectionLink>
          </div>
        </div>
        {pipelineQuery.isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading pipeline">
            <Skeleton className="h-3 w-full rounded-[2px]" />
            <div className="flex gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : segments.length === 0 ? (
          <p className="text-body text-ink-muted">
            No open deals this quarter yet. The first one you add will start the ribbon.
          </p>
        ) : (
          <>
            <StageRibbon
              size="lg"
              segments={segments}
              label="Open pipeline by stage"
              formatValue={(v) => formatMoney(v)}
            />
            <StageRibbonLegend segments={segments} formatValue={(v) => formatMoney(v)} />
          </>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <ActivityList
          heading="Your week"
          count={activities.length}
          viewAllHref={linkTo("/calendar")}
          itemHref={(a) => linkTo(activityHref(a))}
          loading={todayQuery.isLoading}
          empty={
            <>
              Nothing scheduled this week.{" "}
              {can("activities:create") ? (
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => setCreateOpen(true)}
                >
                  Book a follow-up
                </button>
              ) : null}
            </>
          }
          items={activities.slice(0, 6)}
          renderMeta={(a) =>
            formatInTimezone(a.startAt || a.dueAt || a.createdAt, timezone, {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          }
        />
        <ActivityList
          heading="Needs attention"
          count={overdueTotal}
          viewAllHref={linkTo(OVERDUE_HREF)}
          itemHref={(a) => linkTo(activityHref(a))}
          loading={overdueQuery.isLoading}
          empty="Nothing overdue. Nice."
          items={overdue}
          renderMeta={(a) => <OverdueChip activity={a} now={now} />}
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

const FOCUS_TONE = {
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-muted text-ink",
} as const;

function FocusChip({
  tone,
  href,
  children,
}: {
  tone: keyof typeof FOCUS_TONE;
  href?: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-body transition-colors duration-150",
    FOCUS_TONE[tone],
    href &&
      "group hover:brightness-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );
  return href ? (
    <Link href={href} className={className}>
      {children}
      <ChevronRight
        aria-hidden
        className="-mr-1 size-3.5 opacity-60 transition-[opacity,translate] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  ) : (
    <p className={className}>{children}</p>
  );
}

function daysOverdue(a: Activity, now: Date) {
  const due = a.dueAt || a.startAt;
  if (!due) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(due).getTime()) / DAY_MS));
}

function OverdueChip({ activity, now }: { activity: Activity; now: Date }) {
  const days = daysOverdue(activity, now);
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-warning-soft px-2 text-caption font-medium tabular-nums text-warning">
      {days == null || days === 0 ? "Due today" : `${days}d overdue`}
    </span>
  );
}

function SectionLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-sm text-caption font-medium text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}

function TargetPanel({
  loading,
  visible,
  target,
  href,
}: {
  loading: boolean;
  visible: boolean;
  target?: TargetProgress;
  href?: string;
}) {
  if (!visible) return null;
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading target">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }
  if (!target) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-section">Target</h2>
          <SectionLink href={href}>Targets</SectionLink>
        </div>
        <p className="text-body text-ink-muted">No active target in scope. Your manager sets these in Targets.</p>
      </div>
    );
  }

  const pct = target.progressPct != null ? Math.min(100, Math.max(0, Math.round(target.progressPct))) : 0;
  const pace = target.periodElapsedPct != null ? Math.min(100, Math.max(0, target.periodElapsedPct)) : null;
  const onPace = pace == null ? null : pct >= pace;

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1 text-section">
          <span className="truncate">{target.target.name}</span>
          {href ? (
            <ArrowRight
              aria-hidden
              className="size-3.5 shrink-0 text-brand opacity-0 transition-[opacity,translate] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:group-hover:translate-x-0"
            />
          ) : null}
        </h2>
        {onPace == null ? null : (
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-caption font-medium",
              onPace ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
            )}
          >
            {onPace ? "On pace" : "Behind pace"}
          </span>
        )}
      </div>
      <Kpi
        label="Achieved"
        size="xl"
        value={target.actual}
        format={(n) => formatMoney(n, "AUD")}
        hint={
          <>
            of <span className="tabular-nums">{formatMoney(target.target.targetValue, "AUD")}</span> ·{" "}
            <span className="tabular-nums">{target.daysRemaining}</span> days left
          </>
        }
      />
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% of target${pace != null ? `, ${Math.round(pace)}% of the period elapsed` : ""}`}
        className="relative h-2 rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700 ease-emphasis"
          style={{ width: `${pct}%` }}
        />
        {pace != null ? (
          <span
            aria-hidden
            title={`${Math.round(pace)}% of the period elapsed`}
            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${pace}%` }}
          />
        ) : null}
      </div>
      <p className="text-meta">
        <span className="tabular-nums">{pct}%</span> done
        {pace != null ? (
          <>
            {" "}
            · marker shows <span className="tabular-nums">{Math.round(pace)}%</span> of the period gone
          </>
        ) : null}
      </p>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="group -m-3 block min-w-0 space-y-3 rounded-lg p-3 transition-colors duration-150 ease-standard hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    <div className="min-w-0 space-y-3">{content}</div>
  );
}

function PipelineTotal({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <p className="text-numeral">
      <span aria-hidden>{formatMoney(shown)}</span>
      <span className="sr-only">{formatMoney(value)} open</span>
    </p>
  );
}

function ActivityList({
  heading,
  count,
  viewAllHref,
  itemHref,
  loading,
  empty,
  items,
  renderMeta,
}: {
  heading: string;
  count: number;
  viewAllHref?: string;
  itemHref?: (a: Activity) => string | undefined;
  loading: boolean;
  empty: React.ReactNode;
  items: Activity[];
  renderMeta: (a: Activity) => React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
        <h2 className="flex items-baseline gap-2 text-section">
          {heading}
          <span className="text-meta font-normal tabular-nums">{loading ? "" : count}</span>
        </h2>
        <SectionLink href={viewAllHref}>View all</SectionLink>
      </div>
      {loading ? (
        <ul className="divide-y divide-line" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-16" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="py-4 text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a, i) => {
            const href = itemHref?.(a);
            const row = (
              <>
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-ink group-hover:text-brand">{a.title}</p>
                  <p className="truncate text-meta">
                    {a.customerName || a.dealTitle || a.leadName || a.typeName || "No linked record"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-meta tabular-nums">
                  {renderMeta(a)}
                  {href ? (
                    <ChevronRight
                      aria-hidden
                      className="size-3.5 text-ink-subtle transition-[color,translate] duration-150 group-hover:translate-x-0.5 group-hover:text-brand motion-reduce:group-hover:translate-x-0"
                    />
                  ) : null}
                </span>
              </>
            );
            return (
              <li
                key={a.id}
                className="animate-rise"
                style={{ "--rise-index": i } as React.CSSProperties}
              >
                {href ? (
                  <Link
                    href={href}
                    className="group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-2.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KpiRowSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading key numbers"
      className="grid grid-cols-2 gap-y-5 border-y border-line py-5 xl:grid-cols-4 xl:divide-x xl:divide-line xl:[&>*]:px-6 xl:[&>*:first-child]:pl-0"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
