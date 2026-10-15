"use client";

import { useAuth } from "@/features/auth/auth-provider";
import { isSuperAdminRole } from "@/lib/navigation";
import { ControlCenterDashboard } from "@/features/admin/control-center-dashboard";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (isSuperAdminRole(user?.roleCode)) {
    return <ControlCenterDashboard />;
  }

  return <DashboardView />;
}
