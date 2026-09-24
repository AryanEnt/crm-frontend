"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PipelineBoardView } from "@/features/pipelines/pipeline-board-view";
import { DealsTableView } from "@/features/deals/deals-table-view";
import { DealsViewToggle, type DealsViewMode } from "@/features/deals/deals-view-toggle";

export function DealsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: DealsViewMode = searchParams.get("view") === "form" ? "form" : "board";
  const pipelineId = searchParams.get("pipeline") ?? "";

  const patchQuery = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setView = React.useCallback(
    (next: DealsViewMode) => {
      patchQuery({ view: next === "board" ? null : "form" });
    },
    [patchQuery],
  );

  const setPipelineId = React.useCallback(
    (id: string) => {
      patchQuery({ pipeline: id || null });
    },
    [patchQuery],
  );

  const toggle = <DealsViewToggle value={view} onChange={setView} />;

  if (view === "form") {
    return (
      <DealsTableView
        viewToggle={toggle}
        pipelineId={pipelineId}
        onPipelineIdChange={setPipelineId}
      />
    );
  }

  return (
    <PipelineBoardView
      viewToggle={toggle}
      pipelineId={pipelineId}
      onPipelineIdChange={setPipelineId}
    />
  );
}
