/**
 * DesignFlow OS Phase 3 — workflow domain types.
 *
 * Mirrors migration 005 (the DB contract). All mutations go through the
 * SECURITY DEFINER RPCs; reads use RLS-scoped direct selects. Never trust
 * client-supplied actor ids — the server derives identity from auth.uid().
 */
import type { AppRole } from "../../types";
import type { ProductionStatus } from "../../types/tasks";

export type SubmissionStatus =
  | "submitted"
  | "lead_approved"
  | "organizer_approved"
  | "revision_requested"
  | "superseded";

export type RevisionStage =
  | "awaiting_organizer"
  | "awaiting_lead"
  | "with_designer"
  | "resolved";

export type HandoffStatus =
  | "pending"
  | "ready"
  | "superseded"
  | "scheduled"
  | "published";

export interface RefLink {
  label: string;
  url: string;
}

export interface SubmissionRow {
  id: string;
  task_id: string;
  designer_id: string | null;
  drive_link: string;
  source_url: string | null;
  preview_url: string | null;
  notes: string | null;
  version: number;
  reference_links: RefLink[];
  checklist_confirmed: boolean;
  status: SubmissionStatus;
  is_current: boolean;
  submitted_at: string;
  created_at: string;
  /** Enriched client-side where permitted. */
  task_code?: string | null;
  task_title?: string | null;
  designer_name?: string | null;
}

export interface ApprovalRow {
  id: string;
  submission_id: string;
  task_id: string | null;
  submission_version: number | null;
  approver_id: string | null;
  approver_role: AppRole | null;
  stage: "team_lead" | "organizer";
  decision: string;
  comment: string | null;
  created_at: string;
  approver_name?: string | null;
}

export interface RevisionRow {
  id: string;
  submission_id: string;
  task_id: string | null;
  submission_version: number | null;
  requested_by: string | null;
  source_role: AppRole | null;
  request_text: string;
  original_instructions: string | null;
  clarification: string | null;
  reference_urls: RefLink[];
  priority: string | null;
  suggested_deadline: string | null;
  current_stage: RevisionStage;
  current_owner_id: string | null;
  status: string;
  acknowledged_at: string | null;
  forwarded_at: string | null;
  resolved_at: string | null;
  resolved_by_submission_id: string | null;
  created_at: string;
  requester_name?: string | null;
  task_code?: string | null;
  task_title?: string | null;
}

export interface RoutingEventRow {
  id: string;
  revision_id: string;
  actor_id: string | null;
  from_stage: string | null;
  to_stage: string | null;
  action: "requested" | "acknowledged" | "forwarded" | "resolved";
  note: string | null;
  created_at: string;
  actor_name?: string | null;
}

export interface HandoffRow {
  id: string;
  task_id: string;
  submission_id: string | null;
  submission_version: number | null;
  platform: string | null;
  caption: string | null;
  hashtags: string | null;
  drive_link: string | null;
  source_url: string | null;
  instructions: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: HandoffStatus;
  is_current: boolean;
  organizer_approved_at: string | null;
  managed_by: string | null;
  created_at: string;
  updated_at: string;
  task_code?: string | null;
  task_title?: string | null;
}

/* ------------------------------------------------------------------ */
/* Review queue rows (RPC return shapes, migration 005 §17).            */
/* ------------------------------------------------------------------ */

export interface LeadQueueItem {
  submission_id: string;
  task_id: string;
  task_code: string | null;
  title: string;
  version: number;
  designer_id: string | null;
  designer_name: string | null;
  drive_link: string | null;
  source_url: string | null;
  submitted_at: string | null;
  due_date: string | null;
  priority: string | null;
}

export interface OrganizerQueueItem extends LeadQueueItem {
  lead_id: string | null;
  lead_name: string | null;
}

export interface SmmQueueItem {
  handoff_id: string;
  task_id: string;
  task_code: string | null;
  title: string | null;
  version: number | null;
  drive_link: string | null;
  source_url: string | null;
  caption: string | null;
  hashtags: string | null;
  platform: string | null;
  instructions: string | null;
  approved_at: string | null;
}

/* ------------------------------------------------------------------ */
/* RPC input shapes.                                                   */
/* ------------------------------------------------------------------ */

