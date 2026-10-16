/** React Query hooks for notifications. Query keys are arrays. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./service";

const LIST_KEY = ["notifications", "list"] as const;
const UNREAD_KEY = ["notifications", "unread"] as const;

function useUid(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

/** Newest-first notifications for the signed-in user. */
export function useNotifications(limit = 30) {
  const uid = useUid();
  return useQuery({
    queryKey: [...LIST_KEY, uid, limit],
    queryFn: () => listNotifications(limit),
    enabled: uid !== null,
  });
}

/** Unread count for the bell badge. */
export function useUnreadCount() {
  const uid = useUid();
  return useQuery({
    queryKey: [...UNREAD_KEY, uid],
    queryFn: fetchUnreadCount,
    enabled: uid !== null,
  });
}

function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
}

/** Mark one notification read; refreshes list + badge. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSettled: () => invalidateNotifications(queryClient),
  });
}

/** Mark everything read; refreshes list + badge. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSettled: () => invalidateNotifications(queryClient),
  });
}
