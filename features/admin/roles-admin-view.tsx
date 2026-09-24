"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { adminApi } from "@/lib/api/admin";

const ROLE_ORDER = ["super_admin", "sales_manager", "sales_executive", "sales_support"];

export function RolesAdminView() {
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: adminApi.listRoles });

  if (rolesQuery.isLoading) return <LoadingState />;
  if (rolesQuery.isError) {
    return <ErrorState onRetry={() => void rolesQuery.refetch()} />;
  }

  const roles = [...(rolesQuery.data ?? [])].sort(
    (a, b) => ROLE_ORDER.indexOf(a.code) - ROLE_ORDER.indexOf(b.code),
  );

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[{ label: "Control Center", href: "/" }, { label: "Roles & Permissions" }]}
        title="Roles & Permissions"
        description="Permissions use resource:action and are enforced server-side. Super Admin is governance-only — operational CRM permissions belong to sales roles."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {roles.map((role) => (
          <section
            key={role.id}
            className="rounded-lg border border-border bg-surface p-3.5 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{role.name}</h2>
                <p className="mt-0.5 text-xs text-foreground-muted">{role.description}</p>
              </div>
              <StatusBadge tone="brand">{role.code}</StatusBadge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <span className="text-xs text-foreground-muted">No permissions assigned</span>
              ) : (
                role.permissions
                  .slice()
                  .sort()
                  .map((perm) => (
                    <StatusBadge
                      key={perm}
                      tone={
                        role.code === "super_admin" &&
                        /^(leads|customers|deals|activities|documents|communications):(create|edit|delete|send|assign)/.test(
                          perm,
                        )
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {perm}
                    </StatusBadge>
                  ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
