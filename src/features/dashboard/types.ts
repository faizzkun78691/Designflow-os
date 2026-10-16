/**
 * Shared dashboard types for DesignFlow OS Phase 2.
 *
 * These follow the Phase 2 backend contract (migration 003): the tasks table
 * exposes `production_status`, `visibility`, `task_code`, etc. If the task-UI
 * track lands `src/types/tasks.ts`, these dashboard-local types can be
 * replaced by imports from there — the shapes are intentionally compatible.
 */

/** A task row as selected by dashboard queries (contract column names). */
export interface DashboardTask {
  id: string;
  task_code: string | null;
  title: string;
  visibility: string | null;
  production_status: string;
  priority: string | null;
  due_date: string | null;
  created_by: string | null;
  assigned_designer_id: string | null;
  assigned_lead_id: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  campaign_name: string | null;
  design_category: string | null;
  target_platform: string | null;
  created_at: string;
}

/** Minimal public-board row returned by the `get_task_board()` RPC. */
export interface TaskBoardRow {
  id: string;
  task_code: string | null;
  title: string;
  production_status: string;
  priority: string | null;
  due_date: string | null;
  claimed_by: string | null;
  claimant_name: string | null;
}

/** A task event with its task resolved for display. */
export interface DashboardTaskEvent {
  id: string;
  task_id: string;
  actor_id: string | null;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  task_title: string | null;
  task_code: string | null;
}

/** A notification row (own rows only, per RLS). */
export interface AppNotification {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

/** Per-designer workload summary. */
export interface DesignerWorkloadRow {
  designer_id: string;
  full_name: string;
  avatar_url: string | null;
  active_count: number;
  overdue_count: number;
}

/** Columns selected by every dashboard task query (contract names). */
export const TASK_COLUMNS =
  "id, task_code, title, visibility, production_status, priority, due_date, created_by, assigned_designer_id, assigned_lead_id, claimed_by, claimed_at, campaign_name, design_category, target_platform, created_at";

/* ------------------------------------------------------------------ */
/* Production-status vocabulary (migration 003 contract).              */
/* ------------------------------------------------------------------ */

export const TASK_STATUS = {
  AVAILABLE: "available",
  CLAIMED: "claimed",
  IN_PROGRESS: "in_progress",
  IN_REVISION: "in_revision",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  READY: "ready",
  PUBLISHED: "published",
  CANCELLED: "cancelled",
  // Phase 3 workflow states (migration 005 contract).
  SUBMITTED_LEAD_REVIEW: "submitted_lead_review",
  SUBMITTED_ORGANIZER_REVIEW: "submitted_organizer_review",
  READY_FOR_PUBLISHING: "ready_for_publishing",
  REVISION_AWAITING_ORGANIZER: "revision_awaiting_organizer",
  REVISION_AWAITING_LEAD: "revision_awaiting_lead",
  REVISION_REQUIRED_DESIGNER: "revision_required_designer",
} as const;

/** Statuses where the task still needs work (overdue-eligible). */
export const ACTIVE_STATUSES: readonly string[] = [
  TASK_STATUS.CLAIMED,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.IN_REVISION,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.APPROVED,
  TASK_STATUS.READY,
];

/** Ordered pipeline stages for the organizer pipeline strip. */
export const PIPELINE_STAGES: readonly string[] = [
  TASK_STATUS.AVAILABLE,
  TASK_STATUS.CLAIMED,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.IN_REVISION,
  TASK_STATUS.SUBMITTED,
  TASK_STATUS.APPROVED,
  TASK_STATUS.READY,
  TASK_STATUS.PUBLISHED,
];

const STATUS_LABELS: Record<string, string> = {
  [TASK_STATUS.AVAILABLE]: "Available",
  [TASK_STATUS.CLAIMED]: "Claimed",
  [TASK_STATUS.IN_PROGRESS]: "In progress",
  [TASK_STATUS.IN_REVISION]: "In revision",
  [TASK_STATUS.SUBMITTED]: "Submitted",
  [TASK_STATUS.APPROVED]: "Approved",
  [TASK_STATUS.READY]: "Ready",
  [TASK_STATUS.PUBLISHED]: "Published",
  [TASK_STATUS.CANCELLED]: "Cancelled",
  [TASK_STATUS.SUBMITTED_LEAD_REVIEW]: "Lead review",
  [TASK_STATUS.SUBMITTED_ORGANIZER_REVIEW]: "Organizer review",
  [TASK_STATUS.READY_FOR_PUBLISHING]: "Ready for publishing",
  [TASK_STATUS.REVISION_AWAITING_ORGANIZER]: "Revision: organizer",
  [TASK_STATUS.REVISION_AWAITING_LEAD]: "Revision: lead",
  [TASK_STATUS.REVISION_REQUIRED_DESIGNER]: "Revision required",
};

/** Human label for a production status; falls back to a title-cased guess. */
export function productionStatusLabel(status: string): string {
  return (
    STATUS_LABELS[status] ??
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/** Badge variant for a production status. */
export function productionStatusVariant(
  status: string,
): "default" | "volt" | "outline" | "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case TASK_STATUS.AVAILABLE:
      return "volt";
    case TASK_STATUS.CLAIMED:
    case TASK_STATUS.IN_REVISION:
      return "warning";
    case TASK_STATUS.IN_PROGRESS:
      return "default";
    case TASK_STATUS.SUBMITTED:
      return "outline";
    case TASK_STATUS.APPROVED:
    case TASK_STATUS.READY:
      return "success";
    case TASK_STATUS.PUBLISHED:
      return "muted";
    case TASK_STATUS.CANCELLED:
      return "danger";
    case TASK_STATUS.SUBMITTED_LEAD_REVIEW:
    case TASK_STATUS.SUBMITTED_ORGANIZER_REVIEW:
      return "warning";
    case TASK_STATUS.READY_FOR_PUBLISHING:
      return "success";
    case TASK_STATUS.REVISION_AWAITING_ORGANIZER:
    case TASK_STATUS.REVISION_AWAITING_LEAD:
    case TASK_STATUS.REVISION_REQUIRED_DESIGNER:
      return "danger";
    default:
      return "outline";
  }
}

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** True when the task is past due and still in an active status. */
export function isOverdue(
  task: { due_date: string | null; production_status: string },
  now: number = Date.now(),
): boolean {
  if (!task.due_date) return false;
  if (!isActiveStatus(task.production_status)) return false;
  return new Date(task.due_date).getTime() < now;
}

/** Human label for a task event type. */
export function eventTypeLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
