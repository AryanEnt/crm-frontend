import { Suspense } from "react";
import { PipelinePage } from "@/features/pipeline/pipeline-page";
import { PipelineSkeleton } from "@/features/pipeline/pipeline-skeleton";

export default function PipelineRoute() {
  return (
    <Suspense fallback={<PipelineSkeleton />}>
      <PipelinePage />
    </Suspense>
  );
}
