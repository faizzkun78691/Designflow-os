import { supabase } from "../integrations/supabase/client";
import type { Team, TeamMember } from "../types";

export async function listTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load teams.");
  return data as Team[];
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .eq("is_active", true);
  if (error) throw new Error("Could not load team members.");
  return data as TeamMember[];
}

/** Teams the given user actively belongs to. */
export async function listMyTeams(userId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("teams(*)")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error("Could not load your teams.");
  return (data as unknown as Array<{ teams: Team | null }>)
    .map((row) => row.teams)
    .filter((t): t is Team => t !== null);
}
