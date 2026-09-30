"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForRole, isNavActive, isSuperAdminRole, type NavItem } from "@/lib/navigation";
import { canAccessPath } from "@/lib/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { Avatar } from "@/components/ui/console/avatar";
import { IconButton } from "@/components/ui/console/button";
import { Tooltip } from "@/components/ui/console/tooltip";
import { BrandMark } from "./brand-mark";
import { useNavCounts } from "./use-nav-counts";

type SidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function filterItems(items: NavItem[], permissions: string[]) {
  return items.filter((item) => canAccessPath(permissions, item.href.split("?")[0]));
}

/** Room for Next's dev-only indicator, which floats over the bottom-left corner. */
const DEV_INDICATOR_SPACE = process.env.NODE_ENV === "development" ? "pb-16" : undefined;

export function Sidebar({ collapsed, onCollapsedChange, mobileOpen, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const { permissions, user } = useAuth();
  const isControlCenter = isSuperAdminRole(user?.roleCode);
  const nav = getNavForRole(user?.roleCode);
  const counts = useNavCounts(permissions);
  const brandLabel = isControlCenter ? "Control Center" : "Aurora CRM";
  const brandMark = isControlCenter ? "CC" : "A";

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileOpenChange]);

  const closeMobile = () => onMobileOpenChange(false);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay transition-opacity duration-200 ease-standard starting:opacity-0 lg:hidden"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface",
          "transition-[width,translate] duration-200 ease-standard",
          collapsed ? "w-(--sidebar-collapsed-width)" : "w-(--sidebar-width)",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-(--header-height) shrink-0 items-center border-b border-line px-3",
            collapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          <Link
            href="/"
            onClick={closeMobile}
            aria-label={collapsed ? brandLabel : undefined}
            className="flex min-w-0 items-center gap-2.5 rounded-control transition-opacity duration-150 hover:opacity-90"
          >
            <BrandMark label={brandMark} />
            {collapsed ? null : (
              <span className="min-w-0">
                <span className="block truncate text-cell font-semibold tracking-tight text-ink">{brandLabel}</span>
                <span className="block truncate text-caption text-ink-muted">
                  {isControlCenter ? "Admin console" : "Sales workspace"}
                </span>
              </span>
            )}
          </Link>
          <IconButton label="Close menu" size="sm" tooltip={false} className="lg:hidden" onClick={closeMobile}>
            <X />
          </IconButton>
        </div>

        <nav aria-label="Primary" className="crm-scroll flex-1 overflow-y-auto px-2.5 pb-3 pt-2">
          {nav.map((section, sectionIndex) => {
            const items = filterItems(section.items, permissions);
            if (items.length === 0) return null;
            const headingId = `nav-section-${sectionIndex}`;
            return (
              <div key={section.title ?? `section-${sectionIndex}`} className={cn(sectionIndex > 0 && "mt-5")}>
                {section.title && !collapsed ? (
                  <p id={headingId} className="mb-1 px-2.5 text-overline text-ink-muted">
                    {section.title}
                  </p>
                ) : null}
                {section.title && collapsed && sectionIndex > 0 ? (
                  <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line" />
                ) : null}
                <ul className="space-y-0.5" aria-labelledby={section.title && !collapsed ? headingId : undefined}>
                  {items.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <NavLink
                        item={item}
                        active={isNavActive(pathname, item.href)}
                        collapsed={collapsed}
                        count={counts[item.href]}
                        onNavigate={closeMobile}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className={cn("mt-auto shrink-0 space-y-1 border-t border-line p-2.5", DEV_INDICATOR_SPACE)}>
          {user ? (
            collapsed ? (
              <Tooltip content={`${user.fullName} · ${user.roleName || user.roleCode}`} side="right">
                <span className="mx-auto flex w-fit rounded-full">
                  <Avatar name={user.fullName} label={user.fullName} />
                </span>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2.5 rounded-control px-2 py-1.5">
                <Avatar name={user.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-cell font-medium text-ink">{user.fullName}</p>
                  <p className="truncate text-caption text-ink-muted">{user.roleName || user.roleCode}</p>
                </div>
              </div>
            )
          ) : null}

          <Tooltip content="Expand sidebar" side="right" disabled={!collapsed}>
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden h-8 w-full items-center gap-2 rounded-control px-2.5 text-caption font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-muted hover:text-ink lg:flex",
                collapsed && "justify-center px-0",
              )}
            >
              {collapsed ? (
                <ChevronsRight aria-hidden className="size-4" />
              ) : (
                <>
                  <ChevronsLeft aria-hidden className="size-4" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-control px-2.5 text-cell font-medium transition-colors duration-150 ease-standard",
        collapsed && "justify-center px-0",
        active ? "bg-surface-muted text-ink" : "text-ink-secondary hover:bg-surface-muted/60 hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-2.5 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-brand transition-opacity duration-150 ease-standard",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0 transition-colors duration-150",
          active ? "text-brand" : "text-ink-muted group-hover:text-ink",
        )}
        strokeWidth={active ? 2.25 : 2}
      />
      {collapsed ? null : (
        <>
          <span className="min-w-0 flex-1 truncate tracking-tight">{item.label}</span>
          {count !== undefined ? (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-medium tabular-nums",
                active ? "bg-surface text-ink-secondary" : "bg-surface-muted text-ink-muted",
              )}
            >
              {count}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip content={count !== undefined ? `${item.label} · ${count}` : item.label} side="right" delay={150}>
      {link}
    </Tooltip>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Open navigation" tooltip={false} className="lg:hidden" onClick={onClick}>
      <Menu />
    </IconButton>
  );
}
