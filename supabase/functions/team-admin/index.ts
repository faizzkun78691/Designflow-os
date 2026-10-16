// DesignFlow OS — team-admin Edge Function
// Organizer-only user administration: invite users and toggle activation.
// Invites create the auth user, profile, role, AND an active membership in
// the default "DesignFlow" team (designers need it to claim public tasks).
// Uses the SERVICE ROLE key for all privileged writes; callers authenticate
// with their own JWT and must hold the 'organizer' role with an active profile.
//
// Env required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AppRole = "organizer" | "team_lead" | "designer" | "social_media_manager";

type InvitePayload = {
  action: "invite";
  full_name: string;
  username: string;
  password: string;
  designation: string;
  role: AppRole;
};

type SetActivePayload = {
  action: "set_active";
  user_id: string;
  is_active: boolean;
};

type DeleteUserPayload = {
  action: "delete_user";
  user_id: string;
};

type SetPasswordPayload = {
  action: "set_password";
  user_id: string;
  password: string;
};

type RequestBody = InvitePayload | SetActivePayload | DeleteUserPayload | SetPasswordPayload;

const USERNAME_RE = /^[a-z0-9]{3,30}$/;
const INTERNAL_EMAIL_DOMAIN = "designflow.internal";

const VALID_ROLES: AppRole[] = ["organizer", "team_lead", "designer", "social_media_manager"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function badRequest(message: string): Response {
  return json(400, { ok: false, error: message });
}

function checkString(value: unknown, min: number, max: number): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

// Ensures the default "DesignFlow" team exists and returns its id.
// Invitees are added to it so designers are claim-eligible from day one
// (claim_task requires an active team membership).
async function ensureDefaultTeam(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data: existing, error: findError } = await admin
    .from("teams")
    .select("id")
    .eq("name", "DesignFlow")
    .maybeSingle();
  if (findError) return null;
  if (existing) return existing.id as string;
  const { data: created, error: createError } = await admin
    .from("teams")
    .insert({ name: "DesignFlow", description: "Default DesignFlow team" })
    .select("id")
    .single();
  if (createError || !created) return null;
  return created.id as string;
}

