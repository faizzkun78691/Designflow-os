import { supabase } from "../integrations/supabase/client";
import type { EmployeeRow, Profile } from "../types";

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not load your profile.");
  return data as Profile | null;
}

export interface ProfilePatch {
  full_name?: string;
  avatar_url?: string | null;
}

export async function updateMyProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error("Could not update your profile.");
  return data as Profile;
}

/** Organizer-only: full employee directory (profile + role) via SECURITY DEFINER RPC. */
export async function listEmployees(): Promise<EmployeeRow[]> {
  const { data, error } = await supabase.rpc("get_employee_directory");
  if (error) throw new Error("Could not load the team directory.");
  return (data ?? []) as EmployeeRow[];
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Uploads to the `avatars` bucket at `<userId>/avatar.<ext>` and returns the public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type))
    throw new Error("Avatar must be a PNG, JPEG or WebP image.");
  if (file.size > MAX_AVATAR_BYTES)
    throw new Error("Avatar must be smaller than 2 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error("Avatar upload failed. Please try again.");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
