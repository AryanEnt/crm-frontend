"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
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
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi, type Pipeline, type PipelineStage } from "@/lib/api/crm";

export function PipelinesAdminView() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [createPipeOpen, setCreatePipeOpen] = React.useState(false);
  const [createStageOpen, setCreateStageOpen] = React.useState(false);
  const [editStage, setEditStage] = React.useState<PipelineStage | null>(null);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines", "admin"],
    queryFn: () => crmApi.listPipelines(undefined, true),
  });

  const selected =
    pipelinesQuery.data?.find((p) => p.id === selectedId) ?? pipelinesQuery.data?.[0] ?? null;
  const activeSelectedId = selected?.id ?? "";

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["pipelines"] });

  if (!can("pipelines:manage")) {
    return (
      <ErrorState
        title="Access denied"
        description="Pipeline configuration requires pipelines:manage."
      />
    );
  }

  if (pipelinesQuery.isLoading) return <LoadingState />;
  if (pipelinesQuery.isError) {
    return <ErrorState onRetry={() => void pipelinesQuery.refetch()} />;
  }

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: "Control Center", href: "/" },
          { label: "Pipelines & Stages" },
        ]}
        title="Pipelines & Stages"
        description="Configure pipeline definitions and stages. Moving deals through stages is a sales operating action."
        actions={
          <Button size="sm" onClick={() => setCreatePipeOpen(true)}>
            <Plus className="size-3.5" />
            New pipeline
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border border-border bg-surface p-2">
          <ul className="space-y-1">
            {(pipelinesQuery.data ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    p.id === activeSelectedId
                      ? "bg-brand-soft text-brand-dark"
                      : "hover:bg-surface-muted"
                  }`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-[11px] text-foreground-muted">
                    {p.kind} · {p.stages.length} stages
                    {!p.isActive ? " · inactive" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selected ? (
          <PipelineEditor
            key={selected.id}
            pipeline={selected}
            onAddStage={() => setCreateStageOpen(true)}
            onEditStage={setEditStage}
            onToggleActive={() => {
              void crmApi
                .updatePipeline(selected.id, { isActive: !selected.isActive })
                .then(invalidate);
            }}
            onSaved={invalidate}
          />
        ) : (
          <p className="text-sm text-foreground-muted">Select or create a pipeline.</p>
        )}
      </div>

      <CreatePipelineDialog
        open={createPipeOpen}
        onOpenChange={setCreatePipeOpen}
        onCreated={(p) => {
          setSelectedId(p.id);
          invalidate();
        }}
      />
      {activeSelectedId ? (
        <CreateStageDialog
          open={createStageOpen}
          onOpenChange={setCreateStageOpen}
          pipelineId={activeSelectedId}
          onCreated={invalidate}
        />
      ) : null}
      {editStage ? (
        <EditStageDialog
          key={editStage.id}
          stage={editStage}
          open={!!editStage}
          onOpenChange={(o) => !o && setEditStage(null)}
          onSaved={() => {
            setEditStage(null);
            invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

function PipelineEditor({
  pipeline,
  onAddStage,
  onEditStage,
  onToggleActive,
  onSaved,
}: {
  pipeline: Pipeline;
  onAddStage: () => void;
  onEditStage: (s: PipelineStage) => void;
  onToggleActive: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = React.useState(pipeline.description);
  const [saving, setSaving] = React.useState(false);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{pipeline.name}</h2>
          <p className="text-xs text-foreground-muted">
            {pipeline.kind}
            {pipeline.isDefault ? " · default" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge tone={pipeline.isActive ? "success" : "neutral"}>
            {pipeline.isActive ? "Active" : "Inactive"}
          </StatusBadge>
          <Button size="sm" variant="outline" onClick={onToggleActive}>
            {pipeline.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button size="sm" onClick={onAddStage}>
            <Plus className="size-3.5" />
            Stage
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <div className="flex gap-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            loading={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  await crmApi.updatePipeline(pipeline.id, { description });
                  onSaved();
                  toast.success("Pipeline saved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save pipeline");
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {pipeline.stages
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {s.position}. {s.name}
                  {!s.isActive ? (
                    <span className="ml-2 text-[11px] text-foreground-subtle">inactive</span>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-foreground-muted">
                  {s.probability}% · {s.visualAccent}
                  {s.slaHours ? ` · SLA ${s.slaHours}h` : ""}
                  {s.requiredFields.length
                    ? ` · fields: ${s.requiredFields.join(", ")}`
                    : ""}
                  {s.requiredDocuments.length
                    ? ` · docs: ${s.requiredDocuments.join(", ")}`
                    : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onEditStage(s)}>
                Edit
              </Button>
            </li>
          ))}
      </ul>
    </section>
  );
}

function CreatePipelineDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (p: Pipeline) => void;
}) {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState("sales");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Create pipeline</ModalTitle>
          <ModalDescription>Stages are configured separately after creation.</ModalDescription>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" />
          </div>
          <div className="space-y-1.5">
            <Label required>Kind</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">sales</SelectItem>
                <SelectItem value="leads">leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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
                  const p = await crmApi.createPipeline({ name, kind, description });
                  onOpenChange(false);
                  setName("");
                  onCreated(p);
                  toast.success("Pipeline created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create pipeline");
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

function CreateStageDialog({
  open,
  onOpenChange,
  pipelineId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelineId: string;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [probability, setProbability] = React.useState("0");
  const [accent, setAccent] = React.useState("neutral");
  const [slaHours, setSlaHours] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add stage</ModalTitle>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Probability</Label>
              <Input value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SLA hours</Label>
              <Input value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Accent</Label>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["neutral", "slate", "blue", "teal", "green", "amber", "orange", "rose", "violet"].map(
                  (a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ),
                )}
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
                  await crmApi.createStage(pipelineId, {
                    name,
                    probability: Number(probability) || 0,
                    visualAccent: accent,
                    slaHours: slaHours ? Number(slaHours) : null,
                  });
                  onOpenChange(false);
                  setName("");
                  onCreated();
                  toast.success("Stage added");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not add stage");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Add stage
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function EditStageDialog({
  stage,
  open,
  onOpenChange,
  onSaved,
}: {
  stage: PipelineStage;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(stage.name);
  const [probability, setProbability] = React.useState(String(stage.probability));
  const [accent, setAccent] = React.useState(stage.visualAccent);
  const [slaHours, setSlaHours] = React.useState(stage.slaHours?.toString() ?? "");
  const [fields, setFields] = React.useState(stage.requiredFields.join(", "));
  const [activities, setActivities] = React.useState(stage.requiredActivities.join(", "));
  const [documents, setDocuments] = React.useState(stage.requiredDocuments.join(", "));
  const [active, setActive] = React.useState(stage.isActive);
  const [loading, setLoading] = React.useState(false);

  const split = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Edit stage</ModalTitle>
        </ModalHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label required>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required aria-required="true" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Probability</Label>
              <Input value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SLA hours</Label>
              <Input value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Accent</Label>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["neutral", "slate", "blue", "teal", "green", "amber", "orange", "rose", "violet"].map(
                  (a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Required fields</Label>
            <Input value={fields} onChange={(e) => setFields(e.target.value)} placeholder="value, source, expectedCloseAt" />
          </div>
          <div className="space-y-1.5">
            <Label>Required activities</Label>
            <Input value={activities} onChange={(e) => setActivities(e.target.value)} placeholder="call, email" />
          </div>
          <div className="space-y-1.5">
            <Label>Required documents</Label>
            <Input value={documents} onChange={(e) => setDocuments(e.target.value)} placeholder="passport, resume" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
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
                  await crmApi.updateStage(stage.id, {
                    name,
                    probability: Number(probability) || 0,
                    visualAccent: accent,
                    requiredFields: split(fields),
                    requiredActivities: split(activities),
                    requiredDocuments: split(documents),
                    slaHours: slaHours ? Number(slaHours) : null,
                    clearSla: !slaHours,
                    isActive: active,
                  });
                  onSaved();
                  toast.success("Stage saved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save stage");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            Save stage
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