export interface SubmitDesignInput {
  drive_link: string;
  source_url?: string | null;
  preview_url?: string | null;
  notes?: string | null;
  checklist_confirmed: boolean;
  reference_links?: RefLink[];
}

export interface RequestRevisionInput {
  instructions: string;
  priority?: string | null;
  deadline?: string | null; // ISO timestamp
  reference_urls?: RefLink[];
}

/* ------------------------------------------------------------------ */
/* Workflow progress model (derived client-side from task status).      */
/* ------------------------------------------------------------------ */

export type WorkflowStageKey =
  | "design"
  | "lead_review"
  | "organizer_review"
  | "publishing"
  | "revision";

export interface WorkflowStage {
  key: WorkflowStageKey;
  label: string;
  state: "done" | "current" | "upcoming" | "blocked";
  detail?: string | null;
}

/** Maps a production status onto the 4-stage pipeline for the progress UI. */
export function workflowStagesFor(
  status: ProductionStatus,
): WorkflowStage[] {
  const done = (label: string): WorkflowStage => ({
    key: "design",
    label,
    state: "done",
  });
  switch (status) {
    case "submitted_lead_review":
      return [
        done("Design"),
        { key: "lead_review", label: "Team Lead review", state: "current" },
        { key: "organizer_review", label: "Organizer review", state: "upcoming" },
        { key: "publishing", label: "Publishing", state: "upcoming" },
      ];
    case "submitted_organizer_review":
      return [
        done("Design"),
        { key: "lead_review", label: "Team Lead review", state: "done" },
        { key: "organizer_review", label: "Organizer review", state: "current" },
        { key: "publishing", label: "Publishing", state: "upcoming" },
      ];
    case "ready_for_publishing":
      return [
        done("Design"),
        { key: "lead_review", label: "Team Lead review", state: "done" },
        { key: "organizer_review", label: "Organizer review", state: "done" },
        { key: "publishing", label: "Publishing", state: "current" },
      ];
    case "revision_awaiting_organizer":
    case "revision_awaiting_lead":
    case "revision_required_designer":
      return [
        { key: "revision", label: "Revision in progress", state: "blocked" },
        { key: "lead_review", label: "Team Lead review", state: "upcoming" },
        { key: "organizer_review", label: "Organizer review", state: "upcoming" },
        { key: "publishing", label: "Publishing", state: "upcoming" },
      ];
    case "published":
      return [
        done("Design"),
        { key: "lead_review", label: "Team Lead review", state: "done" },
        { key: "organizer_review", label: "Organizer review", state: "done" },
        { key: "publishing", label: "Published", state: "done" },
      ];
    default:
      return [
        { key: "design", label: "Design", state: "current" },
        { key: "lead_review", label: "Team Lead review", state: "upcoming" },
        { key: "organizer_review", label: "Organizer review", state: "upcoming" },
        { key: "publishing", label: "Publishing", state: "upcoming" },
      ];
  }
}

export const SUBMISSION_STATUS_META: Record<
  SubmissionStatus,
  { label: string; variant: "default" | "volt" | "outline" | "success" | "warning" | "danger" | "muted" }
> = {
  submitted: { label: "Submitted", variant: "warning" },
  lead_approved: { label: "Lead approved", variant: "default" },
  organizer_approved: { label: "Approved", variant: "success" },
  revision_requested: { label: "Revision requested", variant: "danger" },
  superseded: { label: "Superseded", variant: "muted" },
};

export const REVISION_STAGE_META: Record<
  RevisionStage,
  { label: string; variant: "default" | "volt" | "outline" | "success" | "warning" | "danger" | "muted" }
> = {
  awaiting_organizer: { label: "Awaiting organizer", variant: "warning" },
  awaiting_lead: { label: "Awaiting team lead", variant: "warning" },
  with_designer: { label: "With designer", variant: "danger" },
  resolved: { label: "Resolved", variant: "success" },
};

/** Approved hosts for design URLs (mirrors migration 005 server regex). */
export const APPROVED_DESIGN_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "figma.com",
  "canva.com",
  "dropbox.com",
  "notion.so",
  "miro.com",
] as const;

/** Client-side URL check mirroring `_is_approved_design_url`. */
export function isApprovedDesignUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url.toLowerCase().startsWith("https://")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return APPROVED_DESIGN_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}
