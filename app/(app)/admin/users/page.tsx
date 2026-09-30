import { Suspense } from "react";
import { UsersAdminView } from "@/features/admin/users-admin-view";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <UsersAdminView />
    </Suspense>
  );
}