async function rollbackInvite(admin: ReturnType<typeof createClient>, userId: string) {
  await admin.from("team_members").delete().eq("user_id", userId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

// Look up an auth user by email via paginated admin listing.
// Returns the user id when found, null otherwise.
async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 100;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth user lookup failed: ${error.message}`);
    for (const user of data.users) {
      if (user.email && user.email.toLowerCase() === normalized) return user.id;
    }
    if (data.users.length < perPage) break;
  }
  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    return json(500, { ok: false, error: "Server misconfigured." });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json(401, { ok: false, error: "Missing bearer token." });

  // Authenticate the caller with their own JWT (anon client).
  const supabase = createClient(url, anonKey);
  const { data: callerData, error: callerError } = await supabase.auth.getUser(jwt);
  if (callerError || !callerData.user) {
    return json(401, { ok: false, error: "Invalid or expired token." });
  }
  const callerId = callerData.user.id;

  // Admin client (service role bypasses RLS for privileged operations).
  const admin = createClient(url, serviceRoleKey);

  // Authorize: caller must be an organizer with an active profile.
  const { data: callerRoleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .maybeSingle();
  if (roleError) return json(500, { ok: false, error: "Authorization check failed." });
  if (!callerRoleRow || callerRoleRow.role !== "organizer") {
    return json(403, { ok: false, error: "Forbidden. Organizer role required." });
  }
  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("is_active")
    .eq("id", callerId)
    .maybeSingle();
  if (profileError) return json(500, { ok: false, error: "Authorization check failed." });
  if (!callerProfile || !callerProfile.is_active) {
    return json(403, { ok: false, error: "Forbidden. Caller account is not active." });
  }

  switch (body.action) {
    case "invite":
      return await handleInvite(admin, callerId, body);
    case "set_active":
      return await handleSetActive(admin, callerId, body);
    case "delete_user":
      return await handleDeleteUser(admin, callerId, body);
    case "set_password":
      return await handleSetPassword(admin, callerId, body);
    default:
      return badRequest("Unknown action. Expected 'invite', 'set_active', 'delete_user' or 'set_password'.");
  }
});

async function handleInvite(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  body: InvitePayload,
): Promise<Response> {
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const designation = typeof body.designation === "string" ? body.designation.trim() : "";
  const role = body.role;

  if (!checkString(fullName, 2, 100)) return badRequest("full_name must be 2-100 characters.");
  if (!USERNAME_RE.test(username)) {
    return badRequest("username must be 3-30 lowercase letters/digits.");
  }
  if (password.length < 8) return badRequest("password must be at least 8 characters.");
  if (!checkString(designation, 2, 100)) return badRequest("designation must be 2-100 characters.");
  if (!VALID_ROLES.includes(role)) {
    return badRequest("role must be one of: organizer, team_lead, designer, social_media_manager.");
  }

  const email = `${username}@${INTERNAL_EMAIL_DOMAIN}`;

  // Duplicate check: profile by username AND auth user by email.
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (profileLookupError) return json(500, { ok: false, error: "Duplicate check failed." });
  if (existingProfile) return json(409, { ok: false, error: "This username is already taken." });

  let existingAuthUserId: string | null;
  try {
    existingAuthUserId = await findAuthUserIdByEmail(admin, email);
  } catch {
    return json(500, { ok: false, error: "Duplicate check failed." });
  }
  if (existingAuthUserId) {
    return json(409, { ok: false, error: "This username is already taken." });
  }

  // Create the auth user directly (no email delivery needed).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, username },
  });
  if (createError || !created.user) {
    return json(500, { ok: false, error: "Failed to create the user account." });
  }
  const newUserId = created.user.id;

  // Set the password explicitly (separate call for reliability).
  const { error: pwError } = await admin.auth.admin.updateUserById(newUserId, {
    password,
  });
  if (pwError) {
    await rollbackInvite(admin, newUserId);
    return json(500, { ok: false, error: "Failed to set the account password." });
  }

  // Insert profile and role rows. Roll back the auth user on partial failure.
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    username,
    email,
    designation,
    is_active: true,
  });
  if (profileError) {
    await rollbackInvite(admin, newUserId);
    return json(500, {
      ok: false,
      error: "User creation failed and was rolled back; nothing was left half-created.",
    });
  }
  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: newUserId,
    role,
    assigned_by: callerId,
  });
  if (roleError) {
    await rollbackInvite(admin, newUserId);
    return json(500, {
      ok: false,
      error: "User creation failed and was rolled back; nothing was left half-created.",
    });
  }

  // Add the invitee to the default team as an active member, so designers
  // are claim-eligible immediately (claim_task requires active membership).
  const teamId = await ensureDefaultTeam(admin);
  if (!teamId) {
    await rollbackInvite(admin, newUserId);
    return json(500, {
      ok: false,
      error: "Team provisioning failed and was rolled back; nothing was left half-created.",
    });
  }
  const { error: memberError } = await admin.from("team_members").insert({
    team_id: teamId,
    user_id: newUserId,
    is_active: true,
  });
  if (memberError) {
    await rollbackInvite(admin, newUserId);
    return json(500, {
      ok: false,
      error: "User creation failed and was rolled back; nothing was left half-created.",
    });
  }

  await admin.from("system_audit_logs").insert({
    actor_id: callerId,
    action: "user.invited",
    entity_type: "user",
    entity_id: newUserId,
    metadata: { email, role, designation },
  });

  return json(200, { ok: true, user_id: newUserId });
}

async function handleSetActive(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  body: SetActivePayload,
): Promise<Response> {
  const userId = body.user_id;
  const isActive = body.is_active;

  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return badRequest("user_id must be a valid UUID.");
  }
  if (typeof isActive !== "boolean") return badRequest("is_active must be a boolean.");
  if (userId === callerId) {
    return json(409, { ok: false, error: "You cannot deactivate your own account." });
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return json(500, { ok: false, error: "User lookup failed." });
  if (!target) return json(404, { ok: false, error: "User not found." });

  if (!isActive) {
    // Last-organizer guard: refusing to deactivate when the target is an
    // organizer and no other active organizer would remain.
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetRole && targetRole.role === "organizer") {
      const { data: orgRoles, error: orgError } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "organizer")
        .neq("user_id", userId);
      if (orgError) return json(500, { ok: false, error: "Organizer count check failed." });
      const otherIds = (orgRoles ?? []).map((r) => r.user_id as string);
      let activeOthers = 0;
      if (otherIds.length > 0) {
        const { data: activeProfiles, error: profError } = await admin
          .from("profiles")
          .select("id")
          .in("id", otherIds)
          .eq("is_active", true);
        if (profError) return json(500, { ok: false, error: "Organizer count check failed." });
        activeOthers = (activeProfiles ?? []).length;
      }
      if (activeOthers === 0) {
        return json(409, { ok: false, error: "Cannot deactivate the last organizer." });
      }
    }
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (updateError) return json(500, { ok: false, error: "Failed to update user status." });

  await admin.from("system_audit_logs").insert({
    actor_id: callerId,
    action: isActive ? "user.activated" : "user.deactivated",
    entity_type: "user",
    entity_id: userId,
    metadata: {},
  });

  return json(200, { ok: true });
}

async function handleDeleteUser(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  body: DeleteUserPayload,
): Promise<Response> {
  const userId = body.user_id;

  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return badRequest("user_id must be a valid UUID.");
  }
  if (userId === callerId) {
    return json(409, { ok: false, error: "You cannot delete your own account." });
  }

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, username")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return json(500, { ok: false, error: "User lookup failed." });
  if (!target) return json(404, { ok: false, error: "User not found." });

  // Last-organizer guard.
  const { data: targetRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (targetRole && targetRole.role === "organizer") {
    const { data: orgRoles, error: orgError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "organizer")
      .neq("user_id", userId);
    if (orgError) return json(500, { ok: false, error: "Organizer count check failed." });
    const otherIds = (orgRoles ?? []).map((r) => r.user_id as string);
    let activeOthers = 0;
    if (otherIds.length > 0) {
      const { data: activeProfiles, error: profError } = await admin
        .from("profiles")
        .select("id")
        .in("id", otherIds)
        .eq("is_active", true);
      if (profError) return json(500, { ok: false, error: "Organizer count check failed." });
      activeOthers = (activeProfiles ?? []).length;
    }
    if (activeOthers === 0) {
      return json(409, { ok: false, error: "Cannot delete the last organizer." });
    }
  }

  // Clear assigned_by references first (no cascade on that FK).
  await admin.from("user_roles").update({ assigned_by: null }).eq("assigned_by", userId);

  // Delete in dependency order; auth user last (profile FK cascades anyway).
  await admin.from("team_members").delete().eq("user_id", userId);
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json(500, { ok: false, error: "Failed to delete the auth account." });
  }
  // Ensure profile/role rows are gone (cascade should handle, but be explicit).
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("id", userId);

  await admin.from("system_audit_logs").insert({
    actor_id: callerId,
    action: "user.deleted",
    entity_type: "user",
    entity_id: userId,
    metadata: { full_name: target.full_name, username: target.username ?? null },
  });

  return json(200, { ok: true });
}

async function handleSetPassword(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  body: SetPasswordPayload,
): Promise<Response> {
  const userId = body.user_id;
  const password = typeof body.password === "string" ? body.password : "";

  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return badRequest("user_id must be a valid UUID.");
  }
  if (password.length < 8) return badRequest("password must be at least 8 characters.");

  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return json(500, { ok: false, error: "User lookup failed." });
  if (!target) return json(404, { ok: false, error: "User not found." });

  const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
  if (pwError) return json(500, { ok: false, error: "Failed to set the password." });

  await admin.from("system_audit_logs").insert({
    actor_id: callerId,
    action: "user.password_reset",
    entity_type: "user",
    entity_id: userId,
    metadata: {},
  });

  return json(200, { ok: true });
}
