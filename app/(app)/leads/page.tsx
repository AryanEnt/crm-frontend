import { Suspense } from "react";
import { LeadsTableView } from "@/features/leads/leads-table-view";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function LeadsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <LeadsTableView />
    </Suspense>
  );
}
