/**
 * Task data access — DesignFlow OS Phase 2.
 *
 * All mutations go through the backend RPCs (migration 003). Reads use
 * RLS-protected direct selects. NEVER direct INSERT/UPDATE/DELETE on task
 * tables — always via RPC.
 */
import { supabase } from "../../../integrations/supabase/client";
import type {
  CreateTaskPayload,
  CreateTaskResult,
  ProductionStatus,
  Task,
  TaskAssignment,
  TaskBoardRow,
  TaskBrief,
  TaskChecklistItem,
  TaskDetail,
  TaskDifficulty,
  TaskEvent,
  TaskListFilters,
  TaskPatch,
  TaskPriority,
  TaskReference,
  TaskSpec,
  TaskSocial,
  TaskVisibility,
  WorkloadInfo,
  WorkloadUpcomingItem,
} from "../../../types/tasks";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    const m = error.message.toLowerCase();
    if (m.includes("permission") || m.includes("not allowed"))
      return new Error("You don't have permission for this action.");
    if (m.includes("not found"))
      return new Error("This task no longer exists.");
    return new Error(error.message);
  }
  return new Error(fallback);
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const bool = (v: unknown): boolean => v === true;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

const VALID_STATUSES = new Set([
  "draft",
  "available",
  "assigned",
  "accepted",
  "in_progress",
  "cancelled",
  "submitted_lead_review",
  "submitted_organizer_review",
  "ready_for_publishing",
  "revision_awaiting_organizer",
  "revision_awaiting_lead",
  "revision_required_designer",
]);
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent", "critical"]);

function toTask(row: Row): Task {
  const spec = asRecord(row.spec);
  const social = asRecord(row.social);
  return {
    id: String(row.id),
    task_code: str(row.task_code),
    title: String(row.title ?? "Untitled task"),
    description: str(row.description),
    visibility:
      row.visibility === "public" ? "public" : ("private" as TaskVisibility),
    production_status: VALID_STATUSES.has(String(row.production_status))
      ? (row.production_status as ProductionStatus)
      : "draft",
    priority: VALID_PRIORITIES.has(String(row.priority))
      ? (row.priority as TaskPriority)
      : "normal",
    due_date: str(row.due_date),
    timezone: str(row.timezone),
    difficulty: (["easy", "medium", "hard"] as const).includes(
      row.difficulty as TaskDifficulty,
    )
      ? (row.difficulty as TaskDifficulty)
      : null,
    est_hours: num(row.est_hours),
    campaign_name: str(row.campaign_name),
    design_category: str(row.design_category),
    target_platform: str(row.target_platform),
    created_by: str(row.created_by),
    assignee_id: str(row.assignee_id) ?? str(row.assigned_designer_id),
    assign_lead_id: str(row.assign_lead_id),
    claimed_by: str(row.claimed_by),
    spec: spec as TaskSpec | null,
    social: social as TaskSocial | null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  };
}

