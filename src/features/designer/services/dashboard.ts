/**
 * Data access for the designer dashboard. All numbers come from live
 * Supabase queries, scoped by RLS (assigned/claimed by me, or public +
 * available). The `get_task_board()` / `get_designer_workload()` RPCs are
 * preferred when present; direct selects are the fallback.
 */
import { supabase } from "../../../integrations/supabase/client";
import {
  TASK_COLUMNS,
  isActiveStatus,
  isOverdue,
  type DashboardTask,
  type TaskBoardRow,
} from "../../dashboard/types";

export interface DesignerTaskRow extends DashboardTask {}

export interface DesignerWorkload {
  active_count: number;
  overdue_count: number;
  upcoming_count: number;
}

/** My tasks: assigned to me or claimed by me, in an active status. */
export async function fetchMyDesignerTasks(
  uid: string,
): Promise<DesignerTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(`assigned_designer_id.eq.${uid},claimed_by.eq.${uid}`)
    .in("production_status", [
      "claimed",
      "in_progress",
      "in_revision",
      "submitted",
      "approved",
      "ready",
    ])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your tasks.");
  return (data ?? []) as DesignerTaskRow[];
}

/** My completed designs: assigned or claimed by me, status completed/published. */
export async function fetchMyCompletedTasks(
  uid: string,
): Promise<DesignerTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(`assigned_designer_id.eq.${uid},claimed_by.eq.${uid}`)
    .in("production_status", ["completed", "published"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error("Could not load your completed designs.");
  return (data ?? []) as DesignerTaskRow[];
}

/**
 * Available public tasks via the `get_task_board()` RPC, filtered to
 * available + unclaimed. Falls back to a direct RLS-permitted select when
 * the RPC is not deployed yet.
 */
export async function fetchAvailableBoardTasks(): Promise<TaskBoardRow[]> {
  const { data, error } = await supabase.rpc("get_task_board");
  if (!error && data) {
    const rows = data as TaskBoardRow[];
    return rows.filter(
      (row) =>
        row.production_status === "available" && row.claimed_by === null,
    );
  }

  const { data: rows, error: selectError } = await supabase
    .from("tasks")
    .select("id, task_code, title, production_status, priority, due_date, claimed_by")
    .eq("visibility", "public")
    .eq("production_status", "available")
    .is("claimed_by", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (selectError) throw new Error("Could not load available tasks.");
  return ((rows ?? []) as Array<Omit<TaskBoardRow, "claimant_name">>).map(
    (row) => ({ ...row, claimant_name: null }),
  );
}

/**
 * Workload summary via the `get_designer_workload(p_user_id)` RPC, with a
 * client-side fallback computed from my active tasks.
 */
export async function fetchDesignerWorkload(
  uid: string,
): Promise<DesignerWorkload> {
  const { data, error } = await supabase.rpc("get_designer_workload", {
    p_user_id: uid,
  });
  if (!error && data) {
    const row = (
      Array.isArray(data) ? data[0] : data
    ) as {
      active_count: number;
      overdue_count: number;
      upcoming_count?: number;
      upcoming?: number;
    } | null;
    if (row) {
      return {
        active_count: Number(row.active_count ?? 0),
        overdue_count: Number(row.overdue_count ?? 0),
        upcoming_count: Number(row.upcoming_count ?? row.upcoming ?? 0),
      };
    }
  }

  const myTasks = await fetchMyDesignerTasks(uid);
  const now = Date.now();
  return {
    active_count: myTasks.filter((t) => isActiveStatus(t.production_status))
      .length,
    overdue_count: myTasks.filter((t) => isOverdue(t, now)).length,
    upcoming_count: myTasks.filter(
      (t) =>
        t.due_date &&
        isActiveStatus(t.production_status) &&
        new Date(t.due_date).getTime() >= now,
    ).length,
  };
}
