"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { CreateLeadSheet } from "@/features/leads/create/create-lead-sheet";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { LeadFilterBar, useLeadFilterState, type StageOption } from "@/features/leads/lead-filters";
import { LeadsListView } from "@/features/leads/leads-table-view";
import { useLeadUrl } from "@/features/leads/use-lead-url";
import { crmApi } from "@/lib/api/crm";

/** Leads: record management. Find, create and edit leads; stage progression lives on /pipeline. */
export function LeadsWorkspace() {
  const { can } = useAuth();
  const { leadId, openLead, closeLead } = useLeadUrl();
  const filterState = useLeadFilterState();
  const [createOpen, setCreateOpen] = React.useState(false);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "leads"],
    queryFn: () => crmApi.listPipelines("leads"),
  });
  const pipelines = React.useMemo(() => pipelinesQuery.data ?? [], [pipelinesQuery.data]);

  const stageOptions = React.useMemo<StageOption[]>(
    () =>
      pipelines.flatMap((p) =>
        p.stages
          .filter((s) => s.isActive)
          .map((s) => ({ id: s.id, label: pipelines.length > 1 ? `${p.name} · ${s.name}` : s.name })),
      ),
    [pipelines],
  );

  const canCreate = can("leads:create");

  if (pipelinesQuery.isError) {
    return <ErrorState onRetry={() => void pipelinesQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        display
        breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Leads" }]}
        title="Leads"
        description="Find, create and keep every lead up to date."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create lead
            </Button>
          ) : null
        }
      />

      <LeadFilterBar state={filterState} stageOptions={stageOptions} />

      <LeadsListView
        pipelines={pipelines}
        filters={filterState.filters}
        onOpenLead={openLead}
        onCreateLead={canCreate ? () => setCreateOpen(true) : undefined}
      />

      <LeadDetailPanel leadId={leadId} onOpenChange={(open) => !open && closeLead()} />
      <CreateLeadSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
