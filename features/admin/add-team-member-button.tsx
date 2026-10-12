"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { ToastProvider, useToast } from "@/components/ui/console/toast";
import { TeamMemberDrawer } from "./team-member-drawer";
import { displayName } from "./users-table-cells";

/** Team Lead shortcut to add a Sales Executive to their own team from anywhere in the workspace. */
export function AddTeamMemberButton({ teamName }: { teamName: string | undefined }) {
  return (
    <ToastProvider>
      <AddTeamMember teamName={teamName} />
    </ToastProvider>
  );
}

function AddTeamMember({ teamName }: { teamName: string | undefined }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [drawer, setDrawer] = React.useState({ open: false, key: 0 });

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: adminApi.listRoles });
  const salesExecutiveRoleId = rolesQuery.data?.find((role) => role.code === "sales_executive")?.id;

  const close = () => setDrawer((prev) => ({ ...prev, open: false }));

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDrawer((prev) => ({ open: true, key: prev.key + 1 }))}
      >
        <UserPlus className="size-3.5" />
        Add member
      </Button>

      {drawer.key > 0 ? (
        <TeamMemberDrawer
          key={drawer.key}
          open={drawer.open}
          onOpenChange={(open) => {
            if (!open) close();
          }}
          member={null}
          teamName={teamName}
          salesExecutiveRoleId={salesExecutiveRoleId}
          onSaved={async (saved) => {
            await Promise.all([
              qc.invalidateQueries({ queryKey: ["users"] }),
              qc.invalidateQueries({ queryKey: ["team-members"] }),
              qc.invalidateQueries({ queryKey: ["dashboard-team"] }),
            ]);
            close();
            toast.success("Sales Executive added", {
              description: `${displayName(saved.fullName)} can sign in with ${saved.email}.`,
            });
          }}
        />
      ) : null}
    </>
  );
}
