/**
 * Data access for notifications. RLS restricts rows to the signed-in user,
 * so every function below only ever sees their own notifications.
 */
import { supabase } from "../../integrations/supabase/client";
import type { AppNotification } from "../dashboard/types";

const NOTIFICATION_COLUMNS =
  "id, user_id, title, body, entity_type, entity_id, is_read, created_at";

function toNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: (row.title as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    entity_type: (row.entity_type as string | null) ?? null,
    entity_id: (row.entity_id as string | null) ?? null,
    is_read: Boolean(row.is_read),
    created_at: String(row.created_at),
  };
}

/** Newest-first list of the user's notifications. */
export async function listNotifications(
  limit = 30,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load notifications.");
  return ((data ?? []) as Record<string, unknown>[]).map(toNotification);
}

/** Count of unread notifications for the badge. */
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error("Could not load notification count.");
  return count ?? 0;
}

/** Mark a single notification as read (own row only, per RLS). */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw new Error("Could not mark notification as read.");
}

/** Mark every unread notification as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw new Error("Could not mark notifications as read.");
}
