/**
 * Data access for the team-lead dashboard. All numbers come from live
 * Supabase queries, scoped by RLS (created_by = me or assigned_lead_id = me).
 */
import { supabase } from "../../../integrations/supabase/client";
import {
  TASK_COLUMNS,
  isActiveStatus,
  isOverdue,
  type DashboardTask,
  type DesignerWorkloadRow,
} from "../../dashboard/types";

export interface LeadTaskRow extends DashboardTask {}

interface LeadTaskEventRow {
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

export interface LeadTaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  created_at: string;
  task_title: string | null;
  task_code: string | null;
}

/**
 * Tasks this lead created plus tasks the organizer routed to them.
 * Counts by status are computed client-side from this single result.
 */
export async function fetchLeadTasks(uid: string): Promise<LeadTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .or(`created_by.eq.${uid},assigned_lead_id.eq.${uid}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your tasks.");
  return (data ?? []) as LeadTaskRow[];
}

interface ProfileNameRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Workload summary for designers working on this lead's tasks, computed
 * from a real tasks select + profile lookup — no hardcoded numbers.
 */
export async function fetchLeadDesignerWorkload(
  uid: string,
): Promise<DesignerWorkloadRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("assigned_designer_id, claimed_by, production_status, due_date")
    .eq("created_by", uid)
    .or("assigned_designer_id.not.is.null,claimed_by.not.is.null");
  if (error) throw new Error("Could not load team workload.");

  const now = Date.now();
  const byDesigner = new Map<
    string,
    { active: number; overdue: number }
  >();
  for (const row of (data ?? []) as Array<{
    assigned_designer_id: string | null;
    claimed_by: string | null;
    production_status: string;
    due_date: string | null;
  }>) {
    const designerId = row.claimed_by ?? row.assigned_designer_id;
    if (!designerId) continue;
    const entry = byDesigner.get(designerId) ?? { active: 0, overdue: 0 };
    if (isActiveStatus(row.production_status)) {
      entry.active += 1;
      if (isOverdue(row, now)) {
        entry.overdue += 1;
      }
    }
    byDesigner.set(designerId, entry);
  }

  const ids = [...byDesigner.keys()];
  if (ids.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  if (profileError) throw new Error("Could not load team workload.");
  const nameById = new Map(
    ((profiles ?? []) as ProfileNameRow[]).map((p) => [p.id, p]),
  );

  return ids.map((designerId) => {
    const entry = byDesigner.get(designerId) ?? { active: 0, overdue: 0 };
    const profile = nameById.get(designerId);
    return {
      designer_id: designerId,
      full_name: profile?.full_name ?? "Unknown designer",
      avatar_url: profile?.avatar_url ?? null,
      active_count: entry.active,
      overdue_count: entry.overdue,
    };
  });
}

/** Latest task events performed by the signed-in lead, with task titles. */
export async function fetchLeadRecentActivity(
  uid: string,
  limit = 6,
): Promise<LeadTaskEvent[]> {
  const { data, error } = await supabase
    .from("task_events")
    .select("id, task_id, actor_id, event_type, metadata, created_at, tasks(task_code, title)")
    .eq("actor_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load recent activity.");
  return ((data ?? []) as unknown as LeadTaskEventRow[]).map((row) => {
    const task = !row.tasks
      ? null
      : Array.isArray(row.tasks)
        ? (row.tasks[0] ?? null)
        : row.tasks;
    return {
      id: row.id,
      task_id: row.task_id,
      event_type: row.event_type,
      created_at: row.created_at,
      task_title: task?.title ?? null,
      task_code: task?.task_code ?? null,
    };
  });
}
