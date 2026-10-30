import { Suspense } from "react";
import { LeadPopulationView } from "@/features/analytics/lead-population-view";
import { KpiStripSkeleton } from "@/components/ui/skeleton";

export default function LeadPopulationPage() {
  return (
    <Suspense fallback={<KpiStripSkeleton count={4} className="md:grid-cols-4" />}>
      <LeadPopulationView />
    </Suspense>
  );
}
