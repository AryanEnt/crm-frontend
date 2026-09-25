"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  StickyNote,
  Handshake,
  UserRound,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DetailSkeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-provider";
import { adminApi } from "@/lib/api/admin";
import { crmApi, type Customer } from "@/lib/api/crm";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { FollowUpIntelPanel } from "@/features/activities/follow-up-intel";
import { DocumentsTableView } from "@/features/documents/documents-table-view";
import { UnifiedTimeline } from "@/features/timeline/unified-timeline";
import { RecordEmailSection } from "@/features/email/record-email-section";
import { CommunicationActions } from "@/features/communications/communication-actions";
import type { Referral } from "@/lib/api/referrals";
import { priorityBadgeClass, priorityFromString } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

function formatWhen(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString();
}

function formatMoney(v?: number | null, currency = "AUD") {
  if (v == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
}

function followUpClass(next?: string | null) {
  if (!next) return "text-health-warn";
  if (new Date(next).getTime() < Date.now()) return "text-health-bad";
  return "text-foreground";
}

export function Customer360View({ customerId }: { customerId: string }) {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [dealOpen, setDealOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [stageOpen, setStageOpen] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: ["customer-360", customerId],
    queryFn: () => crmApi.getCustomerProfile(customerId),
  });

  const usersQuery = useQuery({
    queryKey: ["users", "customer-360"],
    queryFn: () => adminApi.listUsers(new URLSearchParams({ limit: "100", isActive: "true" })),
  });
  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "sales"],
    queryFn: () => crmApi.listPipelines("sales"),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["customer-360", customerId] });
    void qc.invalidateQueries({ queryKey: ["customers"] });
    void qc.invalidateQueries({ queryKey: ["timeline"] });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  };

  if (profileQuery.isLoading) return <DetailSkeleton />;
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState onRetry={() => void profileQuery.refetch()} />;
  }

  const { customer, deals, referral } = profileQuery.data;
  const pipeline = pipelinesQuery.data?.find((p) => p.id === customer.pipelineId);
  const priority = priorityFromString(customer.priority);
  const openDeals = deals.filter((d) => d.status === "open");

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: "/" },
          { label: "Customers", href: "/customers" },
          { label: customer.fullName },
        ]}
        title={customer.fullName}
        description={[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          can("customers:edit") ? (
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
          ) : null
        }
      />

      <header className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium capitalize",
                  priorityBadgeClass[priority],
                )}
              >
                {priority}
              </span>
              {customer.stageName ? (
                <StatusBadge tone="brand">{customer.stageName}</StatusBadge>
              ) : null}
              {customer.ownerName ? (
                <span className="text-meta">Owner · {customer.ownerName}</span>
              ) : (
                <span className="text-meta text-health-warn">Unassigned</span>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-meta sm:grid-cols-3">
              <Metric
                label="Next follow-up"
                value={formatWhen(customer.nextFollowUpAt)}
                valueClass={followUpClass(customer.nextFollowUpAt)}
              />
              <Metric label="Last contacted" value={formatWhen(customer.lastContactedAt)} />
              <Metric
                label="Potential"
                value={formatMoney(customer.potentialValue)}
                tabular
              />
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <CommunicationActions
              context={{ customerId, defaultPhone: customer.phone }}
            />
            {can("activities:create") ? (
              <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                <StickyNote className="size-3.5" />
                Add note
              </Button>
            ) : null}
            {can("deals:create") ? (
              <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}>
                <Handshake className="size-3.5" />
                Create deal
              </Button>
            ) : null}
            {can("customers:edit") ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <UserRound className="size-3.5" />
                  Assign
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStageOpen(true)}>
                  <GitBranch className="size-3.5" />
                  Change stage
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-lg border border-border bg-surface p-4">
              <h3 className="mb-3 text-section">Timeline</h3>
              <UnifiedTimeline customerId={customerId} />
            </section>

            <aside className="space-y-3">
              <FollowUpIntelPanel customerId={customerId} />

              <section className="rounded-lg border border-border bg-surface p-4">
                <h3 className="mb-3 text-section">Open deals</h3>
                {openDeals.length === 0 ? (
                  <p className="text-meta">No open deals for this customer.</p>
                ) : (
                  <ul className="space-y-2">
                    {openDeals.slice(0, 5).map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/deals/${d.id}`}
                          className="block rounded-[var(--radius-sm)] px-1 py-1 hover:bg-surface-muted"
                        >
                          <p className="truncate text-sm font-medium text-foreground hover:text-brand">
                            {d.title}
                          </p>
                          <p className="text-meta">
                            <span className="text-data">
                              {formatMoney(d.value, d.currency)}
                            </span>
                            {d.stageName ? ` · ${d.stageName}` : ""}
                          </p>
                        </Link>
                      </li>
                    ))}
                    {openDeals.length > 5 ? (
                      <li className="text-meta">+{openDeals.length - 5} more</li>
                    ) : null}
                  </ul>
                )}
              </section>

              <ReferralCard referral={referral ?? null} />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="deals" className="mt-3">
          {deals.length === 0 ? (
            <EmptyState
              title="No deals yet"
              description="Create a deal from quick actions to track this opportunity."
              actionLabel={can("deals:create") ? "Create deal" : undefined}
              onAction={can("deals:create") ? () => setDealOpen(true) : undefined}
            />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 density-row">
                  <div className="min-w-0">
                    <Link
                      href={`/deals/${d.id}`}
                      className="text-sm font-medium text-foreground hover:text-brand"
                    >
                      {d.title}
                    </Link>
                    <p className="text-meta">
                      {[d.pipelineName, d.stageName, d.ownerName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-data text-sm font-medium">
                      {formatMoney(d.value, d.currency)}
                    </p>
                    <StatusBadge
                      tone={
                        d.status === "won"
                          ? "success"
                          : d.status === "lost"
                            ? "danger"
                            : "brand"
                      }
                    >
                      {d.status}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-3">
          <RecordEmailSection
            customerId={customerId}
            defaultTo={customer.email}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-3">
          <DocumentsTableView customerId={customerId} compact />
        </TabsContent>

        <TabsContent value="profile" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <ProfileCard title="Professional profile">
              <InfoRow label="Occupation" value={customer.occupation} />
              <InfoRow label="Job title" value={customer.jobTitle} />
              <InfoRow label="Employer" value={customer.employer} />
              <InfoRow
                label="Experience"
                value={
                  customer.experienceYears != null ? `${customer.experienceYears} years` : ""
                }
              />
              <InfoRow label="Qualification" value={customer.qualification} />
              <InfoRow label="Skills" value={(customer.skills ?? []).join(", ")} />
              <InfoRow
                label="ANZSCO"
                value={
                  customer.anzscoCode
                    ? `${customer.anzscoCode} — ${customer.anzscoTitle ?? ""}`
                    : ""
                }
              />
            </ProfileCard>
            <ProfileCard title="Sales profile">
              <InfoRow label="Source" value={customer.source} />
              <InfoRow label="Owner" value={customer.ownerName ?? ""} />
              <InfoRow label="Team" value={customer.teamName ?? ""} />
              <InfoRow label="Pipeline" value={customer.pipelineName ?? ""} />
              <InfoRow label="Stage" value={customer.stageName ?? ""} />
              <InfoRow
                label="Potential value"
                value={formatMoney(customer.potentialValue)}
              />
              <InfoRow label="Expected outcome" value={customer.expectedOutcome} />
              <InfoRow label="Created" value={formatWhen(customer.createdAt)} />
              <InfoRow label="Last contacted" value={formatWhen(customer.lastContactedAt)} />
              <InfoRow label="Next follow-up" value={formatWhen(customer.nextFollowUpAt)} />
            </ProfileCard>
            <ReferralCard referral={referral ?? null} />
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {customer.notes || "No notes yet."}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={customer}
        onSaved={() => invalidate()}
      />

      <ActivityQuickCreateDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        context={{ customerId }}
        defaultType="note"
        onCreated={invalidate}
      />
      <QuickDealDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        customer={customer}
        actorId={user?.id}
        onDone={invalidate}
      />
      {assignOpen ? (
        <AssignDialog
          key={`assign-${customer.ownerUserId ?? "none"}`}
          open={assignOpen}
          onOpenChange={setAssignOpen}
          customer={customer}
          owners={usersQuery.data?.data ?? []}
          onDone={invalidate}
        />
      ) : null}
      {stageOpen ? (
        <StageDialog
          key={`stage-${customer.pipelineId ?? "none"}-${customer.stageId ?? "none"}`}
          open={stageOpen}
          onOpenChange={setStageOpen}
          customer={customer}
          stages={pipeline?.stages ?? []}
          pipelines={pipelinesQuery.data ?? []}
          onDone={invalidate}
        />
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass,
  tabular,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tabular?: boolean;
}) {
  return (
    <div>
      <dt className="text-label text-foreground-subtle">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", tabular && "text-data", valueClass)}>{value}</dd>
    </div>
  );
}

function ReferralCard({ referral }: { referral: Referral | null }) {
  if (!referral) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-section">Referral</h3>
        <p className="text-meta">No referral linked to this customer.</p>
      </section>
    );
  }

  let href: string | null = null;
  if (referral.referrerCustomerId) href = `/customers/${referral.referrerCustomerId}`;
  else if (referral.referrerUserId) href = `/admin/referrals/referrers/user/${referral.referrerUserId}`;
  else if (referral.referrerPartnerId)
    href = `/admin/referrals/referrers/partner/${referral.referrerPartnerId}`;

  const referredBy = referral.referrerDisplayName || "—";

  return (
    <ProfileCard title="Referral">
      <div className="flex gap-3 text-xs">
        <dt className="w-32 shrink-0 text-foreground-subtle">Referred by</dt>
        <dd className="min-w-0 text-foreground">
          {href ? (
            <Link href={href} className="text-brand hover:underline">
              {referredBy}
            </Link>
          ) : (
            referredBy
          )}
        </dd>
      </div>
      <InfoRow label="Referrer type" value={referral.referrerTypeName} />
      <InfoRow label="Relationship" value={referral.relationshipName ?? ""} />
      <InfoRow label="Referral date" value={referral.referralDate} />
      <InfoRow label="Referral status" value={referral.statusName} />
      <InfoRow label="Referral source" value={referral.referralSource} />
      <InfoRow label="Referral notes" value={referral.notes} />
      {referral.referralCode ? <InfoRow label="Referral code" value={referral.referralCode} /> : null}
    </ProfileCard>
  );
}

function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-section">{title}</h3>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <dt className="w-32 shrink-0 text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 text-foreground">{value || "—"}</dd>
    </div>
  );
}

function QuickDealDialog({
  open,
  onOpenChange,
  customer,
  actorId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  actorId?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [value, setValue] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Create deal</ModalTitle>
          <ModalDescription>A customer can have multiple deals.</ModalDescription>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required aria-required="true" />
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
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
                  await crmApi.createDeal({
                    customerId: customer.id,
                    title: title || `Deal for ${customer.fullName}`,
                    value: value ? Number(value) : null,
                    ownerUserId: customer.ownerUserId ?? actorId ?? null,
                    teamId: customer.teamId ?? null,
                    pipelineId: customer.pipelineId ?? null,
                    stageId: customer.stageId ?? null,
                  });
                  onOpenChange(false);
                  setTitle("");
                  setValue("");
                  onDone();
                  toast.success("Deal created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create deal");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Create deal
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  customer,
  owners,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  owners: Array<{ id: string; fullName: string }>;
  onDone: () => void;
}) {
  const [ownerUserId, setOwnerUserId] = React.useState(customer.ownerUserId ?? "none");
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Assign owner</ModalTitle>
        </ModalHeader>
        <Select value={ownerUserId} onValueChange={setOwnerUserId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {owners.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={loading}
            onClick={() => {
              void (async () => {
                setLoading(true);
                try {
                  await crmApi.updateCustomer(customer.id, {
                    // Empty string clears; JSON null is omitted by Go *string decode.
                    ownerUserId: ownerUserId === "none" ? "" : ownerUserId,
                    forceUpdate: true,
                  });
                  onOpenChange(false);
                  onDone();
                  toast.success("Owner assigned");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not assign owner");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Assign
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function StageDialog({
  open,
  onOpenChange,
  customer,
  stages,
  pipelines,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  stages: Array<{ id: string; name: string }>;
  pipelines: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>;
  onDone: () => void;
}) {
  const [pipelineId, setPipelineId] = React.useState(customer.pipelineId ?? "none");
  const [stageId, setStageId] = React.useState(customer.stageId ?? "none");
  const [loading, setLoading] = React.useState(false);
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Change stage</ModalTitle>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Pipeline</Label>
            <Select
              value={pipelineId}
              onValueChange={(v) => {
                const p = pipelines.find((x) => x.id === v);
                setPipelineId(v);
                setStageId(p?.stages[0]?.id ?? "none");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(pipeline?.stages ?? stages).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  await crmApi.updateCustomer(customer.id, {
                    pipelineId: pipelineId === "none" ? null : pipelineId,
                    stageId: stageId === "none" ? null : stageId,
                    forceUpdate: true,
                  });
                  await crmApi.createActivity({
                    kind: "stage_change",
                    subject: "Stage updated",
                    body: `Moved to stage ${stageId}`,
                    status: "completed",
                    customerId: customer.id,
                  });
                  onOpenChange(false);
                  onDone();
                  toast.success("Stage updated");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not update stage");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Update stage
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
