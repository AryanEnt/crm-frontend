"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { cn } from "@/lib/utils";

const HOURS_PER_DAY = 24;

const STAGE_COLORS = [
  { value: "neutral", label: "Gray" },
  { value: "slate", label: "Slate" },
  { value: "blue", label: "Blue" },
  { value: "teal", label: "Teal" },
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "orange", label: "Orange" },
  { value: "rose", label: "Rose" },
  { value: "violet", label: "Violet" },
] as const;

const colorLabel = (value: string) =>
  STAGE_COLORS.find((c) => c.value === value)?.label ?? value;

/** Admin UI edits follow-up limit in days; the API stores hours. */
function slaDaysLabel(slaHours: number | null | undefined): string {
  if (!slaHours || slaHours <= 0) return "";
  const days = slaHours / HOURS_PER_DAY;
  return Number.isInteger(days) ? String(days) : String(Math.round(days * 10) / 10);
}

function slaHoursFromDaysInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const days = Number(trimmed);
  if (!Number.isFinite(days) || days <= 0) return null;
  return Math.round(days * HOURS_PER_DAY);
}

function stageSummary(stage: PipelineStage): string {
  const parts: string[] = [];
  if (stage.slaHours) {
    const days = slaDaysLabel(stage.slaHours);
    parts.push(days === "1" ? "Follow up after 1 day" : `Follow up after ${days} days`);
  } else {
    parts.push("No follow-up timer");
  }
  parts.push(`${stage.probability}% win chance`);
  parts.push(colorLabel(stage.visualAccent));
  return parts.join(" · ");
}

type StageFormValues = {
  name: string;
  probability: string;
  slaDays: string;
  accent: string;
};

