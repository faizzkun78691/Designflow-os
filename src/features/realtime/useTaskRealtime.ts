/**
 * Realtime bootstrap for dashboards + task views.
 *
 * Subscribes to postgres_changes on `tasks`, `task_events`,
 * `notifications`, and the Phase 3 workflow tables (`task_submissions`,
 * `task_approvals`, `revision_requests`, `publishing_records`). On ANY
 * event we invalidate the dashboard/notification query keys and let
 * TanStack Query refetch — we never trust potentially out-of-order
 * realtime payloads for state.
 *
 * The channel is module-level and ref-counted, so mounting the hook in
 * several components (each dashboard page, the notifications bell) still
 * opens exactly one channel. Cleanup removes the channel when the last
 * consumer unmounts.
 */
import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "../../components/ui/toaster";

/** First query-key segments that carry dashboard / task / notification data. */
const INVALIDATED_ROOTS = [
  "organizer",
  "lead",
  "designer",
  "social",
  "notifications",
  "tasks",
  "workflow",
  "employees",
  "teams",
];

let sharedChannel: RealtimeChannel | null = null;
let refCount = 0;
let invalidator: (() => void) | null = null;

function invalidateDashboards(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      INVALIDATED_ROOTS.includes(String(query.queryKey[0])),
  });
}

function ensureChannel() {
  if (sharedChannel) return;
  const channel = supabase.channel("dashboard-realtime");
  channel
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      () => invalidator?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_events" },
      () => invalidator?.(),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      () => {
        invalidator?.();
        toast.info("You have a new notification.");
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications" },
      () => invalidator?.(),
    )
    // Phase 3 workflow tables (migration 005 adds them to the
    // supabase_realtime publication).
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_submissions" },
      () => invalidator?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_approvals" },
      () => invalidator?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "revision_requests" },
      () => invalidator?.(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "publishing_records" },
      () => invalidator?.(),
    )
    // Phase 4 publishing audit trail (migration 007 adds it to realtime).
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "publishing_events" },
      () => invalidator?.(),
    )
    .subscribe();
  sharedChannel = channel;
}

export function useTaskRealtime(enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    refCount += 1;
    invalidator = () => invalidateDashboards(queryClient);
    ensureChannel();

    return () => {
      refCount -= 1;
      if (refCount <= 0 && sharedChannel) {
        const channel = sharedChannel;
        sharedChannel = null;
        invalidator = null;
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
}
