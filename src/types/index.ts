/** Shared domain types for DesignFlow OS Phase 1. */

export type AppRole =
  | "organizer"
  | "team_lead"
  | "designer"
  | "social_media_manager";

export interface Profile {
  id: string;
  full_name: string;
  username: string | null;
  email: string;
  avatar_url: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  user_id: string;
  role: AppRole;
  assigned_at: string;
  assigned_by: string | null;
}

/** Profile joined with its active system role (organizer views). */
export interface EmployeeRow extends Profile {
  role: AppRole | null;
  role_assigned_at: string | null;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  reporting_manager_id: string | null;
  joined_at: string;
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
