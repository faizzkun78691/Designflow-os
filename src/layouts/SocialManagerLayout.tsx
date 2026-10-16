import { Outlet } from "react-router-dom";
import {
  Archive,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  PencilLine,
  Rocket,
  Settings,
} from "lucide-react";
import { AppShell, type NavItem } from "./AppShell";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/social/dashboard", icon: LayoutDashboard, end: true },
  { label: "Publishing Studio", to: "/social/studio", icon: Rocket },
  { label: "Ready to Post", to: "/social/ready", icon: Megaphone },
  { label: "Scheduled", to: "/social/scheduled", icon: CalendarClock },
  { label: "Revision Requests", to: "/social/revisions", icon: PencilLine },
  { label: "Published Archive", to: "/social/published", icon: Archive },
  { label: "Calendar", to: "/social/calendar", icon: CalendarDays },
  { label: "Settings", to: "/social/settings", icon: Settings },
];

export function SocialManagerLayout() {
  return (
    <AppShell navItems={navItems} sectionLabel="Social Media Manager">
      <Outlet />
    </AppShell>
  );
}

export default SocialManagerLayout;
