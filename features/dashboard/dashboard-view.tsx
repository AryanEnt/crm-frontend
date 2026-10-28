"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Columns3,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Avatar } from "@/components/ui/console/avatar";
import { useQuickCreateOptional } from "@/components/forms/quick-create-provider";
import { formatLeadMoney } from "@/features/leads/lead-format";
import { LeadMyDaySection, LeadPipelineStrip } from "@/features/dashboard/lead-my-day";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Activity, type LeadOwnerRow, type TargetProgress } from "@/lib/api/crm";
import { adminApi } from "@/lib/api/admin";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { activityHref } from "@/features/activities/activity-href";
import { AddTeamMemberButton } from "@/features/admin/add-team-member-button";
import { DEFAULT_TIMEZONE, formatInTimezone } from "@/lib/timezone";
import { canAccessPath } from "@/lib/permissions";
import { customTargetName, formatAmount, goalFor, whoName } from "@/features/targets/goals";
import { useCountUp } from "@/lib/use-count-up";
import { cn } from "@/lib/utils";
import {
  TeamMemberFilterChip,
  useTeamMemberFilter,
} from "@/features/teams/team-member-filter";

const DAY_MS = 86_400_000;
const OVERDUE_HREF = "/activities?status=overdue";

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

const eventAt = (a: Activity) => a.startAt || a.dueAt || a.createdAt;
const relatedName = (a: Activity) => a.leadName || a.customerName || a.dealTitle || "";

