"use client";

import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
  /** Omitted when the user can't create leads. */
  onCreate?: () => void;
}) {
  return (
    <PageHeader
      display
      className="mb-0"
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Pipeline" }]}
      title="Pipeline"
      description="Move leads from first contact to a decision."
      actions={
        <>
          {pipelines.length > 1 ? (
            <Select value={pipelineId || undefined} onValueChange={onPipelineChange}>
              <SelectTrigger className="h-9 w-[190px]" aria-label="Pipeline">
                <SelectValue placeholder="Pipeline" />
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
            <Button onClick={onCreate}>
              <Plus className="size-4" />
              New lead
            </Button>
          ) : null}
        </>
      }
    />
  );
}
