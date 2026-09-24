"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { useAuth } from "@/features/auth/auth-provider";
import { canAccessPath } from "@/lib/permissions";
import { isSuperAdminRole } from "@/lib/navigation";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, permissions, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Super Admin should not land on sales-ops primary routes by default navigation,
  // but if they deep-link, permission gates still apply (read-only without write perms).
  const pathAllowed =
    !pathname || pathname === "/" || canAccessPath(permissions, pathname);

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <LoadingState label="Validating session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!pathAllowed) {
    return (
      <TooltipProvider delayDuration={200}>
        <AppShell>
          <ErrorState
            title="Access denied"
            description={
              isSuperAdminRole(user?.roleCode)
                ? "This sales workspace requires an operational permission you do not have. Use Control Center for governance and configuration."
                : "You do not have permission to view this page."
            }
            onRetry={() => router.replace("/")}
          />
        </AppShell>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell>{children}</AppShell>
    </TooltipProvider>
  );
}