export function DashboardView() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const quickCreate = useQuickCreateOptional();
  const [createOpen, setCreateOpen] = React.useState(false);
  const timezone = user?.timezone || DEFAULT_TIMEZONE;
  const isTeamLead = user?.roleCode === "sales_manager";
  const canAddMember = isTeamLead && (can("users:create") || can("users:manage"));
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

  const weekQuery = useQuery({
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
        seIds: ses.data.map((u) => u.id),
        seCount: ses.data.length,
        leadTotal: leads.total,
      };
    },
  });

  // Team leads see the team (or one member); everyone else sees their own leads.
  const leadOwner = isTeamLead ? (salesExecutiveId !== "all" ? salesExecutiveId : "all") : "me";
  const canViewLeads = can("leads:view");

  const overviewParams = React.useMemo(() => {
    const { from: f, to: t } = quarterRange();
    return new URLSearchParams({ from: f, to: t, owner: leadOwner });
  }, [leadOwner]);

  const overviewQuery = useQuery({
    queryKey: ["lead-insights", "overview", overviewParams.toString()],
    queryFn: () => crmApi.leadOverview(overviewParams),
    enabled: !!user?.id && canViewLeads,
  });

  const myDayQuery = useQuery({
    queryKey: ["lead-insights", "my-day", leadOwner, timezone],
    queryFn: () => crmApi.leadMyDay(new URLSearchParams({ tz: timezone, owner: leadOwner })),
    enabled: !!user?.id && canViewLeads,
  });

  const showTeamPerformance = isTeamLead && can("leads:view");
  const teamPerformanceQuery = useQuery({
    queryKey: ["lead-insights", "owners"],
    queryFn: () => {
      const { from: f, to: t } = quarterRange();
      return crmApi.leadOwners(new URLSearchParams({ from: f, to: t, owner: "all" }));
    },
    enabled: !!user?.id && showTeamPerformance,
  });

  const targetsQuery = useQuery({
    queryKey: ["dashboard-targets"],
    queryFn: () => crmApi.listTargetProgress(new URLSearchParams({ limit: "5", offset: "0" })),
    enabled: !!user?.id && can("targets:view"),
    refetchOnMount: "always",
  });

  const activities = weekQuery.data?.data ?? [];
  const weekTotal = weekQuery.data?.total ?? activities.length;
  const overdue = overdueQuery.data?.data ?? [];
  const overdueTotal = overdueQuery.data?.total ?? overdue.length;
  const todayKey = dayKey(now, timezone);
  const todayCount = activities.filter((a) => dayKey(eventAt(a), timezone) === todayKey).length;
  const nextUp = activities
    .filter((a) => {
      const at = a.startAt || a.dueAt;
      return at != null && new Date(at).getTime() >= now.getTime() && a.displayStatus !== "completed";
    })
    .sort((a, b) => new Date(a.startAt || a.dueAt!).getTime() - new Date(b.startAt || b.dueAt!).getTime())[0];

  const overview = overviewQuery.data;
  const leadCurrency = overview?.currency ?? "AUD";

  const kpiLoading =
    (isTeamLead && teamMetaQuery.isLoading) || (canViewLeads && overviewQuery.isLoading) || overdueQuery.isLoading;

  if (weekQuery.isError && overdueQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void weekQuery.refetch();
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
  const showTargets = can("targets:view");
  const canCreateActivity = can("activities:create");

  const quickActionCandidates: Array<QuickAction | null> = [
    can("leads:create") && quickCreate
      ? { label: "New lead", hint: "Capture an enquiry", icon: UserPlus, tone: "brand", onClick: () => quickCreate.openCreate("lead") }
      : null,
    linkTo("/pipeline")
      ? { label: "Pipeline", hint: "Move leads forward", icon: Columns3, tone: "info", href: "/pipeline" }
      : null,
    canCreateActivity
      ? { label: "Log activity", hint: "Call, meeting, task", icon: ListChecks, tone: "success", onClick: () => setCreateOpen(true) }
      : null,
    linkTo("/calendar")
      ? { label: "Calendar", hint: "See your schedule", icon: CalendarDays, tone: "neutral", href: "/calendar" }
      : null,
  ];
  const quickActions = quickActionCandidates.filter((a): a is QuickAction => a !== null);

  const selectedMember =
    isTeamLead && salesExecutiveId !== "all"
      ? teamPerformanceQuery.data?.rows.find((r) => r.ownerUserId === salesExecutiveId)?.ownerName ?? undefined
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        display
        breadcrumbs={[{ label: "Workspace" }, { label: "Dashboard" }]}
        title={title}
        description={isTeamLead ? `Team overview · ${dateLine}` : dateLine}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isTeamLead ? (
              <TeamMemberFilterChip value={salesExecutiveId} onChange={setSalesExecutiveId} />
            ) : null}
            {canAddMember ? <AddTeamMemberButton teamName={teamMetaQuery.data?.teamName} /> : null}
            {canCreateActivity ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                Activity
              </Button>
            ) : null}
          </div>
        }
      />

      {selectedMember ? (
        <div className="flex items-center gap-2 rounded-card border border-brand-border bg-brand-soft px-3 py-2 text-body text-brand-ink">
          <Avatar name={selectedMember} size="sm" />
          <span>
            Showing <strong className="font-semibold">{selectedMember}</strong>’s numbers
          </span>
          <button
            type="button"
            onClick={() => setSalesExecutiveId("all")}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-medium hover:bg-surface/60"
          >
            <X className="size-3.5" />
            Whole team
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <FocusCard
          className={showTargets || quickActions.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}
          loading={overdueQuery.isLoading || weekQuery.isLoading}
          overdueTotal={overdueTotal}
          todayCount={todayCount}
          weekTotal={weekTotal}
          nextUp={nextUp}
          timezone={timezone}
          team={isTeamLead}
          overdueHref={linkTo(OVERDUE_HREF)}
          calendarHref={linkTo("/calendar")}
          nextUpHref={nextUp ? linkTo(activityHref(nextUp)) : undefined}
        />
        {showTargets ? (
          <TargetCard
            loading={targetsQuery.isLoading}
            target={targetsQuery.data?.data?.[0]}
            href={linkTo("/targets")}
          />
        ) : (
          <QuickActionsCard actions={quickActions} />
        )}
      </section>

      <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : isTeamLead ? (
          <>
            <StatCard
              label="Sales executives"
              value={teamMetaQuery.data?.seCount}
              hint="Active on your team"
              icon={Users}
              tone="brand"
              href={linkTo("/admin/users")}
            />
            <StatCard
              label="Open leads"
              value={overview?.openLeads ?? teamMetaQuery.data?.leadTotal}
              hint={overview ? `${formatLeadMoney(overview.openValue, leadCurrency)} open value` : "In team scope"}
              icon={Target}
              tone="info"
              href={linkTo("/leads")}
            />
            <StatCard
              label="Overdue activities"
              value={overdueTotal}
              hint={overdueTotal > 0 ? "Needs attention" : "All clear"}
              icon={AlarmClock}
              tone={overdueTotal > 0 ? "warning" : "success"}
              href={linkTo(OVERDUE_HREF)}
            />
            <StatCard
              label="Upcoming (7 days)"
              value={weekTotal}
              hint="Scheduled activities"
              icon={CalendarClock}
              tone="neutral"
              href={linkTo("/calendar")}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Open pipeline"
              value={overview?.openValue ?? 0}
              format={(n) => formatLeadMoney(n, leadCurrency)}
              hint={overview ? `${formatLeadMoney(overview.weightedValue, leadCurrency)} weighted` : "Open lead value"}
              icon={Wallet}
              tone="brand"
              href={linkTo("/pipeline")}
            />
            <StatCard
              label="Open leads"
              value={overview?.openLeads}
              hint={overview ? `${overview.noNextActivity} without a next action` : "In progress"}
              icon={Target}
              tone="info"
              href={linkTo("/leads")}
            />
            <StatCard
              label="Overdue"
              value={overdueTotal}
              hint={overdueTotal > 0 ? "Activities to clear" : "All clear"}
              icon={AlarmClock}
              tone={overdueTotal > 0 ? "warning" : "success"}
              href={linkTo(OVERDUE_HREF)}
            />
            <StatCard
              label="Win rate"
              value={overview?.winRate}
              format={(n) => `${n.toFixed(1)}%`}
              hint={
                overview
                  ? `${overview.wonLeads} won · ${overview.lostLeads} lost this quarter`
                  : "Won ÷ (won + lost)"
              }
              icon={TrendingUp}
              tone="success"
              href={linkTo("/analytics")}
            />
          </>
        )}
      </section>

      {canViewLeads ? (
        <div className="space-y-3">
          <CardHeader
            title={isTeamLead ? "Team’s day" : "My day"}
            subtitle="Leads that need you, from overdue follow-ups to fresh enquiries"
            action={<SectionLink href={linkTo("/leads")}>All leads</SectionLink>}
          />
          {myDayQuery.isError ? (
            <ErrorState onRetry={() => void myDayQuery.refetch()} />
          ) : (
            <LeadMyDaySection data={myDayQuery.data} loading={myDayQuery.isLoading} showOwner={isTeamLead} />
          )}
        </div>
      ) : null}

      {showTeamPerformance ? (
        <TeamPerformanceCard
          loading={teamPerformanceQuery.isLoading}
          rows={teamPerformanceQuery.data?.rows ?? []}
          currency={teamPerformanceQuery.data?.currency ?? leadCurrency}
          memberIds={teamMetaQuery.data?.seIds ?? []}
          selectedId={salesExecutiveId}
          onSelect={(id) => setSalesExecutiveId(id === salesExecutiveId ? "all" : id)}
          analyticsHref={linkTo("/analytics")}
        />
      ) : null}

      <section className={cn("grid gap-4", showTargets && quickActions.length > 0 && "lg:grid-cols-3")}>
        <DashCard className={cn("p-5", showTargets && quickActions.length > 0 && "lg:col-span-2")}>
          <CardHeader
            title="Lead pipeline"
            subtitle={
              overview?.pipeline
                ? `${overview.pipeline.name} · open leads by stage`
                : "Open leads by stage"
            }
            action={<SectionLink href={linkTo("/pipeline")}>Open pipeline</SectionLink>}
            aside={overview && overview.openValue > 0 ? <PipelineTotal value={overview.openValue} currency={leadCurrency} /> : null}
          />
          <div className="mt-5">
            <LeadPipelineStrip overview={overview} loading={canViewLeads && overviewQuery.isLoading} />
          </div>
        </DashCard>
        {showTargets && quickActions.length > 0 ? <QuickActionsCard actions={quickActions} /> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ActivityListCard
          heading={isTeamLead ? "Team’s week" : "Your week"}
          icon={CalendarDays}
          count={weekTotal}
          viewAllHref={linkTo("/calendar")}
          itemHref={(a) => linkTo(activityHref(a))}
          loading={weekQuery.isLoading}
          timezone={timezone}
          variant="upcoming"
          showOwner={isTeamLead}
          empty={
            <>
              Nothing scheduled this week.
              {canCreateActivity ? (
                <button
                  type="button"
                  className="mt-2 block font-medium text-brand hover:underline"
                  onClick={() => setCreateOpen(true)}
                >
                  Book a follow-up
                </button>
              ) : null}
            </>
          }
          items={activities.slice(0, 6)}
          now={now}
        />
        <ActivityListCard
          heading="Needs attention"
          icon={AlarmClock}
          count={overdueTotal}
          viewAllHref={linkTo(OVERDUE_HREF)}
          itemHref={(a) => linkTo(activityHref(a))}
          loading={overdueQuery.isLoading}
          timezone={timezone}
          variant="overdue"
          showOwner={isTeamLead}
          empty="Nothing overdue. Nice work."
          items={overdue.slice(0, 6)}
          now={now}
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

type Tone = "brand" | "info" | "warning" | "success" | "neutral";

const TONE_ICON: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-muted text-ink-secondary",
};

const CARD_BASE = "rounded-card border border-line bg-surface shadow-xs";
const CARD_INTERACTIVE =
  "group transition-[border-color,box-shadow,translate] duration-200 ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0";

function DashCard({
  href,
  onClick,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  href?: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cn(CARD_BASE, CARD_INTERACTIVE, "block", className)}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        className={cn(CARD_BASE, CARD_INTERACTIVE, "block w-full text-left", className)}
      >
        {children}
      </button>
    );
  }
  return <div className={cn(CARD_BASE, className)}>{children}</div>;
}

