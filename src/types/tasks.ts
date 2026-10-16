/**
 * Task system domain types — DesignFlow OS Phase 2.
 *
 * These mirror the backend RPC contract (migration 003). Other tracks import
 * from this file, so keep every exported name stable.
 */

export type ProductionStatus =
  | "draft"
  | "available"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "cancelled"
  | "submitted_lead_review"
  | "submitted_organizer_review"
  | "ready_for_publishing"
  | "revision_awaiting_organizer"
  | "revision_awaiting_lead"
  | "revision_required_designer"
  | "published";

export type TaskVisibility = "public" | "private";

export type TaskPriority = "low" | "normal" | "high" | "urgent" | "critical";

export type TaskDifficulty = "easy" | "medium" | "hard";

export type ReferenceKind =
  | "inspiration"
  | "asset"
  | "guideline"
  | "reference"
  | "other";

export type AssignmentStatus = "pending" | "accepted" | "declined";

/** Design-spec blob stored with the task (section C of the wizard). */
export interface TaskSpec {
  design_type?: string;
  preset?: string;
  width?: number | null;
  height?: number | null;
  orientation?: string;
  slides?: number | null;
  format?: string;
  source_file_required?: boolean;
  brand_colors?: string;
  fonts?: string;
  style?: string;
  background?: string;
  mandatory_elements?: string;
  avoid_elements?: string;
}

/** Social-content blob stored with the task (section F of the wizard). */
export interface TaskSocial {
  caption?: string;
  hashtags?: string;
  mentions?: string;
  cta?: string;
  platform?: string;
  preferred_publish_at?: string | null;
  instructions?: string;
}

/** Canonical task row. `assignee_id` is the contract name; the service mapper
 *  also accepts the legacy `assigned_designer_id` column as a fallback. */
export interface Task {
  id: string;
  task_code: string | null;
  title: string;
  description: string | null;
  visibility: TaskVisibility;
  production_status: ProductionStatus;
  priority: TaskPriority;
  due_date: string | null;
  timezone: string | null;
  difficulty: TaskDifficulty | null;
  est_hours: number | null;
  campaign_name: string | null;
  design_category: string | null;
  target_platform: string | null;
  created_by: string | null;
  assignee_id: string | null;
  assign_lead_id: string | null;
  claimed_by: string | null;
  spec: TaskSpec | null;
  social: TaskSocial | null;
  created_at: string;
  updated_at: string;
}

export interface TaskBrief {
  id: string;
  task_id: string;
  objective: string | null;
  audience: string | null;
  headlines: string | null;
  mandatory_copy: string | null;
  concept: string | null;
  layout: string | null;
  color_type_instructions: string | null;
  cta: string | null;
  notes: string | null;
  /** Legacy/simple fallback when the backend stores the brief as plain text. */
  brief_text: string | null;
  created_at: string;
}

export interface TaskReference {
  id: string;
  task_id: string;
  label: string;
  url: string;
  kind: ReferenceKind;
  created_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  label: string;
  is_done: boolean;
  position: number;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  assignee_id: string;
  assigned_by: string | null;
  status: AssignmentStatus;
  reason: string | null;
  created_at: string;
  assignee_name: string | null;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  actor_name: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Row shape returned by the `get_task_board()` RPC. */
export interface TaskBoardRow {
  id: string;
  task_code: string | null;
  title: string;
  production_status: ProductionStatus;
  priority: TaskPriority;
  due_date: string | null;
  claimed_by: string | null;
  claimant_name: string | null;
  visibility?: TaskVisibility | null;
  created_by?: string | null;
  assignee_id?: string | null;
}

export interface WorkloadUpcomingItem {
  task_id: string;
  task_code: string | null;
  title: string;
  due_date: string | null;
  production_status: ProductionStatus;
}

/** Shape returned by the `get_designer_workload(p_user_id)` RPC. */
export interface WorkloadInfo {
  active_count: number;
  overdue_count: number;
  upcoming: WorkloadUpcomingItem[];
}

/** Payload for the `create_task(p_payload)` RPC. */
export interface CreateTaskPayload {
  title: string;
  description?: string;
  visibility: TaskVisibility;
  priority: TaskPriority;
  due_date: string | null;
  timezone: string;
  difficulty?: TaskDifficulty;
  est_hours?: number | null;
  campaign_name?: string;
  design_category?: string;
  target_platform?: string;
  assignee_id?: string | null;
  assign_lead_id?: string | null;
  publish: boolean;
  spec: Record<string, unknown>;
  brief: Record<string, unknown>;
  social: Record<string, unknown>;
  references: { label: string; url: string; kind: string }[];
  checklist: string[];
}

export interface CreateTaskResult {
  task_id: string;
  task_code: string | null;
  duplicate_warning: string | null;
}

/** Patch for the `update_task(p_task_id, p_patch)` RPC. */
export interface TaskPatch {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  visibility?: TaskVisibility;
  due_date?: string | null;
  timezone?: string;
  difficulty?: TaskDifficulty;
  est_hours?: number | null;
  campaign_name?: string;
  design_category?: string;
  target_platform?: string;
  spec?: Record<string, unknown>;
  social?: Record<string, unknown>;
}

/** Full task detail aggregate for the TaskDetail page. */
export interface TaskDetail {
  task: Task;
  brief: TaskBrief | null;
  references: TaskReference[];
  checklist: TaskChecklistItem[];
  assignments: TaskAssignment[];
  events: TaskEvent[];
  creator_name: string | null;
  assignee_name: string | null;
  claimant_name: string | null;
  /** The signed-in user's pending assignment on this task, if any. */
  my_pending_assignment: TaskAssignment | null;
}

/** Team member option for the workload picker (profile + role + workload). */
export interface TaskMemberOption {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  avatar_url: string | null;
  is_active: boolean;
  role: string | null;
}

/* ------------------------------------------------------------------ */
/* List filters                                                        */
/* ------------------------------------------------------------------ */

export type DeadlineFilter =
  | "all"
  | "overdue"
  | "today"
  | "this_week"
  | "no_deadline";

export type AssignmentFilter = "all" | "mine" | "unassigned";

export type TaskSortKey = "due_date" | "created_at" | "priority";

export interface TaskListFilters {
  search: string;
  statuses: ProductionStatus[];
  priorities: TaskPriority[];
  visibility: TaskVisibility | "all";
  deadline: DeadlineFilter;
  assignment: AssignmentFilter;
  /** Filter by creator; the string "me" resolves to the signed-in user. */
  createdBy: string;
  /** Filter by routed lead; the string "me" resolves to the signed-in user. */
  assignLeadId: string;
  page: number;
  pageSize: number;
  sort: TaskSortKey;
  order: "asc" | "desc";
}

export const DEFAULT_TASK_FILTERS: TaskListFilters = {
  search: "",
  statuses: [],
  priorities: [],
  visibility: "all",
  deadline: "all",
  assignment: "all",
  createdBy: "",
  assignLeadId: "",
  page: 0,
  pageSize: 12,
  sort: "created_at",
  order: "desc",
};