function toBrief(row: Row): TaskBrief {
  const nested = asRecord(row.brief) ?? {};
  const pick = (k: string): string | null =>
    str(row[k]) ?? str(nested[k]);
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    objective: pick("objective"),
    audience: pick("audience"),
    headlines: pick("headlines"),
    mandatory_copy: pick("mandatory_copy"),
    concept: pick("concept"),
    layout: pick("layout"),
    color_type_instructions: pick("color_type_instructions"),
    cta: pick("cta"),
    notes: pick("notes"),
    brief_text: str(row.brief_text),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function toReference(row: Row): TaskReference {
  const kind = String(row.kind ?? "reference");
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    label: String(row.label ?? "Reference"),
    url: String(row.url ?? ""),
    kind: (["inspiration", "asset", "guideline", "reference", "other"] as const).includes(
      kind as TaskReference["kind"],
    )
      ? (kind as TaskReference["kind"])
      : "reference",
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function toChecklistItem(row: Row, index: number): TaskChecklistItem {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    label: String(row.label ?? row.title ?? row.text ?? "Item"),
    is_done: bool(row.is_done ?? row.done ?? row.completed),
    position: num(row.position) ?? index,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function toAssignment(row: Row): TaskAssignment {
  const nestedTask = asRecord(row.tasks);
  return {
    id: String(row.id),
    task_id: String(row.task_id ?? nestedTask?.id ?? ""),
    assignee_id: String(row.assignee_id ?? row.user_id ?? ""),
    assigned_by: str(row.assigned_by),
    status:
      row.status === "accepted" || row.status === "declined"
        ? row.status
        : "pending",
    reason: str(row.reason),
    created_at: String(row.created_at ?? new Date().toISOString()),
    assignee_name: str(row.assignee_name) ?? null,
  };
}

function toEvent(row: Row): TaskEvent {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    actor_id: str(row.actor_id),
    actor_name: str(row.actor_name) ?? null,
    event_type: String(row.event_type ?? "unknown"),
    metadata: asRecord(row.metadata) ?? {},
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function toBoardRow(row: Row): TaskBoardRow {
  return {
    id: String(row.id),
    task_code: str(row.task_code),
    title: String(row.title ?? "Untitled task"),
    production_status: VALID_STATUSES.has(String(row.production_status))
      ? (row.production_status as ProductionStatus)
      : "available",
    priority: VALID_PRIORITIES.has(String(row.priority))
      ? (row.priority as TaskPriority)
      : "normal",
    due_date: str(row.due_date),
    claimed_by: str(row.claimed_by),
    claimant_name: str(row.claimant_name),
    visibility: row.visibility === "public" ? "public" : row.visibility === "private" ? "private" : null,
    created_by: str(row.created_by),
    assignee_id: str(row.assignee_id) ?? str(row.assigned_designer_id),
  };
}

function toWorkload(row: Row): WorkloadInfo {
  const upcoming = Array.isArray(row.upcoming)
    ? (row.upcoming as Row[]).map((u) => ({
        task_id: String(u.task_id ?? u.id ?? ""),
        task_code: str(u.task_code),
        title: String(u.title ?? "Untitled task"),
        due_date: str(u.due_date),
        production_status: VALID_STATUSES.has(String(u.production_status))
          ? (u.production_status as ProductionStatus)
          : "assigned",
      }))
    : [];
  return {
    active_count: num(row.active_count) ?? 0,
    overdue_count: num(row.overdue_count) ?? 0,
    upcoming: upcoming as WorkloadUpcomingItem[],
  };
}

/** Best-effort profile name/avatar lookup; RLS may deny for some roles. */
export async function resolvePeople(
  ids: string[],
): Promise<Map<string, { name: string; avatar: string | null }>> {
  const map = new Map<string, { name: string; avatar: string | null }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", unique);
    if (error) throw error;
    for (const r of (data ?? []) as Row[]) {
      map.set(String(r.id), {
        name: String(r.full_name ?? "Team member"),
        avatar: str(r.avatar_url),
      });
    }
  } catch {
    // RLS may hide profiles from this role — names simply stay unresolved.
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* mutations (RPC only)                                                */
/* ------------------------------------------------------------------ */

export async function createTask(
  payload: CreateTaskPayload,
): Promise<CreateTaskResult> {
  const { data, error } = await supabase.rpc("create_task", {
    p_payload: payload,
  });
  if (error) throw friendly(error, "Could not create the task.");
  const r = (data ?? {}) as Row;
  if (r.ok !== true) throw new Error(str(r.reason) ?? "Could not create the task.");
  return {
    task_id: String(r.task_id),
    task_code: str(r.task_code),
    duplicate_warning: str(r.duplicate_warning),
  };
}

async function okRpc(
  name: string,
  params: Record<string, unknown>,
  fallback: string,
): Promise<Row> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw friendly(error, fallback);
  const r = (data ?? {}) as Row;
  if (r.ok !== true) throw new Error(str(r.reason) ?? fallback);
  return r;
}

export async function publishTask(taskId: string): Promise<void> {
  await okRpc("publish_task", { p_task_id: taskId }, "Could not publish the task.");
}

export const ALREADY_CLAIMED_MESSAGE =
  "This task has already been claimed by another designer.";

export async function claimTask(taskId: string): Promise<void> {
  const { data, error } = await supabase.rpc("claim_task", {
    p_task_id: taskId,
  });
  if (error) throw friendly(error, "Could not claim the task.");
  const r = (data ?? {}) as Row;
  if (r.ok === true) return;
  if (str(r.reason) === "already_claimed") throw new Error(ALREADY_CLAIMED_MESSAGE);
  throw new Error(str(r.reason) ?? "Could not claim the task.");
}

export async function acceptAssignment(assignmentId: string): Promise<void> {
  await okRpc(
    "accept_assignment",
    { p_assignment_id: assignmentId },
    "Could not accept the assignment.",
  );
}

export async function declineAssignment(
  assignmentId: string,
  reason?: string,
): Promise<void> {
  await okRpc(
    "decline_assignment",
    { p_assignment_id: assignmentId, p_reason: reason ?? null },
    "Could not decline the assignment.",
  );
}

/** Find my pending assignment on a task, then accept it (kanban drop path). */
export async function acceptMyAssignment(
  taskId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("task_assignments")
    .select("id")
    .eq("task_id", taskId)
    .eq("assignee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw friendly(error, "Could not accept the assignment.");
  const row = data as Row | null;
  if (!row?.id) throw new Error("No pending assignment found for you on this task.");
  await acceptAssignment(String(row.id));
}

export async function reassignTask(
  taskId: string,
  newAssigneeId: string,
): Promise<void> {
  await okRpc(
    "reassign_task",
    { p_task_id: taskId, p_new_assignee_id: newAssigneeId },
    "Could not reassign the task.",
  );
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: ProductionStatus,
  reason?: string,
): Promise<void> {
  await okRpc(
    "update_task_status",
    {
      p_task_id: taskId,
      p_new_status: newStatus,
      p_reason: reason ?? null,
    },
    "Could not update the task status.",
  );
}

export async function updateTask(
  taskId: string,
  patch: TaskPatch,
): Promise<void> {
  await okRpc(
    "update_task",
    { p_task_id: taskId, p_patch: patch },
    "Could not update the task.",
  );
}

export async function toggleChecklistItem(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("toggle_checklist_item", {
    p_item_id: itemId,
  });
  if (error) throw friendly(error, "Could not update the checklist.");
  const r = (data ?? {}) as Row;
  if (r.ok !== true) throw new Error(str(r.reason) ?? "Could not update the checklist.");
  return bool(r.is_done ?? r.done);
}

export async function cancelTask(
  taskId: string,
  reason?: string,
): Promise<void> {
  await okRpc(
    "cancel_task",
    { p_task_id: taskId, p_reason: reason ?? null },
    "Could not cancel the task.",
  );
}

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

export async function getTaskBoard(): Promise<TaskBoardRow[]> {
  const { data, error } = await supabase.rpc("get_task_board");
  if (error) throw friendly(error, "Could not load the task board.");
  return ((data ?? []) as Row[]).map(toBoardRow);
}

export async function getDesignerWorkload(userId: string): Promise<WorkloadInfo> {
  const { data, error } = await supabase.rpc("get_designer_workload", {
    p_user_id: userId,
  });
  if (error) throw friendly(error, "Could not load the workload.");
  return toWorkload((data ?? {}) as Row);
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

export interface TaskListResult {
  items: Task[];
  total: number;
}

function escapeLike(v: string): string {
  return v.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export async function listTasks(
  filters: TaskListFilters,
  userId: string,
): Promise<TaskListResult> {
  const createdBy = filters.createdBy === "me" ? userId : filters.createdBy;
  const assignLeadId = filters.assignLeadId === "me" ? userId : filters.assignLeadId;

  let q = supabase.from("tasks").select("*", { count: "exact" });

  if (filters.statuses.length > 0)
    q = q.in("production_status", filters.statuses);
  if (filters.priorities.length > 0) q = q.in("priority", filters.priorities);
  if (filters.visibility !== "all") q = q.eq("visibility", filters.visibility);
  if (filters.search.trim()) {
    const s = escapeLike(filters.search.trim());
    q = q.or(
      `title.ilike.%${s}%,description.ilike.%${s}%,task_code.ilike.%${s}%`,
    );
  }
  if (filters.assignment === "mine")
    q = q.or(`assigned_designer_id.eq.${userId},claimed_by.eq.${userId}`);
  if (filters.assignment === "unassigned")
    q = q.is("assigned_designer_id", null).is("claimed_by", null);
  if (createdBy) q = q.eq("created_by", createdBy);
  if (assignLeadId) q = q.eq("assigned_lead_id", assignLeadId);

  const nowIso = new Date().toISOString();
  if (filters.deadline === "overdue")
    q = q.not("due_date", "is", null).lt("due_date", nowIso);
  if (filters.deadline === "no_deadline") q = q.is("due_date", null);
  if (filters.deadline === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    q = q.gte("due_date", start.toISOString()).lte("due_date", end.toISOString());
  }
  if (filters.deadline === "this_week") {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    q = q.gte("due_date", nowIso).lte("due_date", end.toISOString());
  }

  if (filters.sort === "priority") {
    // Priority has no natural DB order; sort by due date and order client-side.
    q = q.order("due_date", { ascending: filters.order === "asc", nullsFirst: false });
  } else {
    q = q.order(filters.sort, {
      ascending: filters.order === "asc",
      nullsFirst: filters.sort === "due_date" ? false : true,
    });
  }
  q = q.order("created_at", { ascending: false });

  const from = filters.page * filters.pageSize;
  const to = from + filters.pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw friendly(error, "Could not load tasks.");

  let items = ((data ?? []) as Row[]).map(toTask);
  if (filters.sort === "priority") {
    items = [...items].sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) *
        (filters.order === "asc" ? 1 : -1),
    );
  }
  return { items, total: count ?? items.length };
}

export async function fetchTaskDetail(
  taskId: string,
  userId: string | null,
): Promise<TaskDetail> {
  const [taskRes, briefRes, refsRes, checklistRes, assignRes, eventsRes] =
    await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).single(),
      supabase.from("task_briefs").select("*").eq("task_id", taskId).maybeSingle(),
      supabase
        .from("task_references")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
      supabase
        .from("task_assignments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_events")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (taskRes.error) throw friendly(taskRes.error, "Could not load the task.");
  for (const [res, what] of [
    [briefRes, "brief"],
    [refsRes, "references"],
    [checklistRes, "checklist"],
    [assignRes, "assignments"],
    [eventsRes, "activity"],
  ] as const) {
    if (res.error) throw friendly(res.error, `Could not load the task ${what}.`);
  }

  const task = toTask(taskRes.data as Row);
  const brief = briefRes.data ? toBrief(briefRes.data as Row) : null;
  const references = ((refsRes.data ?? []) as Row[]).map(toReference);
  const checklist = ((checklistRes.data ?? []) as Row[]).map(toChecklistItem);
  const assignments = ((assignRes.data ?? []) as Row[]).map(toAssignment);
  const events = ((eventsRes.data ?? []) as Row[]).map(toEvent);

  const peopleIds = [
    task.created_by,
    task.assignee_id,
    task.claimed_by,
    ...assignments.map((a) => a.assignee_id),
    ...assignments.map((a) => a.assigned_by),
    ...events.map((e) => e.actor_id),
  ].filter((v): v is string => !!v);
  const people = await resolvePeople(peopleIds);
  const nameOf = (id: string | null): string | null =>
    id ? (people.get(id)?.name ?? null) : null;

  for (const a of assignments) {
    if (!a.assignee_name) a.assignee_name = nameOf(a.assignee_id);
  }
  for (const e of events) {
    if (!e.actor_name) e.actor_name = nameOf(e.actor_id);
  }

  return {
    task,
    brief,
    references,
    checklist,
    assignments,
    events,
    creator_name: nameOf(task.created_by),
    assignee_name: nameOf(task.assignee_id),
    claimant_name: nameOf(task.claimed_by),
    my_pending_assignment:
      userId != null
        ? (assignments.find(
            (a) => a.assignee_id === userId && a.status === "pending",
          ) ?? null)
        : null,
  };
}

/** Pending assignments for the signed-in user (lead inbox view). */
export interface MyAssignmentRow {
  assignment: TaskAssignment;
  task: Task | null;
  /** Name of the person who routed the assignment (best effort). */
  assigned_by_name: string | null;
}

export async function fetchMyAssignments(
  userId: string,
): Promise<MyAssignmentRow[]> {
  const { data, error } = await supabase
    .from("task_assignments")
    .select("*, tasks(*)")
    .eq("assignee_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error, "Could not load your assignments.");
  const rows = (data ?? []) as Row[];
  const people = await resolvePeople(
    rows.map((r) => str(r.assigned_by)).filter((v): v is string => !!v),
  );
  return rows.map((r) => {
    const assignment = toAssignment(r);
    const nested = asRecord(r.tasks);
    return {
      assignment,
      task: nested ? toTask(nested) : null,
      assigned_by_name: str(r.assigned_by)
        ? (people.get(String(r.assigned_by))?.name ?? null)
        : null,
    };
  });
}
