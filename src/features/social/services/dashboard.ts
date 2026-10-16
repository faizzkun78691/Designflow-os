/** Data access for the social dashboard. All numbers come from live Supabase queries. */
import { supabase } from "../../../integrations/supabase/client";

export type PublishingStatus = "ready" | "scheduled" | "pending" | "published";

export interface PublishingRecordRow {
  id: string;
  status: PublishingStatus;
  task_id: string | null;
  created_at: string;
  task_title: string | null;
}

export interface TaskEventRow {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PUBLISHING_STATUSES: PublishingStatus[] = [
  "ready",
  "scheduled",
  "pending",
  "published",
];

/** Counts per publishing status, all from one query shape. */
export async function fetchPublishingStatusCounts(): Promise<
  Record<PublishingStatus, number>
> {
  const results = await Promise.all(
    PUBLISHING_STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .from("publishing_records")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw new Error("Could not load publishing counts.");
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<PublishingStatus, number>;
}

/** Records ready to publish, with their parent task title. */
export async function fetchReadyToPublish(): Promise<PublishingRecordRow[]> {
  const { data, error } = await supabase
    .from("publishing_records")
    .select("id, status, task_id, created_at, tasks ( title )")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Error("Could not load publishing records.");
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    status: PublishingStatus;
    task_id: string | null;
    created_at: string;
    tasks: { title: string } | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    task_id: row.task_id,
    created_at: row.created_at,
    task_title: row.tasks?.title ?? null,
  }));
}

/** Latest 6 task events across the workspace. */
export async function fetchRecentActivity(): Promise<TaskEventRow[]> {
  const { data, error } = await supabase
    .from("task_events")
    .select("id, event_type, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Error("Could not load recent activity.");
  return (data ?? []) as TaskEventRow[];
}
