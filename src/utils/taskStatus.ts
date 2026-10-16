/**
 * Production-status metadata + client-side mirror of the server transition map.
 *
 * Server map (migrations 003 + 005):
 *   draft      -> available | cancelled
 *   available  -> assigned  | cancelled
 *   assigned   -> accepted | in_progress | cancelled
 *   accepted   -> in_progress | cancelled
 *   in_progress -> cancelled
 * Phase 3 states (submitted_lead_review, submitted_organizer_review,
 * ready_for_publishing, revision_awaiting_organizer, revision_awaiting_lead,
 * revision_required_designer) are RPC-driven only — no manual transitions.
 *
 * The server always enforces the real rules; `canPerformTransition` mirrors
 * them so the UI only offers (and the kanban only accepts) transitions the
 * current user may plausibly perform.
 */
import type { AppRole } from "../types";
import type {
  ProductionStatus,
  TaskPriority,
  TaskVisibility,
} from "../types/tasks";
import type { badgeVariants } from "../components/ui/badge";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export const PRODUCTION_STATUSES: ProductionStatus[] = [
  "draft",
  "available",
  "assigned",
  "accepted",
  "in_progress",
  "submitted_lead_review",
  "submitted_organizer_review",
  "ready_for_publishing",
  "revision_awaiting_organizer",
  "revision_awaiting_lead",
  "revision_required_designer",
  "published",
  "cancelled",
];

export const STATUS_META: Record<
  ProductionStatus,
  { label: string; badge: BadgeVariant; hint: string }
> = {
  draft: {
    label: "Draft",
    badge: "muted",
    hint: "Not published yet. Only the creator can see it.",
  },
  available: {
    label: "Available",
    badge: "volt",
    hint: "Published. Designers can claim it.",
  },
  assigned: {
    label: "Assigned",
    badge: "warning",
    hint: "Handed to a designer, awaiting acceptance.",
  },
  accepted: {
    label: "Accepted",
    badge: "default",
    hint: "Designer accepted. Work has not started yet.",
  },
  in_progress: {
    label: "In progress",
    badge: "success",
    hint: "Designer is actively working on it.",
  },
  cancelled: {
    label: "Cancelled",
    badge: "danger",
    hint: "Cancelled. Terminal state.",
  },
  submitted_lead_review: {
    label: "Lead review",
    badge: "warning",
    hint: "Submitted. Awaiting Team Lead review.",
  },
  submitted_organizer_review: {
    label: "Organizer review",
    badge: "warning",
    hint: "Team Lead approved. Awaiting Organizer review.",
  },
  ready_for_publishing: {
    label: "Ready for publishing",
    badge: "success",
    hint: "Organizer approved. Available to Social Media.",
  },
  revision_awaiting_organizer: {
    label: "Revision: organizer",
    badge: "danger",
    hint: "Revision requested. Awaiting Organizer action.",
  },
  revision_awaiting_lead: {
    label: "Revision: lead",
    badge: "danger",
    hint: "Revision requested. Awaiting Team Lead action.",
  },
  revision_required_designer: {
    label: "Revision required",
    badge: "danger",
    hint: "Changes requested. Designer must submit a new version.",
  },
  published: {
    label: "Published",
    badge: "volt",
    hint: "All platforms published.",
  },
};

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: BadgeVariant }
> = {
  low: { label: "Low", badge: "muted" },
  normal: { label: "Normal", badge: "default" },
  high: { label: "High", badge: "warning" },
  urgent: { label: "Urgent", badge: "danger" },
  critical: { label: "Critical", badge: "danger" },
};

export const VISIBILITY_META: Record<
  TaskVisibility,
  { label: string; badge: BadgeVariant }
> = {
  public: { label: "Public", badge: "volt" },
  private: { label: "Private", badge: "outline" },
};

/** Server transition map — the single source for legal status changes. */
export const TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  draft: ["available", "cancelled"],
  available: ["assigned", "cancelled"],
  assigned: ["accepted", "in_progress", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["cancelled"],
  // Phase 3 workflow states are action-driven (RPC only) — never
  // kanban-draggable and never offered as manual transitions.
  submitted_lead_review: [],
  submitted_organizer_review: [],
  ready_for_publishing: [],
  revision_awaiting_organizer: [],
  revision_awaiting_lead: [],
  revision_required_designer: [],
  // Phase 4: published is terminal — set only by the mark_published RPC once
  // every required platform record is published.
  published: [],
  cancelled: [],
};

export interface TransitionContext {
  from: ProductionStatus;
  to: ProductionStatus;
  role: AppRole | null;
  userId: string | null;
  task: {
    created_by: string | null;
    assignee_id: string | null;
    claimed_by: string | null;
    visibility: TaskVisibility;
  };
}

/**
 * Client-side mirror of who may perform a transition. The RPCs re-check
 * everything server-side; this only gates UI affordances (buttons, kanban
 * drops) so users never see an action that will be rejected.
 */
export function canPerformTransition(ctx: TransitionContext): boolean {
  const { from, to, role, userId, task } = ctx;
  if (!(TRANSITIONS[from] ?? []).includes(to)) return false;

  const isCreator = !!userId && task.created_by === userId;
  const isAssignee =
    !!userId && (task.assignee_id === userId || task.claimed_by === userId);

  switch (to) {
    case "cancelled":
      // Organizers can cancel anything; creators can cancel their own.
      return role === "organizer" || isCreator;
    case "available":
      // Publishing a draft: organizers, or the team lead who created it.
      return role === "organizer" || (role === "team_lead" && isCreator);
    case "assigned":
      // Claiming: a designer picking up a public, available task.
      return (
        from === "available" &&
        role === "designer" &&
        task.visibility === "public"
      );
    case "accepted":
      // Accepting an assignment is the assignee's own action.
      return from === "assigned" && isAssignee;
    case "in_progress":
      // Starting work: the assignee; organizers can also move it along.
      return isAssignee || role === "organizer";
    default:
      return false;
  }
}

/** Transitions the current user may perform from `from`, in map order. */
export function allowedNextStatuses(
  from: ProductionStatus,
  role: AppRole | null,
  userId: string | null,
  task: TransitionContext["task"],
): ProductionStatus[] {
  return (TRANSITIONS[from] ?? []).filter((to) =>
    canPerformTransition({ from, to, role, userId, task }),
  );
}

/** Short human label for an activity event type, with a snake_case fallback. */
export function eventLabel(eventType: string): string {
  const known: Record<string, string> = {
    task_created: "Task created",
    task_published: "Task published",
    task_claimed: "Task claimed",
    task_updated: "Task updated",
    assignment_created: "Assignment created",
    assignment_accepted: "Assignment accepted",
    assignment_declined: "Assignment declined",
    task_reassigned: "Task reassigned",
    status_changed: "Status changed",
    task_cancelled: "Task cancelled",
    checklist_toggled: "Checklist updated",
    design_submitted: "Design submitted",
    team_lead_approved: "Team Lead approved",
    revision_requested: "Revision requested",
    revision_acknowledged: "Revision acknowledged",
    revision_forwarded: "Revision forwarded",
    organizer_approved: "Organizer approved",
  };
  return (
    known[eventType] ??
    eventType
      .split("_")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ")
  );
}
