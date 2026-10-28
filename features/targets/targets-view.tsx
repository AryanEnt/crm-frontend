"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { dataScopeFor } from "@/features/auth/list-scope";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type CrmTarget, type TargetProgress } from "@/lib/api/crm";
import { canAccessPath } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_GOALS,
  activitiesHrefFor,
  customTargetName,
  formatAmount,
  GOALS,
  MORE_GOALS,
  goalFor,
  whoName,
  type Goal,
} from "@/features/targets/goals";

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

const utcDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

function periodLabel(t: Pick<CrmTarget, "periodType" | "periodStart">) {
  const start = utcDate(t.periodStart);
  if (t.periodType === "daily") return dayFmt.format(start);
  if (t.periodType === "quarterly") return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`;
  return monthFmt.format(start);
}

function dateRange(start: string, end: string) {
  if (start === end) return dayFmt.format(utcDate(start));
  return `${dayFmt.format(utcDate(start))} – ${dayFmt.format(utcDate(end))}`;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthBounds(y: number, m: number): { start: string; end: string } {
  return {
    start: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10),
  };
}

function quarterBounds(y: number, q: number): { start: string; end: string } {
  return {
    start: new Date(Date.UTC(y, (q - 1) * 3, 1)).toISOString().slice(0, 10),
    end: new Date(Date.UTC(y, (q - 1) * 3 + 3, 0)).toISOString().slice(0, 10),
  };
}

function dayBounds(y: number, m: number, d: number): { start: string; end: string } {
  const date = ymd(y, m, d);
  return { start: date, end: date };
}

type PeriodOption = { value: string; label: string; periodType: "daily" | "monthly" | "quarterly"; start: string; end: string };

function periodOptions(now: Date): PeriodOption[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = (value: string, prefix: string, offset: number): PeriodOption => {
    const at = new Date(y, m, d + offset);
    return {
      value,
      label: `${prefix} (${dayFmt.format(new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())))})`,
      periodType: "daily",
      ...dayBounds(at.getFullYear(), at.getMonth(), at.getDate()),
    };
  };
  const month = (value: string, prefix: string, offset: number): PeriodOption => {
    const at = new Date(Date.UTC(y, m + offset, 1));
    return {
      value,
      label: `${prefix} (${monthFmt.format(at)})`,
      periodType: "monthly",
      ...monthBounds(at.getUTCFullYear(), at.getUTCMonth()),
    };
  };
  const quarter = (value: string, prefix: string, offset: number): PeriodOption => {
    const idx = Math.floor(m / 3) + offset;
    const qy = y + Math.floor(idx / 4);
    const q = (((idx % 4) + 4) % 4) + 1;
    return { value, label: `${prefix} (Q${q} ${qy})`, periodType: "quarterly", ...quarterBounds(qy, q) };
  };
  return [
    day("today", "Today", 0),
    day("tomorrow", "Tomorrow", 1),
    month("this-month", "This month", 0),
    month("next-month", "Next month", 1),
    quarter("this-quarter", "This quarter", 0),
    quarter("next-quarter", "Next quarter", 1),
  ];
}

function countedBy(scopeType: string, name: string) {
  if (scopeType === "team") return `by anyone in ${name}`;
  if (scopeType === "user") return `by ${name}`;
  return "across the whole company";
}

/** "Counts new leads added by anyone in Sales A, 1 Oct – 31 Oct." */
function explain(goal: Goal, scopeType: string, name: string, start: string, end: string) {
  if (goal.code === "pipeline_value") return `Shows ${goal.counts} ${countedBy(scopeType, name)}.`;
  return `Counts ${goal.counts} ${countedBy(scopeType, name)}, ${dateRange(start, end)}.`;
}

export function TargetsView() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const canManage = can("targets:manage");
  const teamScopedManager = canManage && dataScopeFor(user, "targets:manage") === "team";
  const orgWideView = dataScopeFor(user, "targets:view") === "organization";
  const teammatesQuery = useQuery({
    queryKey: ["users", "targets", "teammates"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100" })),
    enabled: teamScopedManager,
  });
  const teammateIds = new Set((teammatesQuery.data?.data ?? []).map((u) => u.id));
  const canManageTarget = (t: CrmTarget) => {
    if (!teamScopedManager) return canManage;
    if (t.scopeType === "team") return !!t.teamId && (user?.teamIds ?? []).includes(t.teamId);
    if (t.scopeType === "user") return !!t.userId && (t.userId === user?.id || teammateIds.has(t.userId));
    return false;
  };
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createKey, setCreateKey] = React.useState(0);
  const [show, setShow] = React.useState("all");

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (show !== "all") p.set("scopeType", show);
    return p;
  }, [show]);

  const progressQuery = useQuery({
    queryKey: ["targets-progress", params.toString()],
    queryFn: () => crmApi.listTargetProgress(params),
    refetchOnMount: "always",
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["targets-progress"] });
    void qc.invalidateQueries({ queryKey: ["targets"] });
    void qc.invalidateQueries({ queryKey: ["dashboard-targets"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteTarget(id),
    onSuccess: () => {
      invalidate();
      toast.success("Target deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Could not delete target"),
  });

  const openCreate = () => {
    setCreateKey((k) => k + 1);
    setCreateOpen(true);
  };

  if (progressQuery.isError) {
    return <ErrorState onRetry={() => void progressQuery.refetch()} />;
  }

  const rows = progressQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Targets" }]}
        title="Targets"
        description="Set a goal for your team or one person. Progress updates on its own from the CRM."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              Set a target
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-foreground-muted">Show</Label>
        <Select value={show} onValueChange={setShow}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All targets</SelectItem>
            {orgWideView ? <SelectItem value="organization">Everyone</SelectItem> : null}
            <SelectItem value="team">{orgWideView ? "Teams" : "My team"}</SelectItem>
            <SelectItem value="user">People</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {progressQuery.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No targets yet"
          description={
            canManage
              ? "Pick what to count, who it's for and the goal. It takes a few seconds."
              : "Your Team Lead hasn't set any targets yet."
          }
          actionLabel={canManage ? "Set a target" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <TargetCard
              key={row.target.id}
              row={row}
              canManage={canManageTarget(row.target)}
              onDelete={() => {
                if (window.confirm("Delete this target?")) deleteMutation.mutate(row.target.id);
              }}
            />
          ))}
        </div>
      )}

      <CreateTargetDialog key={createKey} open={createOpen} onOpenChange={setCreateOpen} onDone={invalidate} />
    </div>
  );
}

function TargetCard({ row, canManage, onDelete }: { row: TargetProgress; canManage: boolean; onDelete: () => void }) {
  const { user } = useAuth();
  const t = row.target;
  const goal = goalFor(t.metric);
  const name = whoName(t);
  const reached = t.targetValue > 0 && row.actual >= t.targetValue;
  const asOf = new Date(row.asOf).getTime();
  const ended = utcDate(t.periodEnd).getTime() + 86_400_000 <= asOf;
  const upcoming = utcDate(t.periodStart).getTime() > asOf;
  const pct = row.progressPct ?? 0;
  const customName = customTargetName(t);
  const activitiesHref =
    ACTIVITY_GOALS.has(t.metric) && canAccessPath(user?.permissions, "/activities")
      ? activitiesHrefFor(t.metric)
      : undefined;

  let status: string;
  if (reached) status = "Target reached";
  else if (upcoming) status = `Starts ${dayFmt.format(utcDate(t.periodStart))}`;
  else if (ended) status = `Ended at ${Math.round(pct)}%`;
  else {
    const days = `${row.daysRemaining} ${row.daysRemaining === 1 ? "day" : "days"} left`;
    status = `${Math.round(pct)}% done · ${formatAmount(goal, row.remaining, true)} to go · ${days}`;
  }

  const body = (
    <>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground-muted">
            {name} · {periodLabel(t)}
            {t.pipelineName ? ` · ${t.pipelineName}` : ""}
          </p>
          <h3 className="text-sm font-semibold">{goal.label}</h3>
          {customName ? <p className="truncate text-[11px] text-foreground-subtle">{customName}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {reached ? <StatusBadge tone="success">Reached</StatusBadge> : null}
          {activitiesHref ? (
            <ChevronRight className="size-4 text-ink-muted transition-transform group-hover/card:translate-x-0.5" aria-hidden />
          ) : null}
          {canManage ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete target"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </header>

      <p className="text-2xl font-semibold tabular-nums">
        {formatAmount(goal, row.actual)}
        <span className="ml-1.5 text-sm font-normal text-foreground-muted">
          of {formatAmount(goal, t.targetValue, true)}
        </span>
      </p>
      <ProgressBar value={pct} />
      <p className="text-xs text-foreground-muted">{status}</p>
      <p className="text-[11px] text-foreground-subtle">
        {explain(goal, t.scopeType, name, t.periodStart, t.periodEnd)}
        {activitiesHref ? (
          <span className="mt-1 block font-medium text-brand">
            {t.metric === "activities_calls"
              ? "View calls"
              : t.metric === "activities_meetings"
                ? "View meetings"
                : "View activities"}
          </span>
        ) : null}
      </p>
    </>
  );

  if (activitiesHref) {
    return (
      <Link
        href={activitiesHref}
        className="group/card block space-y-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {body}
      </Link>
    );
  }

  return <article className="space-y-3 rounded-lg border border-border bg-surface p-4">{body}</article>;
}

function OptionButton({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-muted",
      )}
    >
      <span className="block text-sm font-medium text-ink">{title}</span>
      {hint ? <span className="block text-[11px] text-foreground-muted">{hint}</span> : null}
    </button>
  );
}

function CreateTargetDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const teamScoped = dataScopeFor(user, "targets:manage") !== "organization";
  const myTeamIds = user?.teamIds ?? [];
  const noTeam = teamScoped && myTeamIds.length === 0;
  const periods = React.useMemo(() => periodOptions(new Date()), []);

  const [goalCode, setGoalCode] = React.useState("leads");
  const [showMoreGoals, setShowMoreGoals] = React.useState(false);
  const [who, setWho] = React.useState<"organization" | "team" | "user">(teamScoped ? "team" : "organization");
  const [teamChoice, setTeamChoice] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [periodValue, setPeriodValue] = React.useState(periods[0].value);
  const [goalValue, setGoalValue] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pipelineId, setPipelineId] = React.useState("none");
  const [loading, setLoading] = React.useState(false);

  const teamsQuery = useQuery({
    queryKey: ["teams", "targets"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });
  const usersQuery = useQuery({
    // Team leads set individual targets for sales executives on their team — not for themselves.
    queryKey: ["users", "targets", teamScoped ? `se:${myTeamIds.join(",")}` : "all"],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100", isActive: "true" });
      if (teamScoped) {
        p.set("roleCode", "sales_executive");
        if (myTeamIds.length === 1) p.set("teamId", myTeamIds[0]);
      }
      return adminApi.listUsers(p);
    },
    enabled: open && !noTeam,
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
    enabled: open && showAdvanced,
  });

  const teams = (teamsQuery.data?.data ?? []).filter((t) => !teamScoped || myTeamIds.includes(t.id));
  // Team leads pick sales executives on their team — never themselves or other managers.
  const people = React.useMemo(
    () => (usersQuery.data?.data ?? []).filter((u) => u.id !== user?.id),
    [usersQuery.data, user?.id],
  );
  if (userId && people.length > 0 && !people.some((u) => u.id === userId)) setUserId("");
  const teamId = teamScoped ? (myTeamIds.length === 1 ? myTeamIds[0] : "") : teamChoice;
  const goal = goalFor(goalCode);
  const period = periods.find((p) => p.value === periodValue) ?? periods[0];
  const value = Number(goalValue);

  const subject =
    who === "organization"
      ? "Everyone"
      : who === "team"
        ? (teams.find((t) => t.id === teamId)?.name ?? (teamScoped ? "Your team" : "The team"))
        : (people.find((u) => u.id === userId)?.fullName ?? "This person");

  const problem = noTeam
    ? "You aren't on a team yet, so you can't set targets. Ask an administrator to add you to a team."
    : who === "team" && !teamScoped && !teamChoice
      ? "Choose a team."
      : who === "user" && !userId
        ? "Choose a person."
        : !(value > 0)
          ? "Enter a goal above zero."
          : "";

  const submit = async () => {
    if (problem) return;
    setLoading(true);
    try {
      await crmApi.createTarget({
        name: name.trim() || undefined,
        metric: goalCode,
        periodType: period.periodType,
        periodStart: period.start,
        periodEnd: period.end,
        scopeType: who,
        teamId: who === "team" && teamId ? teamId : null,
        userId: who === "user" ? userId : null,
        pipelineId: pipelineId === "none" ? null : pipelineId,
        targetValue: value,
      });
      onOpenChange(false);
      onDone();
      toast.success("Target set");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set target");
    } finally {
      setLoading(false);
    }
  };

  const whoOptions: Array<{ value: typeof who; title: string }> = teamScoped
    ? [
        { value: "team", title: "My team" },
        { value: "user", title: "One person" },
      ]
    : [
        { value: "organization", title: "Everyone" },
        { value: "team", title: "A team" },
        { value: "user", title: "One person" },
      ];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Set a target</ModalTitle>
          <ModalDescription>Three quick choices. Progress fills in automatically.</ModalDescription>
        </ModalHeader>
        <div className="grid max-h-[65vh] gap-5 overflow-y-auto pr-1">
          <section className="space-y-2">
            <Label>1. What should count?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(showMoreGoals ? [...GOALS, ...MORE_GOALS] : GOALS).map((g) => (
                <OptionButton
                  key={g.code}
                  selected={goalCode === g.code}
                  onClick={() => setGoalCode(g.code)}
                  title={g.label}
                  hint={g.hint}
                />
              ))}
            </div>
            {showMoreGoals ? null : (
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline"
                onClick={() => setShowMoreGoals(true)}
              >
                More options
              </button>
            )}
          </section>

          <section className="space-y-2">
            <Label>2. Who is it for?</Label>
            {noTeam ? (
              <p role="alert" className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs text-ink">
                {problem}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {whoOptions.map((o) => (
                    <OptionButton key={o.value} selected={who === o.value} onClick={() => setWho(o.value)} title={o.title} />
                  ))}
                </div>
                {who === "team" && !teamScoped ? (
                  <Select value={teamChoice || "none"} onValueChange={(v) => setTeamChoice(v === "none" ? "" : v)}>
                    <SelectTrigger aria-label="Team"><SelectValue placeholder="Choose a team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose a team…</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {who === "user" ? (
                  <Select value={userId || "none"} onValueChange={(v) => setUserId(v === "none" ? "" : v)}>
                    <SelectTrigger aria-label="Person"><SelectValue placeholder="Choose a person" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose a person…</SelectItem>
                      {people.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>3. When?</Label>
              <Select value={periodValue} onValueChange={setPeriodValue}>
                <SelectTrigger aria-label="Period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-goal">4. Goal</Label>
              <div className="relative">
                <Input
                  id="target-goal"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder={goal.unit ? "e.g. 20" : "e.g. 50000"}
                  value={goalValue}
                  onChange={(e) => setGoalValue(e.target.value)}
                  className="pr-20"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-foreground-muted">
                  {goal.unit ? goal.unit[1] : "AUD"}
                </span>
              </div>
            </div>
          </section>

          {!noTeam ? (
            <div className="rounded-md bg-surface-muted px-3 py-2.5 text-xs text-ink">
              <p>
                <span className="font-semibold">{subject}</span> aims for{" "}
                <span className="font-semibold">
                  {value > 0 ? formatAmount(goal, value, true) : `… ${goal.unit ? goal.unit[1] : ""}`}
                </span>
                {goal.unit ? "" : ` ${goal.label.toLowerCase()}`} in{" "}
                <span className="font-semibold">{period.label.replace(/^.*\((.*)\)$/, "$1")}</span>.
              </p>
              <p className="mt-1 text-foreground-muted">
                {explain(goal, who, subject, period.start, period.end)}
              </p>
            </div>
          ) : null}

          <section className="space-y-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-ink"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", showAdvanced && "rotate-180")} />
              Name and pipeline (optional)
            </button>
            {showAdvanced ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="target-name">Name</Label>
                  <Input id="target-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. October push" />
                </div>
                <div className="space-y-1.5">
                  <Label>Only count one pipeline</Label>
                  <Select value={pipelineId} onValueChange={setPipelineId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All pipelines</SelectItem>
                      {(pipelinesQuery.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </section>
        </div>
        <ModalFooter className="sm:items-center">
          {problem && !noTeam && goalValue !== "" ? (
            <p className="mr-auto text-xs text-danger">{problem}</p>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button loading={loading} disabled={!!problem} onClick={() => void submit()}>
            Set target
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
