import {
  LayoutDashboard,
  UserPlus,
  Calendar,
  ListChecks,
  FileText,
  Filter,
  BarChart3,
  Target,
  TrendingUp,
  PieChart,
  UserCog,
  UsersRound,
  Layers,
  ScrollText,
  Settings,
  Search,
  Activity,
  Building2,
  Share2,
  Mail,
  Phone,
  Columns3,
  Globe2,
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
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: UserPlus },
      { label: "Pipeline", href: "/pipeline", icon: Columns3 },
    ],
  },
  {
    title: "Communications",
    items: [
      // { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
      { label: "Email", href: "/email", icon: Mail },
      { label: "Calls", href: "/calls", icon: Phone },
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
      { label: "Lead Population", href: "/lead-population", icon: Globe2 },
      // { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Targets", href: "/targets", icon: Target },
      // { label: "Forecasts", href: "/forecasts", icon: TrendingUp },
      // { label: "Reports", href: "/reports", icon: PieChart },
    ],
  },
  {
    title: "Team",
    items: [
      // Team Leads only see their own team, so there is no cross-team Teams page here.
      { label: "My team", href: "/admin/users", icon: UsersRound },
      { label: "Team email", href: "/email/team", icon: Mail },
      { label: "Referrals", href: "/admin/referrals", icon: Building2 },
    ],
  },
  {
    title: "Settings",
    items: [
      // { label: "WhatsApp accounts", href: "/settings/whatsapp", icon: MessageCircle },
      { label: "Email accounts", href: "/settings/email", icon: Mail },
      // { label: "Email templates", href: "/settings/email/templates", icon: FileText },
    ],
  },
];

/** Super Admin Control Center — governance & setup only. */
export const controlCenterNav: NavSection[] = [
  {
    title: "Control Center",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Find records", href: "/admin/lookup", icon: Search },
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
    title: "Setup",
    items: [
      { label: "Pipelines", href: "/admin/pipelines", icon: Layers },
      // { label: "Custom fields", href: "/admin/custom-fields", icon: FormInput },
      { label: "Lead sources", href: "/admin/lead-sources", icon: Share2 },
      { label: "Activity types", href: "/admin/activity-types", icon: ListChecks },
      { label: "Referrals", href: "/admin/referrals", icon: Building2 },
      // { label: "Automations", href: "/admin/automations", icon: Zap },
    ],
  },
  {
    title: "Governance",
    items: [
      // { label: "Audit log", href: "/admin/audit-logs", icon: ScrollText },
      { label: "Activity log", href: "/admin/system-activity", icon: Activity },
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Org analytics", href: "/admin/org-analytics", icon: BarChart3 },
      { label: "Lead Population", href: "/lead-population", icon: Globe2 },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "System settings", href: "/admin/settings", icon: Settings },
      { label: "Email sync", href: "/admin/gmail", icon: Mail },
    ],
  },
];

/** @deprecated Use getNavForRole — kept for any residual imports. */
export const mainNav = crmNav;

export function isSuperAdminRole(roleCode: string | undefined): boolean {
  return roleCode === ("super_admin" satisfies RoleCode);
}

const HIDDEN_FROM_SE = new Set(["/lead-population", "/email/team"]);
const TL_ONLY = new Set(["/email/team"]);

export function getNavForRole(roleCode: string | undefined): NavSection[] {
  if (isSuperAdminRole(roleCode)) return controlCenterNav;
  const hide = new Set<string>(
    roleCode === ("sales_manager" satisfies RoleCode) ? [] : [...TL_ONLY],
  );
  if (roleCode === ("sales_executive" satisfies RoleCode)) {
    for (const h of HIDDEN_FROM_SE) hide.add(h);
  }
  if (hide.size === 0) return crmNav;
  return crmNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !hide.has(item.href.split("?")[0] ?? item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.split("?")[0];
  if (path === "/dashboard") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}
