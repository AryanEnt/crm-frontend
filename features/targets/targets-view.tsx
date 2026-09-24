"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
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
import { adminApi } from "@/lib/api/admin";
import { crmApi, type TargetProgress } from "@/lib/api/crm";
import { formatMoney } from "@/features/analytics/charts";

function metricLabel(code: string, catalog: Array<{ code: string; label: string }>) {
  return catalog.find((m) => m.code === code)?.label ?? code;
}

function formatActual(metric: string, value: number) {
  if (metric === "pipeline_value") return formatMoney(value);
  return String(Math.round(value * 100) / 100);
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function quarterBounds(y: number, q: number): { start: string; end: string } {
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 3, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function TargetsView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [periodType, setPeriodType] = React.useState("all");
  const [scopeType, setScopeType] = React.useState("all");

  const metricsQuery = useQuery({
    queryKey: ["target-metrics"],
    queryFn: () => crmApi.listTargetMetrics(),
  });

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: "0" });
    if (periodType !== "all") p.set("periodType", periodType);
    if (scopeType !== "all") p.set("scopeType", scopeType);
    return p;
  }, [periodType, scopeType]);

  const progressQuery = useQuery({
    queryKey: ["targets-progress", params.toString()],
    queryFn: () => crmApi.listTargetProgress(params),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["targets-progress"] });
    void qc.invalidateQueries({ queryKey: ["targets"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteTarget(id),
    onSuccess: () => {
      invalidate();
      toast.success("Target deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Could not delete target"),
  });

  if (progressQuery.isError) {
    return <ErrorState onRetry={() => void progressQuery.refetch()} />;
  }

  const rows = progressQuery.data?.data ?? [];
  const catalog = metricsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Targets" }]}
        title="Targets"
        description="Monthly and quarterly goals for teams and individuals — actuals from live CRM data."
        actions={
          can("targets:manage") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New target
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Select value={periodType} onValueChange={setPeriodType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scopeType} onValueChange={setScopeType}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Scope" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="team">Team</SelectItem>
            <SelectItem value="user">Individual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {progressQuery.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No targets configured"
          description="Managers can set monthly or quarterly targets for teams and individuals."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <TargetProgressCard
              key={row.target.id}
              row={row}
              catalog={catalog}
              canManage={can("targets:manage")}
              onDelete={() => {
                if (window.confirm("Delete this target?")) {
                  deleteMutation.mutate(row.target.id);
                }
              }}
            />
          ))}
        </div>
      )}

      <CreateTargetDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        catalog={catalog}
        onDone={invalidate}
      />
    </div>
  );
}

function TargetProgressCard({
  row,
  catalog,
  canManage,
  onDelete,
}: {
  row: TargetProgress;
  catalog: Array<{ code: string; label: string }>;
  canManage: boolean;
  onDelete: () => void;
}) {
  const t = row.target;
  const scope =
    t.scopeType === "team"
      ? t.teamName ?? "Team"
      : t.scopeType === "user"
        ? t.userName ?? "User"
        : "Organization";

  return (
    <article className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t.name}</h3>
          <p className="text-xs text-foreground-muted">
            {metricLabel(t.metric, catalog)} · {t.periodType} · {scope}
          </p>
          <p className="text-[11px] text-foreground-subtle">
            {t.periodStart} → {t.periodEnd}
            {t.pipelineName ? ` · ${t.pipelineName}` : ""}
          </p>
        </div>
        <StatusBadge tone={t.scopeType === "user" ? "brand" : t.scopeType === "team" ? "info" : "neutral"}>
          {t.scopeType}
        </StatusBadge>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Target" value={formatActual(t.metric, t.targetValue)} />
        <MetricCard label="Actual" value={formatActual(t.metric, row.actual)} />
        <MetricCard label="Remaining" value={formatActual(t.metric, row.remaining)} />
        <MetricCard label="Time left" value={`${row.daysRemaining}d`} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground-muted">Progress</span>
          <span className="font-medium">{row.progressLabel}</span>
        </div>
        {row.progressPct == null ? (
          <p className="text-xs text-foreground-subtle">
            Progress percentage is not shown when the target value is zero.
          </p>
        ) : (
          <ProgressBar value={row.progressPct} />
        )}
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onDelete}>
            Delete
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function CreateTargetDialog({
  open,
  onOpenChange,
  catalog,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalog: Array<{ code: string; label: string }>;
  onDone: () => void;
}) {
  const now = new Date();
  const [name, setName] = React.useState("");
  const [metric, setMetric] = React.useState("leads");
  const [periodType, setPeriodType] = React.useState("monthly");
  const [month, setMonth] = React.useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [year, setYear] = React.useState(String(now.getFullYear()));
  const [quarter, setQuarter] = React.useState(String(Math.floor(now.getMonth() / 3) + 1));
  const [scopeType, setScopeType] = React.useState("organization");
  const [teamId, setTeamId] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [pipelineId, setPipelineId] = React.useState("none");
  const [targetValue, setTargetValue] = React.useState("10");
  const [loading, setLoading] = React.useState(false);

  const teamsQuery = useQuery({
    queryKey: ["teams", "targets"],
    queryFn: () => adminApi.listTeams(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });
  const usersQuery = useQuery({
    queryKey: ["users", "targets"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
    enabled: open,
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "targets"],
    queryFn: () => crmApi.listPipelines(),
    enabled: open,
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Create target</ModalTitle>
          <ModalDescription>Authorized managers configure goals; actuals come from PostgreSQL.</ModalDescription>
        </ModalHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label required>Metric</Label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {catalog.map((m) => (
                  <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label required>Period type</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "monthly" ? (
            <div className="space-y-1.5">
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quarter</Label>
                <Select value={quarter} onValueChange={setQuarter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label required>Scope</Label>
            <Select value={scopeType} onValueChange={setScopeType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="user">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scopeType === "team" ? (
            <div className="space-y-1.5">
              <Label required>Team</Label>
              <Select value={teamId || "none"} onValueChange={(v) => setTeamId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {(teamsQuery.data?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {scopeType === "user" ? (
            <div className="space-y-1.5">
              <Label required>Sales executive</Label>
              <Select value={userId || "none"} onValueChange={(v) => setUserId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {(usersQuery.data?.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Pipeline (optional)</Label>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any pipeline</SelectItem>
                {(pipelinesQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label required>Target value</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                try {
                  const bounds =
                    periodType === "monthly"
                      ? monthBounds(month)
                      : quarterBounds(Number(year), Number(quarter));
                  await crmApi.createTarget({
                    name: name || undefined,
                    metric,
                    periodType,
                    periodStart: bounds.start,
                    periodEnd: bounds.end,
                    scopeType,
                    teamId: scopeType === "team" ? teamId : null,
                    userId: scopeType === "user" ? userId : null,
                    pipelineId: pipelineId === "none" ? null : pipelineId,
                    targetValue: Number(targetValue) || 0,
                  });
                  onOpenChange(false);
                  onDone();
                  toast.success("Target created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create target");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
