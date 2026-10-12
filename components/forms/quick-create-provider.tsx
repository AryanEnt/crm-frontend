"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { CreateLeadSheet } from "@/features/leads/create/create-lead-sheet";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";

type Entity = "lead" | "activity";

type QuickCreateContextValue = {
  openCreate: (entity: Entity) => void;
};

const QuickCreateContext = React.createContext<QuickCreateContextValue | null>(null);

export function useQuickCreate() {
  const ctx = React.useContext(QuickCreateContext);
  if (!ctx) throw new Error("useQuickCreate must be used within QuickCreateProvider");
  return ctx;
}

export function useQuickCreateOptional() {
  return React.useContext(QuickCreateContext);
}

export function QuickCreateProvider({ children }: { children: React.ReactNode }) {
  const { can } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [leadOpen, setLeadOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);

  const openCreate = React.useCallback(
    (entity: Entity) => {
      if (entity === "lead" && can("leads:create")) setLeadOpen(true);
      else if (entity === "activity" && can("activities:create")) setActivityOpen(true);
      else if (entity === "lead") router.push("/leads");
    },
    [can, router],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "c" && can("leads:create")) {
        e.preventDefault();
        setLeadOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [can]);

  return (
    <QuickCreateContext.Provider value={{ openCreate }}>
      {children}
      <CreateLeadSheet open={leadOpen} onOpenChange={setLeadOpen} />
      <ActivityQuickCreateDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["activities"] })}
      />
    </QuickCreateContext.Provider>
  );
}
