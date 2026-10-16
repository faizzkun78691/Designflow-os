import { Outlet } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  Send,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { AppShell, type NavItem } from "./AppShell";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/organizer/dashboard", icon: LayoutDashboard, end: true },
  { label: "All Tasks", to: "/organizer/all-tasks", icon: ClipboardList },
  { label: "New Task", to: "/organizer/tasks/new", icon: FilePlus2 },
  { label: "Approvals", to: "/organizer/approvals", icon: CheckCircle2 },
  { label: "Publishing Tracker", to: "/organizer/publishing", icon: Send },
  { label: "Team Management", to: "/organizer/team", icon: Users },
  { label: "Command Center", to: "/organizer/analytics", icon: BarChart3 },
  { label: "Leaderboard", to: "/organizer/leaderboard", icon: Trophy },
  { label: "Settings", to: "/organizer/settings", icon: Settings },
];

export function OrganizerLayout() {
  return (
    <AppShell navItems={navItems} sectionLabel="Organizer">
      <Outlet />
    </AppShell>
  );
}

export default OrganizerLayout;
