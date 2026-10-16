/**
 * Data access for the organizer dashboard. Every number on the page is
 * computed from these live Supabase queries — nothing is hardcoded.
 */
import { supabase } from "../../../integrations/supabase/client";
import {
  TASK_COLUMNS,
  type DashboardTask,
  type DashboardTaskEvent,
} from "../../dashboard/types";

interface TaskEventJoinRow {
  id: string;
  task_id: string;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Untyped supabase client infers the to-one join as an array; normalize it.
  tasks:
    | { task_code: string | null; title: string }
    | Array<{ task_code: string | null; title: string }>
    | null;
}

function joinedTask(
  row: TaskEventJoinRow,
): { task_code: string | null; title: string } | null {
  if (!row.tasks) return null;
  return Array.isArray(row.tasks) ? (row.tasks[0] ?? null) : row.tasks;
}

/** All tasks visible to the organizer (RLS: organizer sees everything). */
export async function fetchOrganizerTasks(): Promise<DashboardTask[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load tasks.");
  return (data ?? []) as DashboardTask[];
}

/** Latest task events with the task title resolved for display. */
export async function fetchOrganizerRecentEvents(
  limit = 8,
): Promise<DashboardTaskEvent[]> {
  const { data, error } = await supabase
    .from("task_events")
    .select("id, task_id, actor_id, event_type, metadata, created_at, tasks(task_code, title)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load recent activity.");
  const rows = (data ?? []) as unknown as TaskEventJoinRow[];
  return rows.map((row) => {
    const task = joinedTask(row);
    return {
      id: row.id,
      task_id: row.task_id,
      actor_id: row.actor_id,
      event_type: row.event_type,
      metadata: row.metadata,
      created_at: row.created_at,
      task_title: task?.title ?? null,
      task_code: task?.task_code ?? null,
    };
  });
}
