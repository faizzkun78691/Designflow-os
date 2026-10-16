import { Outlet } from "react-router-dom";
import {
  Briefcase,
  History,
  LayoutDashboard,
  ListTodo,
  Settings,
  TrendingUp,
  Trophy,
  Upload,
} from "lucide-react";
import { AppShell, type NavItem } from "./AppShell";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/designer/dashboard", icon: LayoutDashboard, end: true },
  { label: "My Tasks", to: "/designer/my-tasks", icon: ListTodo },
  { label: "Available Tasks", to: "/designer/available", icon: Briefcase },
  { label: "Revisions", to: "/designer/revisions", icon: History },
  { label: "Submissions", to: "/designer/submissions", icon: Upload },
  { label: "My Performance", to: "/designer/performance", icon: TrendingUp },
  { label: "Leaderboard", to: "/designer/leaderboard", icon: Trophy },
  { label: "Settings", to: "/designer/settings", icon: Settings },
];

export function DesignerLayout() {
  return (
    <AppShell navItems={navItems} sectionLabel="Designer">
      <Outlet />
    </AppShell>
  );
}

export default DesignerLayout;
