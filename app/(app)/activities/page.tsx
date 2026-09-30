import { Suspense } from "react";
import { ActivitiesTableView } from "@/features/activities/activities-table-view";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <ActivitiesTableView />
    </Suspense>
  );
}
