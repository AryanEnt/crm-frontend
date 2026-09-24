"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { LeadCreateDrawer } from "@/features/leads/lead-create-drawer";
import { CustomerCreateDrawer } from "@/features/customers/customer-create-drawer";
import { ActivityQuickCreateDialog } from "@/features/activities/activity-quick-create";
import { DealQuickCreateDrawer } from "@/features/deals/deal-quick-create";

type Entity = "lead" | "customer" | "deal" | "activity";

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
  const [customerOpen, setCustomerOpen] = React.useState(false);
  const [dealOpen, setDealOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);

  const openCreate = React.useCallback(
    (entity: Entity) => {
      if (entity === "lead" && can("leads:create")) setLeadOpen(true);
      else if (entity === "customer" && can("customers:create")) setCustomerOpen(true);
      else if (entity === "deal" && can("deals:create")) setDealOpen(true);
      else if (entity === "activity" && can("activities:create")) setActivityOpen(true);
      else if (entity === "lead") router.push("/leads");
      else if (entity === "customer") router.push("/customers");
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
      <LeadCreateDrawer
        open={leadOpen}
        onOpenChange={setLeadOpen}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["leads"] })}
      />
      <CustomerCreateDrawer
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["customers"] })}
      />
      <DealQuickCreateDrawer
        open={dealOpen}
        onOpenChange={setDealOpen}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["deals"] })}
      />
      <ActivityQuickCreateDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        onCreated={() => void qc.invalidateQueries({ queryKey: ["activities"] })}
      />
    </QuickCreateContext.Provider>
  );
}
