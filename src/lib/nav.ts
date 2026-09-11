// Single source of truth for the CRM's navigation — shared by the Sidebar
// (renders it) and the Header (derives the current page title from it) so
// the two can never disagree about what a route is called.
//
// Deliberately only the pages that actually exist and get used. The nav
// used to carry placeholder entries (Customers, Presentations,
// Communications, Analytics, Reports, Settings) that had no route and
// rendered as permanently-disabled items — visual noise pretending to be
// features. Per-lead communications, meetings, rooms and follow-ups all
// live on the lead's own page, which is where the work actually happens.
import { LayoutDashboard, Users, UserCheck, PhoneCall, CalendarClock, Users2, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      // The pipeline is split by status (see LeadListView): Leads holds
      // New and Lost, Good Leads the ones being worked.
      { label: "Leads", icon: Users, href: "/dashboard/leads" },
      { label: "Good Leads", icon: UserCheck, href: "/dashboard/good-leads" },
      { label: "Follow-ups", icon: PhoneCall, href: "/dashboard/follow-ups" },
      { label: "Meetings", icon: CalendarClock, href: "/dashboard/meetings" },
    ],
  },
  {
    label: "Management",
    items: [{ label: "Team", icon: Users2, href: "/dashboard/team" }],
  },
];

export function findNavLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item.label;
      }
    }
  }
  return "Dashboard";
}
