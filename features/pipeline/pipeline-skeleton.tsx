import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStatsSkeleton } from "./pipeline-stats";

export function PipelineBoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="-mx-1 flex gap-3 overflow-hidden px-1 pb-4" aria-hidden>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="w-[288px] shrink-0 rounded-column bg-column-tint">
          <div className="space-y-2 px-3.5 pb-2.5 pt-3.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-2 px-2.5 pb-2.5">
            {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
              <div key={j} className="space-y-2.5 rounded-card border border-line/70 bg-surface p-3 shadow-card">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="ml-auto size-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Same layout as the loaded page, so nothing jumps when data arrives. */
export function PipelineSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading pipeline" aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <PipelineStatsSkeleton />
      <div className="flex flex-wrap items-center gap-2" aria-hidden>
        <Skeleton className="h-9 w-full rounded-full sm:w-72" />
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <PipelineBoardSkeleton />
    </div>
  );
}
