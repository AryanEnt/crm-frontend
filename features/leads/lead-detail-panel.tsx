"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/console/avatar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/error-state";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { stageSlotFromPipeline } from "@/components/ui/stage-rail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { leadMovedMessage } from "@/features/activities/lead-moved";
import { useAuth } from "@/features/auth/auth-provider";
import { CommunicationActions } from "@/features/communications/communication-actions";
import { EmailComposer } from "@/features/email/email-composer";
import { LeadAttachments } from "@/features/leads/lead-attachments";
import { CreateLeadSheet } from "@/features/leads/create/create-lead-sheet";
import {
  daysSince,
  formatLeadMoney,
  formatNextAction,
  nextActionTone,
} from "@/features/leads/lead-format";
import { useLeadMove } from "@/features/leads/lead-move";
import { UnifiedTimeline } from "@/features/timeline/unified-timeline";
import { crmApi, type Activity, type Lead, type PipelineStage } from "@/lib/api/crm";
import { emailApi } from "@/lib/api/email";
import { stageBadgeClass } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The next open activity: overdue first, then the soonest upcoming one. */
function useNextActivity(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["lead", leadId, "next-activity"],
    enabled,
    queryFn: async (): Promise<Activity | null> => {
      const base = { leadId, limit: "1", offset: "0" };
      const [overdue, upcoming] = await Promise.all([
        crmApi.listActivities(new URLSearchParams({ ...base, status: "overdue" })),
        crmApi.listActivities(new URLSearchParams({ ...base, status: "upcoming" })),
      ]);
      return overdue.data[0] ?? upcoming.data[0] ?? null;
    },
  });
}

export function LeadDetailPanel({
  leadId,
  onOpenChange,
}: {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={!!leadId} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-w-full bg-surface shadow-[-12px_0_32px_rgba(42,40,56,0.08)] sm:max-w-[600px]"
        aria-describedby={undefined}
      >
        {leadId ? <PanelBody key={leadId} leadId={leadId} onClose={() => onOpenChange(false)} /> : null}
      </DrawerContent>
    </Drawer>
  );
}

