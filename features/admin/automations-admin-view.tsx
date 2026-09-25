"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-provider";
import {
  adminApi,
  type AutomationAction,
  type AutomationCondition,
  type CrmAutomation,
} from "@/lib/api/admin";
import { crmApi } from "@/lib/api/crm";
import { emailApi } from "@/lib/api/email";

type Draft = {
  name: string;
  description: string;
  isActive: boolean;
  triggerType: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

const emptyDraft = (): Draft => ({
  name: "",
  description: "",
  isActive: true,
  triggerType: "lead.created",
  conditions: [],
  actions: [{ type: "create_task", params: { title: "Follow up", dueInHours: 24 } }],
});

export function AutomationsAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CrmAutomation | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft());
  const [formError, setFormError] = React.useState("");

  const catalogQuery = useQuery({
    queryKey: ["automations-catalog"],
    queryFn: () => adminApi.automationsCatalog(),
    enabled: can("automations:view") || can("automations:manage"),
  });
  const listQuery = useQuery({
    queryKey: ["automations"],
    queryFn: () => adminApi.listAutomations(new URLSearchParams({ limit: "100" })),
    enabled: can("automations:view") || can("automations:manage"),
  });
  const runsQuery = useQuery({
    queryKey: ["automation-runs"],
    queryFn: () => adminApi.listAutomationRuns(new URLSearchParams({ limit: "40" })),
    enabled: can("automations:view") || can("automations:manage"),
  });
  const jobsQuery = useQuery({
    queryKey: ["automation-jobs"],
    queryFn: () => adminApi.listAutomationJobs(new URLSearchParams({ limit: "40" })),
    enabled: can("automations:view") || can("automations:manage"),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "automations"],
    queryFn: () => crmApi.listPipelines(undefined, true),
  });
  const usersQuery = useQuery({
    queryKey: ["users", "automations"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name,
        description: draft.description,
        isActive: draft.isActive,
        triggerType: draft.triggerType,
        conditions: draft.conditions,
        actions: draft.actions,
      };
      if (editing) return adminApi.updateAutomation(editing.id, body);
      return adminApi.createAutomation(body);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setDraft(emptyDraft());
      setFormError("");
      void qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success(editing ? "Automation updated" : "Automation created");
    },
    onError: (err: Error) => {
      const message = err.message || "Couldn't save the automation. Try again.";
      setFormError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAutomation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automation deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't delete the automation. Try again."),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateAutomation(id, { isActive }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success(vars.isActive ? "Automation enabled" : "Automation disabled");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't update the automation. Try again."),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => adminApi.retryAutomationJob(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automation-jobs"] });
      void qc.invalidateQueries({ queryKey: ["automation-runs"] });
      toast.success("Job queued for retry");
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't retry the job. Try again."),
  });

  if (!can("automations:view") && !can("automations:manage")) {
    return (
      <ErrorState
        title="Access denied"
        description="Automations require automations:view or automations:manage."
      />
    );
  }

  if (listQuery.isLoading || catalogQuery.isLoading) return <LoadingState />;
  if (listQuery.isError) return <ErrorState onRetry={() => void listQuery.refetch()} />;

  const catalog = catalogQuery.data;
  const labelFor = (list: { code: string; label: string }[] | undefined, code: string) =>
    list?.find((x) => x.code === code)?.label ?? code;

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setFormError("");
    setOpen(true);
  };

  const openEdit = (a: CrmAutomation) => {
    setEditing(a);
    setDraft({
      name: a.name,
      description: a.description,
      isActive: a.isActive,
      triggerType: a.triggerType,
      conditions: a.conditions?.length ? a.conditions : [],
      actions: a.actions?.length ? a.actions : [{ type: "create_task", params: { title: "" } }],
    });
    setFormError("");
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Control Center", href: "/" }, { label: "Automations" }]}
        title="Automations"
        description="Describe what should happen in plain steps: When something happens, If it matches, Then do this."
        actions={
          can("automations:manage") ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              New automation
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="runs">Execution log</TabsTrigger>
          <TabsTrigger value="jobs">Failed jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-3 space-y-3">
          {(listQuery.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              title="No automations yet"
              description="Create a simple When / If / Then rule to assign owners, create tasks, or move stages."
              actionLabel={can("automations:manage") ? "Create automation" : undefined}
              onAction={can("automations:manage") ? openCreate : undefined}
            />
          ) : (
            <div className="space-y-2">
              {listQuery.data!.data.map((a) => (
                <article
                  key={a.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">{a.name}</h3>
                        <StatusBadge tone={a.isActive ? "success" : "neutral"}>
                          {a.isActive ? "On" : "Off"}
                        </StatusBadge>
                      </div>
                      {a.description ? (
                        <p className="mt-1 text-xs text-foreground-muted">{a.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {can("automations:manage") ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toggleMutation.mutate({ id: a.id, isActive: !a.isActive })
                            }
                          >
                            {a.isActive ? "Turn off" : "Turn on"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm("Delete this automation?")) deleteMutation.mutate(a.id);
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded border border-border/70 bg-surface-muted/40 p-2">
                      <dt className="font-medium text-foreground-muted">When</dt>
                      <dd className="mt-0.5">{labelFor(catalog?.triggers, a.triggerType)}</dd>
                    </div>
                    <div className="rounded border border-border/70 bg-surface-muted/40 p-2">
                      <dt className="font-medium text-foreground-muted">If</dt>
                      <dd className="mt-0.5">
                        {a.conditions?.length
                          ? a.conditions
                              .map(
                                (c) =>
                                  `${labelFor(catalog?.conditions, c.field)} ${labelFor(catalog?.operators, c.operator || "eq")} ${String(c.value ?? "")}`,
                              )
                              .join("; ")
                          : "Always"}
                      </dd>
                    </div>
                    <div className="rounded border border-border/70 bg-surface-muted/40 p-2">
                      <dt className="font-medium text-foreground-muted">Then</dt>
                      <dd className="mt-0.5">
                        {(a.actions ?? [])
                          .map((act) => labelFor(catalog?.actions, act.type))
                          .join(", ")}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-3">
          {runsQuery.isLoading ? <LoadingState /> : null}
          <div className="space-y-2">
            {(runsQuery.data?.data ?? []).map((run) => (
              <div key={run.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{run.automationName || "Automation"}</span>
                  <StatusBadge
                    tone={
                      run.status === "succeeded"
                        ? "success"
                        : run.status === "failed"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {run.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-foreground-muted">
                  When: {labelFor(catalog?.triggers, run.triggerType)} ·{" "}
                  {run.resourceType}
                  {run.resourceId ? ` ${run.resourceId.slice(0, 8)}…` : ""} ·{" "}
                  {new Date(run.startedAt).toLocaleString()}
                </p>
                {run.errorMessage ? (
                  <p className="mt-1 text-danger">{run.errorMessage}</p>
                ) : null}
                {(run.actionResults ?? []).length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-foreground-subtle">
                    {run.actionResults.map((r, i) => (
                      <li key={`${run.id}-${i}`}>
                        {labelFor(catalog?.actions, r.type)}: {r.status}
                        {r.detail ? ` — ${r.detail}` : ""}
                        {r.error ? ` — ${r.error}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
            {(runsQuery.data?.data.length ?? 0) === 0 ? (
              <EmptyState title="No runs yet" description="Executions appear here after triggers fire." />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-3">
          <div className="space-y-2">
            {(jobsQuery.data?.data ?? [])
              .filter((j) => j.status === "failed" || j.status === "dead")
              .map((job) => (
                <div key={job.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {labelFor(catalog?.triggers, job.triggerType)} · {job.status}
                    </span>
                    {can("automations:manage") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryMutation.isPending}
                        onClick={() => retryMutation.mutate(job.id)}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-foreground-muted">
                    Attempts {job.attempts}/{job.maxAttempts} ·{" "}
                    {new Date(job.createdAt).toLocaleString()}
                  </p>
                  {job.lastError ? <p className="mt-1 text-danger">{job.lastError}</p> : null}
                </div>
              ))}
            {(jobsQuery.data?.data ?? []).filter((j) => j.status === "failed" || j.status === "dead")
              .length === 0 ? (
              <EmptyState
                title="No failed jobs"
                description="Failed automations are kept here for retry — nothing is silently discarded."
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <ModalHeader>
            <ModalTitle>{editing ? "Edit automation" : "New automation"}</ModalTitle>
            <ModalDescription>
              Fill in When, optional If filters, and Then actions. Invalid stage moves are blocked.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4 px-1 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label required>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Assign website leads"
                  required
                  aria-required="true"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Optional note for your team"
                />
              </div>
            </div>

            <section className="rounded-lg border border-border p-3">
              <h4 className="mb-2 text-section text-brand">
                When
              </h4>
              <Select
                value={draft.triggerType}
                onValueChange={(v) => setDraft((d) => ({ ...d, triggerType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a trigger" />
                </SelectTrigger>
                <SelectContent>
                  {(catalog?.triggers ?? []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-section text-brand">
                  If <span className="font-normal text-foreground-muted">(optional)</span>
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      conditions: [
                        ...d.conditions,
                        { field: "priority", operator: "eq", value: "high" },
                      ],
                    }))
                  }
                >
                  <Plus className="size-3.5" /> Add filter
                </Button>
              </div>
              {draft.conditions.length === 0 ? (
                <p className="text-xs text-foreground-muted">Runs for every matching When event.</p>
              ) : (
                <div className="space-y-2">
                  {draft.conditions.map((c, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <Select
                        value={c.field}
                        onValueChange={(v) =>
                          setDraft((d) => {
                            const next = [...d.conditions];
                            next[idx] = { ...next[idx], field: v };
                            return { ...d, conditions: next };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(catalog?.conditions ?? []).map((f) => (
                            <SelectItem key={f.code} value={f.code}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={c.operator || "eq"}
                        onValueChange={(v) =>
                          setDraft((d) => {
                            const next = [...d.conditions];
                            next[idx] = { ...next[idx], operator: v };
                            return { ...d, conditions: next };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(catalog?.operators ?? []).map((o) => (
                            <SelectItem key={o.code} value={o.code}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={String(c.value ?? "")}
                        onChange={(e) =>
                          setDraft((d) => {
                            const next = [...d.conditions];
                            const raw = e.target.value;
                            const num = Number(raw);
                            next[idx] = {
                              ...next[idx],
                              value:
                                c.field === "inactivity_days" || c.field === "deal_value"
                                  ? Number.isFinite(num)
                                    ? num
                                    : raw
                                  : raw,
                            };
                            return { ...d, conditions: next };
                          })
                        }
                        placeholder="Value"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            conditions: d.conditions.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-section text-brand">
                  Then
                </h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      actions: [
                        ...d.actions,
                        { type: "send_notification", params: { message: "Automation fired" } },
                      ],
                    }))
                  }
                >
                  <Plus className="size-3.5" /> Add action
                </Button>
              </div>
              <div className="space-y-3">
                {draft.actions.map((a, idx) => (
                  <ActionEditor
                    key={idx}
                    action={a}
                    catalog={catalog}
                    pipelines={pipelinesQuery.data ?? []}
                    users={usersQuery.data?.data ?? []}
                    onChange={(next) =>
                      setDraft((d) => {
                        const actions = [...d.actions];
                        actions[idx] = next;
                        return { ...d, actions };
                      })
                    }
                    onRemove={() =>
                      setDraft((d) => ({
                        ...d,
                        actions: d.actions.filter((_, i) => i !== idx),
                      }))
                    }
                  />
                ))}
              </div>
            </section>

            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.name.trim() || saveMutation.isPending || !can("automations:manage")}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function ActionEditor({
  action,
  catalog,
  pipelines,
  users,
  onChange,
  onRemove,
}: {
  action: AutomationAction;
  catalog: Awaited<ReturnType<typeof adminApi.automationsCatalog>> | undefined;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string; isActive: boolean }> }>;
  users: Array<{ id: string; fullName: string }>;
  onChange: (a: AutomationAction) => void;
  onRemove: () => void;
}) {
  const params = action.params ?? {};
  const setParam = (key: string, value: unknown) =>
    onChange({ ...action, params: { ...params, [key]: value } });

  const selectedPipelineId = String(params.pipelineId ?? "");
  const stages =
    pipelines.find((p) => p.id === selectedPipelineId)?.stages.filter((s) => s.isActive) ?? [];
  const templates = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => emailApi.listTemplates(),
  });

  return (
    <div className="space-y-2 rounded border border-border/80 p-2">
      <div className="flex gap-2">
        <Select
          value={action.type}
          onValueChange={(v) => onChange({ type: v, params: defaultParams(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(catalog?.actions ?? []).map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="icon" variant="outline" onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {action.type === "create_task" || action.type === "create_activity" ? (
        <Input
          value={String(params.title ?? "")}
          onChange={(e) => setParam("title", e.target.value)}
          placeholder="Title"
        />
      ) : null}

      {action.type === "assign_user" || action.type === "create_task" ? (
        <Select
          value={String(params.ownerUserId ?? "none")}
          onValueChange={(v) => setParam("ownerUserId", v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keep / current owner</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {action.type === "change_stage" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={selectedPipelineId || "none"}
            onValueChange={(v) =>
              onChange({
                ...action,
                params: { ...params, pipelineId: v === "none" ? "" : v, stageId: "" },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select pipeline…</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(params.stageId ?? "none")}
            onValueChange={(v) => setParam("stageId", v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select stage…</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {action.type === "send_notification" ? (
        <Input
          value={String(params.message ?? "")}
          onChange={(e) => setParam("message", e.target.value)}
          placeholder="Notification message"
        />
      ) : null}

      {action.type === "send_email" ? (
        <Select
          value={String(params.templateId ?? "none")}
          onValueChange={(v) => setParam("templateId", v === "none" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Email template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select template…</SelectItem>
            {(templates.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {action.type === "update_field" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={String(params.field ?? "priority")}
            onValueChange={(v) => setParam("field", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="source">Source</SelectItem>
              <SelectItem value="notes">Notes</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={String(params.value ?? "")}
            onChange={(e) => setParam("value", e.target.value)}
            placeholder="New value"
          />
        </div>
      ) : null}

      {action.type === "add_tag" ? (
        <Input
          value={String(params.tag ?? "")}
          onChange={(e) => setParam("tag", e.target.value)}
          placeholder="Tag"
        />
      ) : null}
    </div>
  );
}

function defaultParams(type: string): Record<string, unknown> {
  switch (type) {
    case "create_task":
      return { title: "Follow up", dueInHours: 24 };
    case "create_activity":
      return { title: "Note", kind: "note" };
    case "assign_user":
      return { ownerUserId: "" };
    case "change_stage":
      return { pipelineId: "", stageId: "" };
    case "send_notification":
      return { message: "" };
    case "send_email":
      return { templateId: "" };
    case "update_field":
      return { field: "priority", value: "high" };
    case "add_tag":
      return { tag: "" };
    default:
      return {};
  }
}
