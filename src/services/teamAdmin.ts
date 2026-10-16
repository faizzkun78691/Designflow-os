import { supabase } from "../integrations/supabase/client";
import type { AppRole } from "../types";

export interface InvitePayload {
  full_name: string;
  username: string;
  password: string;
  designation: string;
  role: AppRole;
}

interface FnError {
  message?: string;
  context?: unknown;
}

function friendlyFnError(error: FnError): string {
  // Edge function failures surface here; keep the message user-safe.
  const raw = (error?.message ?? "").toString();
  if (/duplicate|already exists|already registered|already taken/i.test(raw))
    return "This username is already taken.";
  if (/forbidden|not authorized|organizer/i.test(raw))
    return "You are not authorized to perform this action.";
  return raw || "The request failed. Please try again.";
}

export interface TeamAdminResult {
  ok: boolean;
  user_id?: string;
  message?: string;
}

/** Organizer-only. Calls the `team-admin` Edge Function (service role). */
export async function inviteEmployee(
  payload: InvitePayload,
): Promise<TeamAdminResult> {
  const { data, error } = await supabase.functions.invoke("team-admin", {
    body: { action: "invite", ...payload },
  });
  if (error) throw new Error(friendlyFnError(error as FnError));
  return data as TeamAdminResult;
}

/** Organizer-only. Toggles an employee's active flag. */
export async function setEmployeeActive(
  userId: string,
  isActive: boolean,
): Promise<TeamAdminResult> {
  const { data, error } = await supabase.functions.invoke("team-admin", {
    body: { action: "set_active", user_id: userId, is_active: isActive },
  });
  if (error) throw new Error(friendlyFnError(error as FnError));
  return data as TeamAdminResult;
}

/** Organizer-only. Permanently deletes an employee's account. */
export async function deleteEmployee(
  userId: string,
): Promise<TeamAdminResult> {
  const { data, error } = await supabase.functions.invoke("team-admin", {
    body: { action: "delete_user", user_id: userId },
  });
  if (error) throw new Error(friendlyFnError(error as FnError));
  return data as TeamAdminResult;
}
