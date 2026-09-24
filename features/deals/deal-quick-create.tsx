"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  QuickCreateDrawer,
  FormFieldSlot,
  SearchableSelect,
  PipelineStagePickers,
  UserPicker,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api/crm";

export function DealQuickCreateDrawer({
  open,
  onOpenChange,
  defaultCustomerId,
  defaultPipelineId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCustomerId?: string;
  defaultPipelineId?: string;
  onCreated?: () => void;
}) {
  const { user, can } = useAuth();
  const canAssignOwner = user?.roleCode === "sales_manager";
  const [title, setTitle] = React.useState("");
  const [customerId, setCustomerId] = React.useState(defaultCustomerId ?? "");
  const [value, setValue] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState(user?.id ?? "");
  const [pipelineId, setPipelineId] = React.useState("");
  const [stageId, setStageId] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "sales"],
    queryFn: () => crmApi.listPipelines("sales"),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setCustomerId(defaultCustomerId ?? "");
    setValue("");
    setOwnerUserId(user?.id ?? "");
    const p =
      (defaultPipelineId
        ? pipelinesQuery.data?.find((x) => x.id === defaultPipelineId)
        : undefined) ?? pipelinesQuery.data?.[0];
    setPipelineId(p?.id ?? "");
    setStageId(p?.stages[0]?.id ?? "");
  }, [open, defaultCustomerId, defaultPipelineId, user?.id, pipelinesQuery.data]);

  if (!can("deals:create")) return null;

  const searchCustomers = async (q: string) => {
    const res = await crmApi.listCustomers(
      new URLSearchParams({ limit: "20", q: q || "" }),
    );
    return (res.data ?? []).map((c) => ({
      value: c.id,
      label: c.fullName,
      description: c.email ?? undefined,
    }));
  };

  return (
    <QuickCreateDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Deal"
      description="Link a deal to a customer with pipeline defaults filled in."
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={loading}
            onClick={() => {
              void (async () => {
                if (!title.trim()) {
                  toast.error("Title is required");
                  return;
                }
                if (!customerId) {
                  toast.error("Select a customer");
                  return;
                }
                setLoading(true);
                try {
                  await crmApi.createDeal({
                    title: title.trim(),
                    customerId,
                    value: value ? Number(value) : null,
                    ownerUserId: canAssignOwner
                      ? ownerUserId || null
                      : user?.id ?? null,
                    pipelineId: pipelineId || null,
                    stageId: stageId || null,
                  });
                  toast.success("Deal created");
                  onOpenChange(false);
                  onCreated?.();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to create deal");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Create Deal
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <FormFieldSlot label="Title" required>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deal title"
          />
        </FormFieldSlot>
        {!defaultCustomerId ? (
          <FormFieldSlot label="Customer" required>
            <SearchableSelect
              value={customerId || null}
              onChange={(v) => setCustomerId(v ?? "")}
              onSearch={searchCustomers}
              placeholder="Search customer…"
              emptyText="No matching customers found."
            />
          </FormFieldSlot>
        ) : null}
        {canAssignOwner ? (
          <UserPicker value={ownerUserId} onChange={setOwnerUserId} label="Owner" />
        ) : null}
        <PipelineStagePickers
          pipelines={pipelinesQuery.data ?? []}
          pipelineId={pipelineId}
          stageId={stageId}
          onPipelineChange={(pid, sid) => {
            setPipelineId(pid);
            setStageId(sid);
          }}
          onStageChange={setStageId}
        />
        <FormFieldSlot label="Potential Value">
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="$"
          />
        </FormFieldSlot>
      </div>
    </QuickCreateDrawer>
  );
}