function CardHeader({
  title,
  subtitle,
  icon: Icon,
  count,
  action,
  aside,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  count?: number;
  action?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-secondary">
            <Icon className="size-3.5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-section">
            {title}
            {count != null ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-muted px-1.5 text-caption font-medium tabular-nums text-ink-secondary">
                {count}
              </span>
            ) : null}
          </h2>
          {subtitle ? <p className="mt-0.5 text-meta">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-end gap-4">
        {aside}
        {action}
      </div>
    </div>
  );
}

function SectionLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className="group/link inline-flex items-center gap-1 rounded-sm text-caption font-medium text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5 motion-reduce:group-hover/link:translate-x-0"
      />
    </Link>
  );
}

function EmptyHint({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="text-body text-ink-muted">{children}</div>
    </div>
  );
}

function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const shown = useCountUp(value);
  return <>{format(shown)}</>;
}

function FocusCard({
  className,
  loading,
  overdueTotal,
  todayCount,
  weekTotal,
  nextUp,
  timezone,
  team,
  overdueHref,
  calendarHref,
  nextUpHref,
}: {
  className?: string;
  loading: boolean;
  overdueTotal: number;
  todayCount: number;
  weekTotal: number;
  nextUp?: Activity;
  timezone: string;
  team: boolean;
  overdueHref?: string;
  calendarHref?: string;
  nextUpHref?: string;
}) {
  const headline =
    overdueTotal > 0
      ? `${overdueTotal} ${overdueTotal === 1 ? "activity needs" : "activities need"} clearing first`
      : todayCount > 0
        ? `${todayCount} ${todayCount === 1 ? "thing" : "things"} on ${team ? "the team’s" : "your"} plan today`
        : "A clear day. Plan ahead.";

  return (
    <div
      className={cn(
        CARD_BASE,
        "relative overflow-hidden border-brand-border bg-gradient-to-br from-brand-soft via-surface to-surface p-5",
        className,
      )}
    >
      <Sparkles aria-hidden className="pointer-events-none absolute -right-3 -top-3 size-24 text-brand/10" />
      <p className="text-overline text-brand">Today’s focus</p>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-72" />
      ) : (
        <h2 className="mt-1 text-[1.125rem] font-semibold tracking-tight text-ink">{headline}</h2>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <FocusTile
          label="Overdue"
          value={overdueTotal}
          loading={loading}
          tone={overdueTotal > 0 ? "warning" : "success"}
          icon={overdueTotal > 0 ? AlarmClock : Check}
          href={overdueHref}
        />
        <FocusTile label="Today" value={todayCount} loading={loading} tone="brand" icon={Clock3} href={calendarHref} />
        <FocusTile label="Next 7 days" value={weekTotal} loading={loading} tone="info" icon={CalendarDays} href={calendarHref} />
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-12 w-full rounded-lg" />
      ) : nextUp ? (
        <NextUpRow activity={nextUp} timezone={timezone} href={nextUpHref} />
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-surface/70 px-3 py-3 text-body text-ink-muted">
          Nothing else coming up. Book a follow-up to keep leads moving.
        </p>
      )}
    </div>
  );
}

