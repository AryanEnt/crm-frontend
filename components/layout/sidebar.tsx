"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu, PanelLeftClose, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForRole, isNavActive, isSuperAdminRole, type NavItem } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

type SidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function filterItems(items: NavItem[], permissions: string[]) {
  return items.filter((item) => {
    const path = item.href.split("?")[0];
    return canAccessPath(permissions, path);
  });
}

function initialsFromName(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname();
  const { permissions, user } = useAuth();
  const isControlCenter = isSuperAdminRole(user?.roleCode);
  const nav = getNavForRole(user?.roleCode);
  const brandLabel = isControlCenter ? "Control Center" : "Aurora CRM";
  const brandMark = isControlCenter ? "CC" : "A";

  return (
    <TooltipProvider delayDuration={200}>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px] transition-opacity lg:hidden"
          aria-label="Close navigation"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-surface",
          "transition-[width,transform] duration-200 ease-out",
          collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "relative flex h-[var(--header-height)] items-center border-b border-sidebar-border px-3",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Link
            href="/"
            className={cn(
              "group flex min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] outline-none transition-opacity hover:opacity-90",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              collapsed && "justify-center",
            )}
            onClick={() => onMobileOpenChange(false)}
          >
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-brand text-[12px] font-bold tracking-tight text-primary-foreground">
              {brandMark}
            </span>
            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold tracking-tight text-foreground">
                  {brandLabel}
                </span>
                <span className="block truncate text-[10px] font-medium text-foreground-subtle">
                  {isControlCenter ? "Admin console" : "Sales workspace"}
                </span>
              </span>
            ) : null}
          </Link>
          <IconButton
            label="Close menu"
            size="sm"
            className="lg:hidden"
            onClick={() => onMobileOpenChange(false)}
          >
            <X className="size-4" />
          </IconButton>
        </div>

        <nav
          className="crm-scroll flex-1 overflow-y-auto px-2.5 py-3"
          aria-label="Primary"
        >
          {nav.map((section, sectionIndex) => {
            const items = filterItems(section.items, permissions);
            if (items.length === 0) return null;
            return (
              <div
                key={section.title ?? `section-${sectionIndex}`}
                className={cn(sectionIndex > 0 && "mt-4")}
              >
                {section.title && !collapsed ? (
                  <p className="mb-1.5 px-2.5 text-label">{section.title}</p>
                ) : null}
                {section.title && collapsed && sectionIndex > 0 ? (
                  <Separator className="mx-auto my-2 w-6" />
                ) : null}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    const link = (
                      <Link
                        href={item.href}
                        onClick={() => onMobileOpenChange(false)}
                        className={cn(
                          "group relative flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13px] font-medium transition-colors duration-150",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-sidebar-active text-sidebar-active-text"
                            : "text-foreground-muted hover:bg-sidebar-hover hover:text-foreground",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {active ? (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-brand"
                          />
                        ) : null}
                        <item.icon
                          className={cn(
                            "size-[17px] shrink-0 transition-colors",
                            active
                              ? "text-brand-ink"
                              : "text-foreground-subtle group-hover:text-foreground",
                          )}
                          strokeWidth={active ? 2.25 : 2}
                        />
                        {!collapsed ? (
                          <span className="truncate tracking-tight">{item.label}</span>
                        ) : null}
                      </Link>
                    );

                    return (
                      <li key={`${item.href}-${item.label}`}>
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{link}</TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          link
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-sidebar-border bg-surface p-2.5">
          {!collapsed && user ? (
            <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-canvas px-2.5 py-2">
              <Avatar size="sm">
                <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-brand-ink">
                  {initialsFromName(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold leading-tight text-foreground">
                  {user.fullName}
                </p>
                <p className="truncate text-[10px] leading-tight text-foreground-subtle">
                  {user.roleName || user.roleCode}
                </p>
              </div>
            </div>
          ) : null}

          {collapsed && user ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mx-auto flex justify-center">
                  <Avatar size="sm">
                    <AvatarFallback className="bg-brand-soft text-[10px] font-semibold text-brand-ink">
                      {initialsFromName(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-medium">{user.fullName}</p>
                <p className="text-foreground-subtle">{user.roleName || user.roleCode}</p>
              </TooltipContent>
            </Tooltip>
          ) : null}

          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "hidden h-9 w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-[12px] font-medium text-foreground-muted transition-colors",
              "hover:bg-sidebar-hover hover:text-foreground lg:flex",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                <span>Collapse</span>
                <ChevronsLeft className="ml-auto size-3.5 opacity-50" />
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Open navigation" className="lg:hidden" onClick={onClick}>
      <Menu className="size-4" />
    </IconButton>
  );
}