function StageFormFields({
  values,
  onChange,
  showActive,
  active,
  onActiveChange,
}: {
  values: StageFormValues;
  onChange: (patch: Partial<StageFormValues>) => void;
  showActive?: boolean;
  active?: boolean;
  onActiveChange?: (v: boolean) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="space-y-1.5">
        <Label required>Stage name</Label>
        <Input
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Cold lead, Contacted"
          required
          aria-required="true"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stage-follow-up-days">Follow up after (days)</Label>
        <Input
          id="stage-follow-up-days"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="e.g. 5"
          value={values.slaDays}
          onChange={(e) => onChange({ slaDays: e.target.value })}
        />
        <p className="text-[11px] leading-relaxed text-foreground-muted">
          How many days a lead can sit here before the team should act. Near the limit the card
          turns amber; after it, red. Leave empty if you don’t want a timer.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stage-win-chance">Win chance (%)</Label>
        <Input
          id="stage-win-chance"
          type="number"
          min="0"
          max="100"
          step="1"
          inputMode="numeric"
          placeholder="e.g. 10"
          value={values.probability}
          onChange={(e) => onChange({ probability: e.target.value })}
        />
        <p className="text-[11px] leading-relaxed text-foreground-muted">
          Rough chance a lead in this stage will eventually win. Early stages are low (10–20%);
          later stages are higher. Used for pipeline value estimates.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Column color</Label>
        <Select value={values.accent} onValueChange={(accent) => onChange({ accent })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_COLORS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-foreground-muted">Color used for this stage on the pipeline board.</p>
      </div>

      {showActive ? (
        <label className="flex items-start gap-2.5 rounded-md border border-border bg-surface-muted/40 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={active}
            onChange={(e) => onActiveChange?.(e.target.checked)}
          />
          <span>
            <span className="font-medium">Show on pipeline</span>
            <span className="mt-0.5 block text-[11px] text-foreground-muted">
              Turn off to hide this stage from the board without deleting it.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}

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

  const activePipelines = React.useMemo(
    () => (pipelinesQuery.data ?? []).filter((p) => p.isActive),
    [pipelinesQuery.data],
  );
  const selected =
    activePipelines.find((p) => p.id === selectedId) ?? activePipelines[0] ?? null;
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
        description="Set up pipeline columns, follow-up timers, and win chances for your team’s board."
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
            {activePipelines.map((p) => (
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

function sortedStages(stages: PipelineStage[]): PipelineStage[] {
  return stages.slice().sort((a, b) => a.position - b.position);
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
  const [stages, setStages] = React.useState(() => sortedStages(pipeline.stages));
  const [reordering, setReordering] = React.useState(false);
  const [busyStageId, setBusyStageId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PipelineStage | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setDescription(pipeline.description);
    setStages(sortedStages(pipeline.stages));
  }, [pipeline]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(stages, oldIndex, newIndex);
    const prev = stages;
    setStages(next);
    setReordering(true);
    void (async () => {
      try {
        await crmApi.reorderStages(
          pipeline.id,
          next.map((s) => s.id),
        );
        onSaved();
        toast.success("Stage order saved");
      } catch (err) {
        setStages(prev);
        toast.error(err instanceof Error ? err.message : "Couldn't reorder stages. Try again.");
      } finally {
        setReordering(false);
      }
    })();
  };

  const toggleStageVisibility = (stage: PipelineStage) => {
    if (busyStageId) return;
    setBusyStageId(stage.id);
    void (async () => {
      try {
        await crmApi.updateStage(stage.id, { isActive: !stage.isActive });
        onSaved();
        toast.success(stage.isActive ? "Stage hidden from the board" : "Stage shown on the board");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update the stage. Try again.");
      } finally {
        setBusyStageId(null);
      }
    })();
  };

  const confirmDelete = () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    void (async () => {
      try {
        await crmApi.deleteStage(deleteTarget.id);
        setDeleteTarget(null);
        onSaved();
        toast.success(`“${deleteTarget.name}” deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete the stage. Try again.");
      } finally {
        setDeleting(false);
      }
    })();
  };

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
                  toast.error(err instanceof Error ? err.message : "Couldn't save the pipeline. Try again.");
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

      <div className="space-y-1.5">
        <p className="text-[11px] text-foreground-muted">
          Drag the handle to change column order on the board. Hide removes a column from the board;
          Delete removes it for good.
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul
              className={cn(
                "divide-y divide-border rounded-md border border-border",
                reordering && "pointer-events-none opacity-70",
              )}
            >
              {stages.map((s, index) => (
                <SortableStageRow
                  key={s.id}
                  stage={s}
                  index={index + 1}
                  busy={busyStageId === s.id}
                  onEdit={() => onEditStage(s)}
                  onToggleVisibility={() => toggleStageVisibility(s)}
                  onDelete={() => setDeleteTarget(s)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.name ?? "stage"}”?`}
        description="This permanently removes the stage. Prefer Hide if you might need it again."
        confirmLabel="Delete stage"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

function SortableStageRow({
  stage,
  index,
  busy,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  stage: PipelineStage;
  index: number;
  busy?: boolean;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const locked = stage.isWon || stage.isLost;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 bg-surface px-2 py-2",
        isDragging && "relative z-10 rounded-md shadow-lift ring-1 ring-brand/30",
        !stage.isActive && "opacity-70",
      )}
    >
      <button
        type="button"
        className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-foreground-muted hover:bg-surface-muted hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Drag to reorder ${stage.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>
            {index}. {stage.name}
          </span>
          {stage.isWon ? <StatusBadge tone="success">Won</StatusBadge> : null}
          {stage.isLost ? <StatusBadge tone="danger">Lost</StatusBadge> : null}
          {!stage.isActive ? (
            <span className="text-[11px] text-foreground-subtle">hidden</span>
          ) : null}
        </p>
        <p className="truncate text-[11px] text-foreground-muted">{stageSummary(stage)}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        {!locked ? (
          <>
            <Button size="sm" variant="outline" loading={busy} onClick={onToggleVisibility}>
              {stage.isActive ? "Hide" : "Show"}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
    </li>
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
                  toast.error(err instanceof Error ? err.message : "Couldn't create the pipeline. Try again.");
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
  const [values, setValues] = React.useState<StageFormValues>({
    name: "",
    probability: "10",
    slaDays: "",
    accent: "neutral",
  });
  const [loading, setLoading] = React.useState(false);
  const patch = (next: Partial<StageFormValues>) => setValues((v) => ({ ...v, ...next }));

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add stage</ModalTitle>
          <ModalDescription>
            A stage is a column on the pipeline board. Set a follow-up timer so leads don’t sit untouched.
          </ModalDescription>
        </ModalHeader>
        <StageFormFields values={values} onChange={patch} />
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
                    name: values.name,
                    probability: Number(values.probability) || 0,
                    visualAccent: values.accent,
                    slaHours: slaHoursFromDaysInput(values.slaDays),
                    isWon: false,
                    isLost: false,
                  });
                  onOpenChange(false);
                  setValues({ name: "", probability: "10", slaDays: "", accent: "neutral" });
                  onCreated();
                  toast.success("Stage added");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't add the stage. Try again.");
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
  const [values, setValues] = React.useState<StageFormValues>({
    name: stage.name,
    probability: String(stage.probability),
    slaDays: slaDaysLabel(stage.slaHours),
    accent: stage.visualAccent,
  });
  const [active, setActive] = React.useState(stage.isActive);
  const [loading, setLoading] = React.useState(false);
  const patch = (next: Partial<StageFormValues>) => setValues((v) => ({ ...v, ...next }));

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Edit stage</ModalTitle>
          <ModalDescription>
            Change how this column works on the board — name, follow-up timer, win chance, and color.
          </ModalDescription>
        </ModalHeader>
        <StageFormFields
          values={values}
          onChange={patch}
          showActive
          active={active}
          onActiveChange={setActive}
        />
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
                  const slaHours = slaHoursFromDaysInput(values.slaDays);
                  await crmApi.updateStage(stage.id, {
                    name: values.name,
                    probability: Number(values.probability) || 0,
                    visualAccent: values.accent,
                    slaHours,
                    clearSla: slaHours == null,
                    isActive: active,
                  });
                  onSaved();
                  toast.success("Stage saved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't save the stage. Try again.");
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
