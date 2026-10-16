import type { AppRole } from "../types";

export const ROLE_LABELS: Record<AppRole, string> = {
  organizer: "Organizer",
  team_lead: "Team Lead",
  designer: "Designer",
  social_media_manager: "Social Media Manager",
};

export function roleLabel(role: AppRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : "—";
}

export const ROLE_HOME: Record<AppRole, string> = {
  organizer: "/organizer/dashboard",
  team_lead: "/lead/dashboard",
  designer: "/designer/dashboard",
  social_media_manager: "/social/dashboard",
};

export const ROLE_SETTINGS: Record<AppRole, string> = {
  organizer: "/organizer/settings",
  team_lead: "/lead/settings",
  designer: "/designer/settings",
  social_media_manager: "/social/settings",
};

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
