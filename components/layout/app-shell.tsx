"use client";

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { DensityProvider } from "@/lib/density";
import { QuickCreateProvider } from "@/components/forms/quick-create-provider";

const COLLAPSE_KEY = "crm.sidebar.collapsed";
const COLLAPSE_EVENT = "crm-sidebar-collapse";

function subscribe(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener("storage", handler);
  window.addEventListener(COLLAPSE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(COLLAPSE_EVENT, handler);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = React.useSyncExternalStore(subscribe, getSnapshot, () => false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <DensityProvider>
      <QuickCreateProvider>
        <div className="min-h-full bg-background">
          <Suspense fallback={null}>
            <Sidebar
              collapsed={collapsed}
              onCollapsedChange={setCollapsed}
              mobileOpen={mobileOpen}
              onMobileOpenChange={setMobileOpen}
            />
          </Suspense>
          <div
            className={cn(
              "flex min-h-full flex-col transition-[padding] duration-200",
              "lg:pl-[var(--sidebar-width)]",
              collapsed && "lg:pl-[var(--sidebar-collapsed-width)]",
            )}
          >
            <TopBar onMenuClick={() => setMobileOpen(true)} />
            <main className="flex-1 px-3 py-4 sm:px-4 lg:px-5">{children}</main>
          </div>
        </div>
      </QuickCreateProvider>
    </DensityProvider>
  );
}
