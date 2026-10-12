import { Suspense } from "react";
import { LeadsWorkspace } from "@/features/leads/leads-workspace";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function LeadsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} cols={7} />}>
      <LeadsWorkspace />
    </Suspense>
  );
}
