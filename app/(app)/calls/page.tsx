import { Suspense } from "react";
import { CallsWorkspace } from "@/features/calls/calls-workspace";
import { LoadingState } from "@/components/ui/loading-state";

export default function CallsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CallsWorkspace />
    </Suspense>
  );
}
