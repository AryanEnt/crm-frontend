"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Pipeline } from "@/lib/api/crm";

export function PipelineHeader({
  pipelines,
  pipelineId,
  onPipelineChange,
  onCreate,
}: {
  pipelines: Pipeline[];
  pipelineId: string;
  onPipelineChange: (id: string) => void;
  onCreate?: () => void;
}) {
  const active = pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];
  const pipelineLabel = active?.name?.trim() || "Pipeline";

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-display tracking-tight text-ink">{pipelineLabel}</h1>
        <p className="mt-0.5 text-body text-ink-muted">
          {/nurtur/i.test(pipelineLabel)
            ? "Chase documents after a win."
            : "Tap a lead to work it. Drag to move the stage."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {pipelines.length > 1 ? (
          <Select value={pipelineId || undefined} onValueChange={onPipelineChange}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Pipeline">
              <SelectValue placeholder="Choose pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {onCreate ? (
          <Button onClick={onCreate} size="sm">
            <Plus className="size-4" aria-hidden />
            New lead
          </Button>
        ) : null}
      </div>
    </header>
  );
}
