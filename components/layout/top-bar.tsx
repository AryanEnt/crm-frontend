"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Monitor, Moon, Search, Sun, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import { useQuickCreateOptional } from "@/components/forms/quick-create-provider";
import { useDensity } from "@/lib/density";
import { useTheme } from "@/lib/theme";
import { Avatar } from "@/components/ui/console/avatar";
import { IconButton } from "@/components/ui/console/button";
import { Kbd } from "@/components/ui/console/command-palette";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/console/dropdown-menu";
import { MobileMenuButton } from "@/components/layout/sidebar";
import { CommandMenu, useModKey } from "@/components/layout/command-menu";

type TopBarProps = {
  onMenuClick: () => void;
  className?: string;
};

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const NOTIFICATIONS = [
  "New lead assigned: Meridian Labs",
  "Deal moved to Negotiation",
  "Follow-up due in 30 minutes",
];

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const [command, setCommand] = React.useState({ open: false, session: 0 });
  const { user, logout } = useAuth();
  const router = useRouter();
  const quickCreate = useQuickCreateOptional();
  const { density, setDensity } = useDensity();
  const { preference, setPreference } = useTheme();
  const modKey = useModKey();

  const setCommandOpen = React.useCallback((open: boolean) => {
    setCommand((prev) =>
      open && !prev.open ? { open: true, session: prev.session + 1 } : { ...prev, open },
    );
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommand((prev) =>
          prev.open ? { ...prev, open: false } : { open: true, session: prev.session + 1 },
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex h-(--header-height) items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur-sm sm:px-4",
          className,
        )}
      >
        <MobileMenuButton onClick={onMenuClick} />

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-keyshortcuts="Control+K Meta+K"
          className="hidden h-8 w-full max-w-md min-w-0 items-center gap-2 rounded-control border border-line bg-surface-sunken px-2.5 text-body text-ink-muted transition-colors duration-150 ease-standard hover:border-line-strong hover:text-ink-secondary md:flex"
        >
          <Search aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">Search or jump to…</span>
          <span aria-hidden className="flex items-center gap-0.5">
            <Kbd>{modKey}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <IconButton label="Search" className="md:hidden" onClick={() => setCommandOpen(true)}>
          <Search />
        </IconButton>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <IconButton label="Notifications" tooltip={false} className="relative">
                <Bell />
                <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label="Notifications" className="w-72">
              <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                <span className="text-overline text-ink-muted">Notifications</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-soft px-1.5 text-caption font-medium tabular-nums text-brand-ink">
                  {NOTIFICATIONS.length}
                </span>
              </div>
              <DropdownMenuSeparator />
              {NOTIFICATIONS.map((text) => (
                <DropdownMenuItem key={text} className="h-auto py-1.5 text-ink-secondary">
                  {text}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                aria-label={`Account menu for ${user?.fullName ?? "user"}`}
                className="ml-1 inline-flex items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-150 ease-standard hover:bg-surface-muted"
              >
                <Avatar name={user?.fullName ?? "User"} />
                <span className="hidden text-left sm:block">
                  <span className="block text-caption font-medium leading-tight text-ink">
                    {user?.fullName ?? "User"}
                  </span>
                  <span className="block text-caption leading-tight text-ink-muted">{user?.roleName ?? ""}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label="Account" className="w-60">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Avatar name={user?.fullName ?? "User"} />
                <div className="min-w-0">
                  <p className="truncate text-cell font-medium text-ink">{user?.fullName ?? "User"}</p>
                  <p className="truncate text-caption text-ink-muted">{user?.email ?? ""}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={User} onSelect={() => router.push("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              {THEMES.map((theme) => (
                <DropdownMenuRadioItem
                  key={theme.value}
                  icon={theme.icon}
                  checked={preference === theme.value}
                  onSelect={() => setPreference(theme.value)}
                >
                  {theme.label}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={density === "compact"}
                onCheckedChange={(checked) => setDensity(checked ? "compact" : "comfortable")}
              >
                Compact rows
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                icon={LogOut}
                tone="danger"
                onSelect={() => {
                  void (async () => {
                    await logout();
                    router.replace("/login");
                    router.refresh();
                  })();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {command.session > 0 ? (
        <CommandMenu
          key={command.session}
          open={command.open}
          onOpenChange={setCommandOpen}
          onQuickCreate={quickCreate?.openCreate}
        />
      ) : null}
    </>
  );
}