function PanelBody({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const [activityOpen, setActivityOpen] = React.useState<null | { type?: string }>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [messagingOpen, setMessagingOpen] = React.useState(false);

  const leadQuery = useQuery({ queryKey: ["lead", leadId], queryFn: () => crmApi.getLead(leadId) });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });
  const nextQuery = useNextActivity(leadId, !!leadQuery.data);
  const accountsQuery = useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => emailApi.listAccounts(),
    enabled: can("email:send") || can("email:view"),
    staleTime: 60_000,
  });

  const refresh = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["lead-board"] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["lead-insights"] });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
  }, [qc, leadId]);

  const move = useLeadMove({ onChanged: refresh });

  const completeMutation = useMutation({
    mutationFn: (activityId: string) => crmApi.updateActivity(activityId, { status: "completed" }),
    onSuccess: (activity) => {
      toast.success("Marked done", { description: leadMovedMessage(activity) });
      refresh();
      if (activity.needsNextActivity && can("activities:create")) setActivityOpen({});
    },
    onError: (err) =>
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't complete the activity."),
  });

  const archiveMutation = useMutation({
    mutationFn: () => crmApi.bulkArchiveLeads([leadId], true),
    onSuccess: () => {
      toast.success("Lead archived");
      refresh();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error && err.message ? err.message : "Couldn't archive the lead."),
  });

  if (leadQuery.isLoading) {
    return (
      <div className="p-5">
        <DrawerTitle className="sr-only">Loading lead</DrawerTitle>
        <DetailSkeleton />
      </div>
    );
  }
  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="p-5">
        <DrawerTitle className="sr-only">Lead unavailable</DrawerTitle>
        <ErrorState onRetry={() => void leadQuery.refetch()} />
      </div>
    );
  }

  const lead = leadQuery.data;
  const pipeline = pipelinesQuery.data?.find((p) => p.id === lead.pipelineId);
  const stages = (pipeline?.stages ?? []).filter((s) => s.isActive);
  const stage = stages.find((s) => s.id === lead.stageId);
  const closed = lead.status === "won" || lead.status === "lost";
  const canEdit = can("leads:edit");
  const emailAccount = accountsQuery.data?.accounts?.[0] ?? null;

  const requestStage = (to: PipelineStage) =>
    move.request({
      leadId: lead.id,
      leadName: lead.fullName,
      status: lead.status,
      fromStageId: lead.stageId ?? null,
      to,
      pipelineId: lead.pipelineId ?? undefined,
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-line px-5 pb-4 pt-5 pr-12">
        <div className="flex items-start gap-3">
          <Avatar name={lead.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <DrawerTitle className="truncate text-lg">{lead.fullName}</DrawerTitle>
            <DrawerDescription className="truncate">
              {[lead.employer, lead.jobTitle].filter(Boolean).join(" · ") || lead.source || "Lead"}
            </DrawerDescription>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-meta">
          {stage ? <StagePill stage={stage} stages={stages} /> : lead.stageName ? <span>{lead.stageName}</span> : null}
          <span className="text-numeral-sm text-ink">
            {lead.potentialValue != null ? formatLeadMoney(lead.potentialValue, lead.currency) : "No value"}
          </span>
          <span aria-hidden className="text-ink-subtle">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            {lead.ownerName ? <Avatar name={lead.ownerName} size="sm" className="size-5 text-[0.55rem]" /> : null}
            {lead.ownerName ?? "Unassigned"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!lead.phone && !can("activities:create")}>
                <Phone className="size-3.5" />
                Call
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {lead.phone ? (
                <DropdownMenuItem asChild>
                  <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>Dial {lead.phone}</a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>No phone number</DropdownMenuItem>
              )}
              {can("activities:create") ? (
                <DropdownMenuItem onSelect={() => setActivityOpen({ type: "call" })}>Log a call</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {emailAccount && can("email:send") ? (
            <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
              <Mail className="size-3.5" />
              Email
            </Button>
          ) : lead.email ? (
            <Button size="sm" variant="outline" asChild>
              <a href={`mailto:${lead.email}`}>
                <Mail className="size-3.5" />
                Email
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title="No email address">
              <Mail className="size-3.5" />
              Email
            </Button>
          )}
          {can("activities:create") ? (
            <Button size="sm" variant="outline" onClick={() => setActivityOpen({})}>
              <CalendarPlus className="size-3.5" />
              Add activity
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="More actions">
                <MoreHorizontal className="size-4" />
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canEdit ? (
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit details
                </DropdownMenuItem>
              ) : null}
              {can("communications:send") ? (
                <DropdownMenuItem onSelect={() => setMessagingOpen(true)}>
                  <MessageCircle className="size-3.5" />
                  WhatsApp &amp; phone calls
                </DropdownMenuItem>
              ) : null}
              {can("leads:delete") ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-danger"
                    disabled={archiveMutation.isPending}
                    onSelect={() => archiveMutation.mutate()}
                  >
                    <Archive className="size-3.5" />
                    Archive lead
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 crm-scroll">
        {stages.length > 0 ? (
          <StageStepper
            stages={stages}
            currentId={lead.stageId ?? null}
            lead={lead}
            canEdit={canEdit}
            busy={move.isPending}
            onSelect={requestStage}
          />
        ) : null}

        {!closed ? (
          <NextActionCard
            activity={nextQuery.data ?? null}
            nextAt={lead.nextActivityAt ?? null}
            timezone={user?.timezone || undefined}
            loading={nextQuery.isLoading}
            canCreate={can("activities:create")}
            canComplete={can("activities:edit")}
            completing={completeMutation.isPending}
            onSchedule={() => setActivityOpen({})}
            onComplete={(id) => completeMutation.mutate(id)}
          />
        ) : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Fact label="Value" value={lead.potentialValue != null ? formatLeadMoney(lead.potentialValue, lead.currency) : "—"} />
          <Fact label="Probability" value={lead.probability != null ? `${lead.probability}%` : "—"} />
          <Fact label="Expected close" value={formatDate(lead.expectedCloseAt)} />
          <Fact label="Source" value={lead.source || "—"} />
          <Fact label="In stage" value={`${lead.daysInStage ?? daysSince(lead.stageEnteredAt)}d`} />
          <Fact label="Created" value={formatDate(lead.createdAt)} />
        </dl>

        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {can("documents:view") ? <TabsTrigger value="files">Files</TabsTrigger> : null}
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <UnifiedTimeline leadId={lead.id} />
          </TabsContent>
          {can("documents:view") ? (
            <TabsContent value="files">
              <LeadAttachments leadId={lead.id} />
            </TabsContent>
          ) : null}
          <TabsContent value="contact">
            <ContactSection lead={lead} />
          </TabsContent>
        </Tabs>
      </div>

      {move.dialogs}
      <ActivityQuickCreateDialog
        open={!!activityOpen}
        onOpenChange={(o) => !o && setActivityOpen(null)}
        context={{ leadId: lead.id }}
        defaultType={activityOpen?.type}
        onCreated={() => {
          setActivityOpen(null);
          refresh();
        }}
      />
      <CreateLeadSheet open={editOpen} onOpenChange={setEditOpen} lead={lead} onSaved={() => refresh()} />
      {emailOpen ? (
        <EmailComposer
          open={emailOpen}
          onOpenChange={setEmailOpen}
          account={emailAccount}
          context={{ leadId: lead.id, to: lead.email ? [lead.email] : [], mode: "compose" }}
        />
      ) : null}
      <Modal open={messagingOpen} onOpenChange={setMessagingOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Message or call {lead.fullName}</ModalTitle>
            <ModalDescription>Messages and calls are logged on this lead&apos;s timeline.</ModalDescription>
          </ModalHeader>
          <CommunicationActions context={{ leadId: lead.id, defaultPhone: lead.phone }} />
        </ModalContent>
      </Modal>
    </div>
  );
}

function slotOf(stage: PipelineStage, stages: PipelineStage[]) {
  const open = stages.filter((s) => !s.isWon && !s.isLost);
  return stageSlotFromPipeline({
    position: Math.max(0, open.findIndex((s) => s.id === stage.id)),
    openStageCount: Math.max(open.length, 1),
    isWon: stage.isWon,
    isLost: stage.isLost,
  });
}

function StagePill({ stage, stages }: { stage: PipelineStage; stages: PipelineStage[] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium",
        stageBadgeClass[slotOf(stage, stages)],
      )}
    >
      {stage.name}
    </span>
  );
}

function StageStepper({
  stages,
  currentId,
  lead,
  canEdit,
  busy,
  onSelect,
}: {
  stages: PipelineStage[];
  currentId: string | null;
  lead: Lead;
  canEdit: boolean;
  busy: boolean;
  onSelect: (stage: PipelineStage) => void;
}) {
  const open = stages.filter((s) => !s.isWon && !s.isLost);
  const won = stages.find((s) => s.isWon);
  const lost = stages.find((s) => s.isLost);
  const currentIdx = open.findIndex((s) => s.id === currentId);
  const closed = lead.status === "won" || lead.status === "lost";

  return (
    <section aria-label="Stage" className="space-y-2.5">
      <ol className="flex gap-1">
        {open.map((s, i) => {
          const reached = !closed && currentIdx >= 0 && i <= currentIdx;
          const current = s.id === currentId;
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!canEdit || busy || current}
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(s)}
                title={canEdit && !current ? `Move to ${s.name}` : s.name}
                className={cn(
                  "group w-full text-left focus-visible:outline-none",
                  canEdit && !current && "cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-colors duration-150",
                    reached ? "bg-brand" : "bg-surface-muted",
                    canEdit && !current && "group-hover:bg-brand/50 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  )}
                />
                <span
                  className={cn(
                    "mt-1 block truncate text-[0.6875rem]",
                    current ? "font-semibold text-ink" : "text-ink-muted",
                  )}
                >
                  {s.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-body",
            lead.status === "won" ? "bg-stage-won-soft text-stage-won-ink" : "bg-stage-lost-soft text-stage-lost-ink",
          )}
        >
          {lead.status === "won" ? <Check className="size-4" aria-hidden /> : null}
          <span className="font-medium">
            {lead.status === "won" ? `Won ${formatDate(lead.wonAt)}` : `Lost ${formatDate(lead.lostAt)}`}
          </span>
          {lead.status === "lost" && lead.lostReason ? <span>· {lead.lostReason}</span> : null}
          {canEdit && open[0] ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7"
              disabled={busy}
              onClick={() => onSelect(open[0])}
              title="Choose a stage above, or reopen into the first stage"
            >
              <RotateCcw className="size-3.5" />
              Reopen
            </Button>
          ) : null}
        </div>
      ) : canEdit && (won || lost) ? (
        <div className="flex gap-2">
          {won ? (
            <Button
              size="sm"
              className="bg-success text-white hover:bg-success/90"
              disabled={busy}
              onClick={() => onSelect(won)}
            >
              <Check className="size-3.5" />
              Mark won
            </Button>
          ) : null}
          {lost ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onSelect(lost)}>
              Mark lost
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function NextActionCard({
  activity,
  nextAt,
  timezone,
  loading,
  canCreate,
  canComplete,
  completing,
  onSchedule,
  onComplete,
}: {
  activity: Activity | null;
  nextAt: string | null;
  timezone?: string;
  loading: boolean;
  canCreate: boolean;
  canComplete: boolean;
  completing: boolean;
  onSchedule: () => void;
  onComplete: (activityId: string) => void;
}) {
  const at = activity?.dueAt ?? activity?.startAt ?? nextAt;
  const tone = nextActionTone(at, timezone);
  const scheduled = !!activity || !!nextAt;

  return (
    <section
      aria-label="Next action"
      className={cn(
        "rounded-card border p-4",
        !scheduled && !loading
          ? "border-warning/30 bg-warning-soft/50"
          : tone === "overdue"
            ? "border-danger/30 bg-danger-soft/40"
            : "border-line bg-surface-muted/40",
      )}
    >
      <p className="text-label">Next action</p>
      {loading ? (
        <p className="mt-1.5 text-meta">Loading…</p>
      ) : scheduled ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <CalendarClock
            className={cn("size-5 shrink-0", tone === "overdue" ? "text-danger" : "text-brand")}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-medium text-ink">
              {activity?.title || activity?.typeName || "Follow up"}
            </p>
            <p className={cn("text-meta", tone === "overdue" && "text-danger")}>
              {formatNextAction(at, timezone)}
              {activity?.typeName && activity.title ? ` · ${activity.typeName}` : ""}
            </p>
          </div>
          {activity && canComplete ? (
            <Button size="sm" variant="outline" loading={completing} onClick={() => onComplete(activity.id)}>
              <CalendarCheck className="size-3.5" />
              Mark done
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className="flex-1 text-body text-ink">No next action scheduled</p>
          {canCreate ? (
            <Button size="sm" onClick={onSchedule}>
              <CalendarPlus className="size-3.5" />
              Schedule next
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-label">{label}</dt>
      <dd className="mt-0.5 truncate text-body text-ink">{value}</dd>
    </div>
  );
}

function ContactSection({ lead }: { lead: Lead }) {
  const profile: Array<[string, string | number | null | undefined]> = [
    ["Country", lead.country],
    ["Nationality", lead.nationality],
    ["Location", lead.location],
    ["Occupation", lead.occupation],
    ["Job title", lead.jobTitle],
    ["Employer", lead.employer],
    ["Experience", lead.experienceYears != null ? `${lead.experienceYears} years` : null],
    ["Qualification", lead.qualification],
    ["ANZSCO", lead.anzscoCode ? `${lead.anzscoCode} ${lead.anzscoTitle ?? ""}` : null],
    ["Priority", lead.priority],
    ["Team", lead.teamName],
  ];
  const filled = profile.filter(([, v]) => v != null && String(v).trim() !== "");

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact
          label="Phone"
          value={lead.phone ? <a className="hover:text-brand" href={`tel:${lead.phone}`}>{lead.phone}</a> : "—"}
        />
        <Fact
          label="Email"
          value={lead.email ? <a className="hover:text-brand" href={`mailto:${lead.email}`}>{lead.email}</a> : "—"}
        />
      </dl>
      {lead.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-muted px-2 py-0.5 text-caption text-ink-secondary">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {lead.notes ? <p className="whitespace-pre-wrap text-body text-ink-secondary">{lead.notes}</p> : null}
      <details className="group rounded-md border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-body font-medium text-ink">
          Profile
          <span className="flex items-center gap-1 text-meta font-normal">
            {filled.length} {filled.length === 1 ? "detail" : "details"}
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </summary>
        <dl className="grid gap-3 border-t border-line px-3 py-3 sm:grid-cols-2">
          {filled.length === 0 ? (
            <p className="text-meta">No profile details yet.</p>
          ) : (
            filled.map(([label, value]) => <Fact key={label} label={label} value={String(value)} />)
          )}
        </dl>
      </details>
    </div>
  );
}