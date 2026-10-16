import { Outlet } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";
import { AppShell, type NavItem } from "./AppShell";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/lead/dashboard", icon: LayoutDashboard, end: true },
  { label: "My Created Tasks", to: "/lead/created", icon: FilePlus2 },
  { label: "New Task", to: "/lead/tasks/new", icon: Plus },
  { label: "Organizer Assignments", to: "/lead/assignments", icon: Inbox },
  { label: "Reviews", to: "/lead/reviews", icon: ClipboardCheck },
  { label: "Team Performance", to: "/lead/performance", icon: BarChart3 },
  { label: "Settings", to: "/lead/settings", icon: Settings },
];

export function TeamLeadLayout() {
  return (
    <AppShell navItems={navItems} sectionLabel="Team Lead">
      <Outlet />
    </AppShell>
  );
}

export default TeamLeadLayout;
