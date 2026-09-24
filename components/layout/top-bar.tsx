"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Search, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandSearch } from "@/components/ui/command-search";
import { MobileMenuButton } from "@/components/layout/sidebar";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-provider";
import { useQuickCreateOptional } from "@/components/forms/quick-create-provider";

type TopBarProps = {
  onMenuClick: () => void;
  className?: string;
};

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const quickCreate = useQuickCreateOptional();

  const initials =
    user?.fullName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 border-b border-border bg-surface/95 px-3 backdrop-blur-sm sm:px-4",
          className,
        )}
      >
        <MobileMenuButton onClick={onMenuClick} />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="relative hidden min-w-0 flex-1 max-w-md md:block"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground-subtle" />
          <Input
            readOnly
            placeholder="Search or jump to…"
            className="pointer-events-none cursor-pointer bg-surface-muted/60 pl-8 pr-16"
            tabIndex={-1}
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-foreground-subtle">
            ⌘K
          </kbd>
        </button>

        <IconButton label="Search" className="md:hidden" onClick={() => setCommandOpen(true)}>
          <Search className="size-4" />
        </IconButton>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Notifications" className="relative">
                <Bell className="size-4" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                <StatusBadge tone="brand">3</StatusBadge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-1 px-1 py-1">
                {[
                  "New lead assigned: Meridian Labs",
                  "Deal moved to Negotiation",
                  "Follow-up due in 30 minutes",
                ].map((n) => (
                  <div
                    key={n}
                    className="rounded-md px-2 py-1.5 text-xs text-foreground-muted hover:bg-surface-muted"
                  >
                    {n}
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 inline-flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar size="sm">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-medium leading-tight text-foreground">
                    {user?.fullName ?? "User"}
                  </span>
                  <span className="block text-[10px] leading-tight text-foreground-subtle">
                    {user?.roleName ?? ""}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="size-3.5" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-3.5" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() => {
                  void (async () => {
                    await logout();
                    router.replace("/login");
                    router.refresh();
                  })();
                }}
              >
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandSearch
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onQuickCreate={quickCreate?.openCreate}
      />
    </>
  );
}
