import {
  LayoutDashboard,
  UserPlus,
  Users,
  Handshake,
  Calendar,
  ListChecks,
  FileText,
  Filter,
  BarChart3,
  Target,
  TrendingUp,
  PieChart,
  Sparkles,
  UserCog,
  UsersRound,
  Layers,
  FormInput,
  Zap,
  ScrollText,
  Settings,
  Search,
  Activity,
  Building2,
  Share2,
  ListTree,
  Mail,
  type LucideIcon,
} from "lucide-react";
import type { RoleCode } from "@/features/auth/types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

/** CRM operations navigation — Manager / SE / Support. */
export const crmNav: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Leads", href: "/leads", icon: UserPlus },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Deals", href: "/deals", icon: Handshake },
      { label: "Email", href: "/email", icon: Mail },
    ],
  },
  {
    title: "Schedule",
    items: [
      { label: "Calendar", href: "/calendar", icon: Calendar },
      { label: "Activities", href: "/activities", icon: ListChecks },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Sales Funnel", href: "/sales-funnel", icon: Filter },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Targets", href: "/targets", icon: Target },
      { label: "Forecasts", href: "/forecasts", icon: TrendingUp },
      { label: "Insights", href: "/insights", icon: Sparkles },
      { label: "Reports", href: "/reports", icon: PieChart },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "Teams", href: "/admin/teams", icon: UsersRound },
      { label: "Referrals", href: "/admin/referrals", icon: Building2 },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Email accounts", href: "/settings/email", icon: Mail },
      { label: "Email templates", href: "/settings/email/templates", icon: FileText },
    ],
  },
];

/** Super Admin Control Center — governance & configuration only. */
export const controlCenterNav: NavSection[] = [
  {
    title: "Control Center",
    items: [
      { label: "Overview", href: "/", icon: LayoutDashboard },
      { label: "Record Lookup", href: "/admin/lookup", icon: Search },
    ],
  },
  {
    title: "Organization",
    items: [
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "Teams", href: "/admin/teams", icon: UsersRound },
    ],
  },
  {
    title: "CRM Configuration",
    items: [
      { label: "Pipelines", href: "/admin/pipelines", icon: Layers },
      { label: "Stages", href: "/admin/pipelines?tab=stages", icon: ListTree },
      { label: "Custom Fields", href: "/admin/custom-fields", icon: FormInput },
      { label: "Lead Sources", href: "/admin/lead-sources", icon: Share2 },
      { label: "Activity Types", href: "/admin/activity-types", icon: ListChecks },
      { label: "Referrals", href: "/admin/referrals", icon: Building2 },
      { label: "Automations", href: "/admin/automations", icon: Zap },
    ],
  },
  {
    title: "Governance",
    items: [
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
      { label: "System Activity", href: "/admin/system-activity", icon: Activity },
      { label: "Organization Analytics", href: "/admin/org-analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "System Settings", href: "/admin/settings", icon: Settings },
      { label: "Gmail", href: "/admin/gmail", icon: Mail },
    ],
  },
];

/** @deprecated Use getNavForRole — kept for any residual imports. */
export const mainNav = crmNav;

export function isSuperAdminRole(roleCode: string | undefined): boolean {
  return roleCode === ("super_admin" satisfies RoleCode);
}

export function getNavForRole(roleCode: string | undefined): NavSection[] {
  return isSuperAdminRole(roleCode) ? controlCenterNav : crmNav;
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
