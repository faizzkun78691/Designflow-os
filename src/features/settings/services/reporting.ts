/** Reporting-manager lookup for the shared settings page. */
import { supabase } from "../../../integrations/supabase/client";

export interface ReportingManager {
  id: string;
  full_name: string;
}

/**
 * Resolves the signed-in user's reporting manager:
 * team_members (user_id) -> reporting_manager_id -> profiles.full_name.
 * Returns null when the user has no manager assigned.
 */
export async function fetchMyReportingManager(
  userId: string,
): Promise<ReportingManager | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("reporting_manager_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) throw new Error("Could not load reporting details.");

  const managerId = (
    membership as { reporting_manager_id: string | null } | null
  )?.reporting_manager_id;
  if (!managerId) return null;

  const { data: manager, error: managerError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", managerId)
    .maybeSingle();
  if (managerError) throw new Error("Could not load reporting details.");
  return (manager as ReportingManager | null) ?? null;
}
