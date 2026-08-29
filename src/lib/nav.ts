// Single source of truth for the CRM's navigation — shared by the Sidebar
// (renders it) and the Header (derives the current page title from it) so
// the two can never disagree about what a route is called.
import {
  LayoutDashboard,
  Users,
  UserRound,
  PhoneCall,
  CalendarClock,
  Presentation,
  MessageSquare,
  Users2,
  BarChart3,
  FileBarChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// `href: null` means the feature has no dedicated cross-lead page yet in
// this backend (e.g. there is no "list every presentation across every
// lead" endpoint) — rendered as a clearly, calmly disabled item rather than
// a route that would 404 or show fabricated data. Real per-lead
// Presentations/Communications remain fully available from within a Lead's
// own detail page.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Leads", icon: Users, href: "/dashboard/leads" },
      { label: "Customers", icon: UserRound, href: null },
      { label: "Follow-ups", icon: PhoneCall, href: "/dashboard/follow-ups" },
      { label: "Meetings", icon: CalendarClock, href: "/dashboard/meetings" },
      { label: "Presentations", icon: Presentation, href: null },
      { label: "Communications", icon: MessageSquare, href: null },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Team", icon: Users2, href: "/dashboard/team" },
      { label: "Analytics", icon: BarChart3, href: null },
      { label: "Reports", icon: FileBarChart, href: null },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", icon: Settings, href: null }],
  },
];

export function findNavLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.href) continue;
      if (item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return "Dashboard";
}
