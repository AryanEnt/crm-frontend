import { Suspense } from "react";
import { NotificationsPage } from "@/features/notifications/notifications-page";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function NotificationsRoute() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <NotificationsPage />
    </Suspense>
  );
}
