import { Suspense } from "react";
import { DealsWorkspace } from "@/features/deals/deals-workspace";
import { LoadingState } from "@/components/ui/loading-state";

export default function DealsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading deals…" />}>
      <DealsWorkspace />
    </Suspense>
  );
}