function FocusTile({
  label,
  value,
  loading,
  tone,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone: Tone;
  icon: LucideIcon;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-label">{label}</span>
        <span className={cn("flex size-6 items-center justify-center rounded-md", TONE_ICON[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-1.5 text-numeral">{loading ? <Skeleton className="h-7 w-10" /> : <CountUp value={value} />}</p>
    </>
  );
  const className = "block rounded-lg border border-line bg-surface/90 p-3 backdrop-blur-sm";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function NextUpRow({ activity, timezone, href }: { activity: Activity; timezone: string; href?: string }) {
  const related = relatedName(activity);
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground">
        <CalendarClock className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-medium text-ink-muted">Next up</span>
        <span className="block truncate text-body font-medium text-ink">
          {activity.title}
          {related ? <span className="font-normal text-ink-secondary"> · {related}</span> : null}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-caption font-medium tabular-nums text-ink-secondary">
        {formatInTimezone(activity.startAt || activity.dueAt, timezone, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
      {href ? <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle transition-transform group-hover/next:translate-x-0.5" /> : null}
    </>
  );
  const className = "mt-4 flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "group/next transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function StatCard({
  label,
  value,
  format,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number | null | undefined;
  format?: (n: number) => string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
}) {
  const known = value != null && Number.isFinite(value);
  return (
    <DashCard href={href} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", TONE_ICON[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="size-4 text-ink-subtle transition-[color,translate] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
          />
        ) : null}
      </div>
      <p className="mt-3 text-label">{label}</p>
      <p className="mt-0.5 truncate text-numeral">{known ? <CountUp value={value} format={format} /> : "—"}</p>
      <p className="mt-1 text-meta">{hint}</p>
    </DashCard>
  );
}

function StatCardSkeleton() {
  return (
    <div className={cn(CARD_BASE, "space-y-3 p-4")} aria-busy="true">
      <Skeleton className="size-9 rounded-lg" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function TargetCard({ loading, target, href }: { loading: boolean; target?: TargetProgress; href?: string }) {
  if (loading) {
    return (
      <div className={cn(CARD_BASE, "space-y-3 p-5")} aria-busy="true" aria-label="Loading target">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }
  if (!target) {
    return (
      <DashCard href={href} className="flex flex-col p-5">
        <CardHeader title="Target" icon={Target} />
        <div className="mt-4 flex-1">
          <EmptyHint icon={Target}>No active target in scope. Your manager sets these in Targets.</EmptyHint>
        </div>
      </DashCard>
    );
  }

  const pct = target.progressPct != null ? Math.min(100, Math.max(0, Math.round(target.progressPct))) : 0;
  const pace = target.periodElapsedPct != null ? Math.min(100, Math.max(0, target.periodElapsedPct)) : null;
  const onPace = pace == null ? null : pct >= pace;
  const goal = goalFor(target.target.metric);
  const formatTargetValue = (n: number) => formatAmount(goal, n);
  const title = customTargetName(target.target) || `${goal.label} · ${whoName(target.target)}`;

  return (
    <DashCard href={href} className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Target className="size-3.5" aria-hidden />
          </span>
          <h2 className="truncate text-section">{title}</h2>
        </div>
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

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label">Achieved</p>
          <p className="truncate text-numeral-xl">
            <CountUp value={target.actual} format={formatTargetValue} />
          </p>
        </div>
        <p className="shrink-0 text-[1.5rem] font-semibold tabular-nums text-brand">{pct}%</p>
      </div>
      <p className="text-meta">
        of <span className="tabular-nums">{formatAmount(goal, target.target.targetValue, true)}</span> ·{" "}
        <span className="tabular-nums">{target.daysRemaining}</span> days left
      </p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% of target${pace != null ? `, ${Math.round(pace)}% of the period elapsed` : ""}`}
        className="relative mt-4 h-2.5 rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-[width] duration-700 ease-emphasis"
          style={{ width: `${pct}%` }}
        />
        {pace != null ? (
          <span
            aria-hidden
            title={`${Math.round(pace)}% of the period elapsed`}
            className="absolute -top-1 h-4.5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${pace}%` }}
          />
        ) : null}
      </div>
      {pace != null ? (
        <p className="mt-2 text-caption text-ink-muted">
          Marker shows <span className="tabular-nums">{Math.round(pace)}%</span> of the period gone
        </p>
      ) : null}
    </DashCard>
  );
}

type QuickAction = {
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
  onClick?: () => void;
};

function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className={cn(CARD_BASE, "p-5")}>
      <CardHeader title="Quick actions" subtitle="Jump straight in" />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon;
          const body = (
            <>
              <span className={cn("flex size-8 items-center justify-center rounded-lg", TONE_ICON[action.tone])}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="mt-2 block text-body font-medium text-ink">{action.label}</span>
              <span className="block truncate text-caption text-ink-muted">{action.hint}</span>
            </>
          );
          const className =
            "block rounded-lg border border-line bg-surface p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 hover:border-brand-border hover:bg-brand-soft/40 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
          return action.href ? (
            <Link key={action.label} href={action.href} className={className}>
              {body}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick} className={className}>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamPerformanceCard({
  loading,
  rows,
  currency,
  memberIds,
  selectedId,
  onSelect,
  analyticsHref,
}: {
  loading: boolean;
  rows: LeadOwnerRow[];
  currency: string;
  memberIds: string[];
  selectedId: string;
  onSelect: (id: string) => void;
  analyticsHref?: string;
}) {
  const members = new Set(memberIds);
  const shown = rows.slice(0, 6);
  const maxValue = Math.max(1, ...shown.map((r) => r.openValue));

  return (
    <div className={cn(CARD_BASE, "p-5")}>
      <CardHeader
        title="Team performance"
        subtitle="This quarter · click a member to focus the dashboard on them"
        icon={Users}
        action={<SectionLink href={analyticsHref}>Analytics</SectionLink>}
      />
      {loading ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-lg" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-4">
          <EmptyHint icon={Users}>No team activity recorded this quarter yet.</EmptyHint>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((row, i) => {
            const id = row.ownerUserId ?? "";
            const selectable = members.has(id);
            const selected = selectedId === id;
            const body = (
              <>
                <div className="flex items-center gap-2.5">
                  <Avatar name={row.ownerName || "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-ink">{row.ownerName || "Unassigned"}</p>
                    <p className="text-caption tabular-nums text-ink-muted">
                      {row.openLeads} open · {row.wonLeads} won · {row.activities} activities
                    </p>
                  </div>
                  {i === 0 && row.openValue > 0 ? (
                    <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                      Top
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between text-caption">
                  <span className="font-semibold tabular-nums text-ink">{formatLeadMoney(row.openValue, currency)}</span>
                  <span className="tabular-nums text-ink-muted">
                    {row.winRate == null ? "No closed leads" : `${row.winRate.toFixed(1)}% win rate`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-700 ease-emphasis"
                    style={{ width: `${(row.openValue / maxValue) * 100}%` }}
                  />
                </div>
              </>
            );
            const className = cn(
              "block w-full rounded-lg border p-3 text-left",
              selected ? "border-brand bg-brand-soft/50 ring-1 ring-brand/30" : "border-line bg-surface",
            );
            return (
              <li key={id || i}>
                {selectable ? (
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(id)}
                    className={cn(
                      className,
                      "transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PipelineTotal({ value, currency }: { value: number; currency: string }) {
  return (
    <div className="text-right">
      <p className="text-label">Total open</p>
      <p className="text-numeral">
        <CountUp value={value} format={(n) => formatLeadMoney(n, currency)} />
      </p>
    </div>
  );
}

function daysOverdue(a: Activity, now: Date) {
  const due = a.dueAt || a.startAt;
  if (!due) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(due).getTime()) / DAY_MS));
}

function ActivityListCard({
  heading,
  icon,
  count,
  viewAllHref,
  itemHref,
  loading,
  empty,
  items,
  timezone,
  variant,
  showOwner,
  now,
}: {
  heading: string;
  icon: LucideIcon;
  count: number;
  viewAllHref?: string;
  itemHref?: (a: Activity) => string | undefined;
  loading: boolean;
  empty: React.ReactNode;
  items: Activity[];
  timezone: string;
  variant: "upcoming" | "overdue";
  showOwner: boolean;
  now: Date;
}) {
  return (
    <div className={cn(CARD_BASE, "flex flex-col p-5")}>
      <CardHeader
        title={heading}
        icon={icon}
        count={loading ? undefined : count}
        action={<SectionLink href={viewAllHref}>View all</SectionLink>}
      />
      <div className="mt-3 flex-1">
        {loading ? (
          <ul className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyHint icon={variant === "overdue" ? Check : CalendarDays}>{empty}</EmptyHint>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {items.map((a, i) => {
              const href = itemHref?.(a);
              const at = new Date(eventAt(a));
              const days = daysOverdue(a, now);
              const sub = [relatedName(a) || a.typeName || "No linked record", showOwner ? a.ownerName : null]
                .filter(Boolean)
                .join(" · ");
              const row = (
                <>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border leading-none",
                      variant === "overdue"
                        ? "border-warning-border bg-warning-soft text-warning"
                        : "border-line bg-surface-muted text-ink",
                    )}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">
                      {formatInTimezone(at, timezone, { weekday: "short" })}
                    </span>
                    <span className="mt-0.5 text-[15px] font-semibold tabular-nums">
                      {formatInTimezone(at, timezone, { day: "numeric" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink group-hover/row:text-brand">
                      {a.title}
                    </span>
                    <span className="block truncate text-meta">{sub}</span>
                  </span>
                  {variant === "overdue" ? (
                    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-warning-soft px-2 text-caption font-medium tabular-nums text-warning">
                      {days == null || days === 0 ? "Due today" : `${days}d overdue`}
                    </span>
                  ) : (
                    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-surface-muted px-2 text-caption font-medium tabular-nums text-ink-secondary">
                      {formatInTimezone(at, timezone, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  {href ? (
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-ink-subtle transition-[color,translate] duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-brand motion-reduce:group-hover/row:translate-x-0"
                    />
                  ) : null}
                </>
              );
              return (
                <li key={a.id} className="animate-rise" style={{ "--rise-index": i } as React.CSSProperties}>
                  {href ? (
                    <Link
                      href={href}
                      className="group/row flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
