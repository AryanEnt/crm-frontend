"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ProgressBar } from "@/components/ui/progress-bar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type StageMoveError } from "@/lib/api/crm";
import { ApiError } from "@/types/api";
import { FollowUpIntelPanel } from "@/features/activities/follow-up-intel";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { DealInsightsPanel } from "@/features/predictions/insight-panels";
import { CommunicationActions } from "@/features/communications/communication-actions";
import {
  DealOutcomeButtons,
  LostReasonDialog,
  findOutcomeStage,
  stageById,
  type LostReasonState,
} from "@/features/deals/deal-outcome";

const attentionLabel: Record<string, string> = {
  no_next_activity: "No next activity",
  no_recent_activity: "No recent activity",
  attention_needed: "Attention needed",
  over_sla: "Over SLA",
};

function formatMoney(v?: number | null, currency = "AUD") {
  if (v == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
}

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

export function DealDetailView({ dealId }: { dealId: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [docOpen, setDocOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [lostPending, setLostPending] = React.useState<LostReasonState>(null);
  const [blockers, setBlockers] = React.useState<{
    stageId: string;
    details: StageMoveError;
  } | null>(null);

  const detailQuery = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => crmApi.getDeal(dealId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["deal", dealId] });
    void qc.invalidateQueries({ queryKey: ["deal-board"] });
  };

  const moveMutation = useMutation({
    mutationFn: ({
      stageId,
      force,
      lostReason,
    }: {
      stageId: string;
      force?: boolean;
      lostReason?: string;
    }) =>
      crmApi.moveDeal(dealId, {
        stageId,
        pipelineId: detailQuery.data?.deal.pipelineId ?? undefined,
        force,
        lostReason,
      }),
    onSuccess: (_d, vars) => {
      setBlockers(null);
      setLostPending(null);
      invalidate();
      toast.success(vars.lostReason ? "Deal marked lost" : "Deal stage updated");
    },
    onError: (err, vars) => {
      if (err instanceof ApiError && err.status === 400 && err.details) {
        setBlockers({ stageId: vars.stageId, details: err.details as StageMoveError });
        toast.warning("Stage move blocked — review requirements");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not move deal");
    },
  });

  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState onRetry={() => void detailQuery.refetch()} />;
  }

  const { deal, customer, transitions, activities, documents, pipeline } = detailQuery.data;
  const probability = deal.probability ?? 0;
  const wonStage = findOutcomeStage(pipeline, "won");
  const lostStage = findOutcomeStage(pipeline, "lost");
  const weighted =
    deal.status === "open" ? (deal.value ?? 0) * (probability / 100) : deal.status === "won" ? (deal.value ?? 0) : 0;

  const requestStage = (stageId: string, force?: boolean) => {
    const stage = stageById(pipeline, stageId);
    if (stage?.isLost) {
      setLostPending({ dealId, stageId, stageName: stage.name, force });
      return;
    }
    moveMutation.mutate({ stageId, force });
  };
  const timelineItems = [
    ...activities.map((a) => ({
      id: a.id,
      title: `${a.kind}: ${a.subject}`,
      description: a.body || undefined,
      timestamp: formatWhen(a.createdAt),
      tone: (a.kind === "stage_change" ? "warning" : "brand") as "warning" | "brand",
    })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Deals", href: "/deals" },
          { label: deal.title },
        ]}
        title={deal.title}
        description={`${customer.fullName} · ${deal.pipelineName ?? "No pipeline"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/customers/${customer.id}`}>Open customer</Link>
            </Button>
            <CommunicationActions
              context={{
                dealId,
                customerId: customer.id,
                defaultPhone: customer.phone,
              }}
            />
            {can("activities:create") ? (
              <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)}>
                Schedule activity
              </Button>
            ) : null}
            {can("deals:edit") ? (
              <Button size="sm" variant="outline" onClick={() => setDocOpen(true)}>
                Add document
              </Button>
            ) : null}
            <DealOutcomeButtons
              status={deal.status}
              canEdit={can("deals:edit")}
              wonStage={wonStage}
              lostStage={lostStage}
              onWon={() => wonStage && requestStage(wonStage.id)}
              onLost={() => lostStage && requestStage(lostStage.id)}
            />
          </div>
        }
      />

      <header className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Current stage" value={deal.stageName ?? "—"} />
        <Metric label="Time in stage" value={`${deal.daysInStage}d`} />
        <Metric label="Deal age" value={`${deal.ageDays}d`} />
        <Metric label="Expected close" value={deal.expectedCloseAt ?? "—"} />
        <Metric label="Probability" value={`${probability}%`} />
        <Metric label="Weighted forecast" value={formatMoney(weighted, deal.currency)} />
      </header>

      {deal.attention ? (
        <p className="text-sm text-warning">
          {attentionLabel[deal.attention] ?? deal.attention}
          {deal.attention === "no_next_activity" && can("activities:create") ? (
            <>
              {" "}
              <button type="button" className="font-medium underline" onClick={() => setActivityOpen(true)}>
                Schedule now
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          tone={
            deal.status === "won"
              ? "success"
              : deal.status === "lost"
                ? "danger"
                : "brand"
          }
        >
          {deal.status}
        </StatusBadge>
        <StatusBadge tone="neutral">{deal.priority}</StatusBadge>
        <span className="text-sm font-medium">{formatMoney(deal.value, deal.currency)}</span>
        {deal.status === "lost" && deal.lostReason ? (
          <span className="text-xs text-destructive">Reason: {deal.lostReason}</span>
        ) : null}
        {can("deals:edit") && pipeline ? (
          <Select
            value={deal.stageId ?? undefined}
            onValueChange={(stageId) => requestStage(stageId)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Change stage" />
            </SelectTrigger>
            <SelectContent>
              {pipeline.stages
                .filter((s) => s.isActive)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="progress">Pipeline progress</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <FollowUpIntelPanel dealId={dealId} />
          <DealInsightsPanel dealId={dealId} />
          <section className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Deal details</h3>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <Row label="Owner" value={deal.ownerName ?? "—"} />
              <Row label="Team" value={deal.teamName ?? "—"} />
              <Row label="Source" value={deal.source || "—"} />
              <Row label="Priority" value={deal.priority} />
              <Row label="Created" value={formatWhen(deal.createdAt)} />
              <Row label="Last activity" value={formatWhen(deal.lastActivityAt)} />
              <Row label="Next activity" value={formatWhen(deal.nextActivityAt)} />
            </dl>
          </section>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-xs text-foreground-muted">Probability</p>
            <ProgressBar value={probability} />
          </div>
        </TabsContent>

        <TabsContent value="customer" className="mt-3">
          <section className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold">{customer.fullName}</h3>
            <p className="mt-1 text-xs text-foreground-muted">
              {[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact"}
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href={`/customers/${customer.id}`}>Customer 360</Link>
            </Button>
          </section>
        </TabsContent>

        <TabsContent value="progress" className="mt-3 space-y-3">
          {pipeline ? (
            <ol className="space-y-2">
              {pipeline.stages
                .filter((s) => s.isActive)
                .map((s) => {
                  const current = s.id === deal.stageId;
                  return (
                    <li
                      key={s.id}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        current
                          ? "border-brand bg-brand-soft/40"
                          : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-foreground-muted">{s.probability}%</span>
                      </div>
                      {s.slaHours ? (
                        <p className="text-[11px] text-foreground-subtle">SLA {s.slaHours}h</p>
                      ) : null}
                    </li>
                  );
                })}
            </ol>
          ) : (
            <EmptyState title="No pipeline" description="Assign a pipeline to track progress." />
          )}
          <section className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Stage history</h3>
            {transitions.length === 0 ? (
              <p className="text-xs text-foreground-muted">No transitions yet.</p>
            ) : (
              <ul className="space-y-2">
                {transitions.map((t) => (
                  <li key={t.id} className="text-xs text-foreground-muted">
                    <span className="text-foreground">
                      {t.fromStageName ?? "Start"} → {t.toStageName}
                    </span>
                    {" · "}
                    {formatWhen(t.exitedAt)}
                    {t.durationSeconds != null
                      ? ` · ${Math.round(t.durationSeconds / 3600)}h in prior stage`
                      : ""}
                    {t.actorName ? ` · ${t.actorName}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="activities" className="mt-3 space-y-3">
          {can("activities:create") ? (
            <Button size="sm" onClick={() => setActivityOpen(true)}>
              Schedule activity
            </Button>
          ) : null}
          {activities.length === 0 ? (
            <EmptyState title="No activities" />
          ) : (
            <ul className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <p className="text-sm font-medium">
                    <span className="mr-2 text-[10px] uppercase text-foreground-muted">
                      {a.kind}
                    </span>
                    {a.subject}
                  </p>
                  {a.body ? <p className="text-xs text-foreground-muted">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-3">
          {documents.length === 0 ? (
            <EmptyState title="No documents" description="Attach required document categories before advanced stages." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {documents.map((d) => (
                <li key={d.id} className="flex justify-between px-3 py-2 text-sm">
                  <span>
                    {d.name}
                    {d.category ? (
                      <span className="ml-2 text-xs text-foreground-muted">({d.category})</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-foreground-subtle">{formatWhen(d.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3 rounded-lg border border-border bg-surface p-4">
          {timelineItems.length === 0 ? (
            <EmptyState title="Timeline empty" />
          ) : (
            <Timeline items={timelineItems} />
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <div className="rounded-lg border border-border bg-surface p-4 text-sm whitespace-pre-wrap">
            {deal.notes || "No notes."}
          </div>
        </TabsContent>
      </Tabs>

      <QuickDocument
        open={docOpen}
        onOpenChange={setDocOpen}
        dealId={dealId}
        onDone={invalidate}
      />

      <ActivityQuickCreateDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        context={{ dealId, customerId: customer.id }}
        onCreated={() => {
          setActivityOpen(false);
          invalidate();
          void qc.invalidateQueries({ queryKey: ["calendar"] });
        }}
      />

      <LostReasonDialog
        pending={lostPending}
        loading={moveMutation.isPending}
        onCancel={() => setLostPending(null)}
        onConfirm={(reason) => {
          if (!lostPending) return;
          moveMutation.mutate({
            stageId: lostPending.stageId,
            force: lostPending.force,
            lostReason: reason,
          });
        }}
      />

      <Modal open={!!blockers} onOpenChange={(o) => !o && setBlockers(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Stage requirements not met</ModalTitle>
            <ModalDescription>
              Missing items for {blockers?.details.stageName ?? "target stage"}.
            </ModalDescription>
          </ModalHeader>
          <ul className="space-y-1 text-sm text-foreground-muted">
            {(blockers?.details.missingFields ?? []).map((f) => (
              <li key={f}>Field: {f}</li>
            ))}
            {(blockers?.details.missingActivities ?? []).map((a) => (
              <li key={a}>Activity: {a}</li>
            ))}
            {(blockers?.details.missingDocuments ?? []).map((d) => (
              <li key={d}>Document: {d}</li>
            ))}
          </ul>
          <ModalFooter>
            <Button variant="outline" onClick={() => setBlockers(null)}>
              Cancel
            </Button>
            <Button
              loading={moveMutation.isPending}
              onClick={() => blockers && requestStage(blockers.stageId, true)}
            >
              Move anyway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-foreground-subtle">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 text-foreground-subtle">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function QuickDocument({
  open,
  onOpenChange,
  dealId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dealId: string;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("passport");
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add document record</ModalTitle>
          <ModalDescription>
            Categories are checked against stage required documents.
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" />
          </div>
          <div className="space-y-1.5">
            <Label required>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["passport", "resume", "offer_letter", "other"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                try {
                  await crmApi.addDealDocument(dealId, {
                    name: name || category,
                    category,
                  });
                  onOpenChange(false);
                  onDone();
                  toast.success("Document added");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not add document");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
