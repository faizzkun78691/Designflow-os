/**
 * Workflow data access — DesignFlow OS Phase 3.
 *
 * All mutations go through the backend RPCs (migration 005, SECURITY
 * DEFINER). Reads use RLS-scoped direct selects. NEVER direct
 * INSERT/UPDATE/DELETE on workflow tables — always via RPC.
 */
import { supabase } from "../../../integrations/supabase/client";
import type { AppRole } from "../../../types";
import type {
  ApprovalRow,
  HandoffRow,
  HandoffStatus,
  LeadQueueItem,
  OrganizerQueueItem,
  RefLink,
  RequestRevisionInput,
  RevisionRow,
  RevisionStage,
  RoutingEventRow,
  SmmQueueItem,
  SubmissionRow,
  SubmissionStatus,
  SubmitDesignInput,
} from "../types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    const m = error.message.toLowerCase();
    if (m.includes("permission") || m.includes("not allowed") || m.includes("not permitted"))
      return new Error("You don't have permission for this action.");
    if (m.includes("not found"))
      return new Error("The requested record no longer exists.");
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

function asRefLinks(v: unknown): RefLink[] {
  if (!Array.isArray(v)) return [];
  const out: RefLink[] = [];
  for (const item of v) {
    if (typeof item === "object" && item !== null) {
      const r = item as Record<string, unknown>;
      const url = str(r.url);
      if (url) out.push({ label: str(r.label) ?? url, url });
    } else if (typeof item === "string" && item.length > 0) {
      out.push({ label: item, url: item });
    }
  }
  return out;
}

const VALID_SUBMISSION_STATUSES = new Set([
  "submitted",
  "lead_approved",
  "organizer_approved",
  "revision_requested",
  "superseded",
]);

const VALID_REVISION_STAGES = new Set([
  "awaiting_organizer",
  "awaiting_lead",
  "with_designer",
  "resolved",
]);

const VALID_HANDOFF_STATUSES = new Set([
  "pending",
  "ready",
  "superseded",
  "scheduled",
  "published",
]);

function toSubmission(row: Row): SubmissionRow {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    designer_id: str(row.designer_id),
    drive_link: String(row.drive_link ?? ""),
    source_url: str(row.source_url),
    preview_url: str(row.preview_url),
    notes: str(row.notes),
    version: num(row.version) ?? 1,
    reference_links: asRefLinks(row.reference_links),
    checklist_confirmed: bool(row.checklist_confirmed),
    status: VALID_SUBMISSION_STATUSES.has(String(row.status))
      ? (row.status as SubmissionStatus)
      : "submitted",
    is_current: bool(row.is_current),
    submitted_at: String(row.submitted_at ?? row.created_at ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

function toApproval(row: Row): ApprovalRow {
  const stage = row.stage === "organizer" ? "organizer" : "team_lead";
  return {
    id: String(row.id),
    submission_id: String(row.submission_id),
    task_id: str(row.task_id),
    submission_version: num(row.submission_version),
    approver_id: str(row.approver_id),
    approver_role: (row.approver_role as AppRole | null) ?? null,
    stage,
    decision: String(row.decision ?? ""),
    comment: str(row.comment),
    created_at: String(row.created_at ?? ""),
  };
}

function toRevision(row: Row): RevisionRow {
  return {
    id: String(row.id),
    submission_id: String(row.submission_id),
    task_id: str(row.task_id),
    submission_version: num(row.submission_version),
    requested_by: str(row.requested_by),
    source_role: (row.source_role as AppRole | null) ?? null,
    request_text: String(row.request_text ?? ""),
    original_instructions: str(row.original_instructions),
    clarification: str(row.clarification),
    reference_urls: asRefLinks(row.reference_urls),
    priority: str(row.priority),
    suggested_deadline: str(row.suggested_deadline),
    current_stage: VALID_REVISION_STAGES.has(String(row.current_stage))
      ? (row.current_stage as RevisionStage)
      : "with_designer",
    current_owner_id: str(row.current_owner_id),
    status: String(row.status ?? "open"),
    acknowledged_at: str(row.acknowledged_at),
    forwarded_at: str(row.forwarded_at),
    resolved_at: str(row.resolved_at),
    resolved_by_submission_id: str(row.resolved_by_submission_id),
    created_at: String(row.created_at ?? ""),
  };
}

function toRoutingEvent(row: Row): RoutingEventRow {
  const action = row.action as RoutingEventRow["action"];
  return {
    id: String(row.id),
    revision_id: String(row.revision_id),
    actor_id: str(row.actor_id),
    from_stage: str(row.from_stage),
    to_stage: str(row.to_stage),
    action:
      action === "requested" ||
      action === "acknowledged" ||
      action === "forwarded" ||
      action === "resolved"
        ? action
        : "requested",
    note: str(row.note),
    created_at: String(row.created_at ?? ""),
  };
}

function toHandoff(row: Row): HandoffRow {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    submission_id: str(row.submission_id),
    submission_version: num(row.submission_version),
    platform: str(row.platform),
    caption: str(row.caption),
    hashtags: str(row.hashtags),
    drive_link: str(row.drive_link),
    source_url: str(row.source_url),
    instructions: str(row.instructions),
    preferred_date: str(row.preferred_date),
    preferred_time: str(row.preferred_time),
    status: VALID_HANDOFF_STATUSES.has(String(row.status))
      ? (row.status as HandoffStatus)
      : "pending",
    is_current: bool(row.is_current),
    organizer_approved_at: str(row.organizer_approved_at),
    managed_by: str(row.managed_by),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/* ------------------------------------------------------------------ */
/* RPC mutations                                                       */
/* ------------------------------------------------------------------ */

/** Designer submits work; returns the new submission id. */
export async function submitDesign(
  taskId: string,
  input: SubmitDesignInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_design", {
    p_task_id: taskId,
    p_drive_link: input.drive_link.trim(),
    p_source_url: input.source_url?.trim() || null,
    p_preview_url: input.preview_url?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_checklist_confirmed: input.checklist_confirmed,
    p_reference_links: (input.reference_links ?? []).map((l) => ({
      label: l.label,
      url: l.url,
    })),
  });
  if (error) throw friendly(error, "Could not submit the design.");
  return String(data);
}

export async function approveAsTeamLead(
  submissionId: string,
  comment?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("approve_as_team_lead", {
    p_submission_id: submissionId,
    p_comment: comment?.trim() || null,
  });
  if (error) throw friendly(error, "Could not approve the submission.");
}

export async function requestTeamLeadRevision(
  submissionId: string,
  input: RequestRevisionInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_team_lead_revision", {
    p_submission_id: submissionId,
    p_instructions: input.instructions.trim(),
    p_priority: input.priority || null,
    p_deadline: input.deadline || null,
    p_reference_urls: (input.reference_urls ?? []).map((l) => ({
      label: l.label,
      url: l.url,
    })),
  });
  if (error) throw friendly(error, "Could not request changes.");
  return String(data);
}

/** Organizer final approval; returns the new handoff id. */
export async function approveAsOrganizer(
  submissionId: string,
  comment?: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc("approve_as_organizer", {
    p_submission_id: submissionId,
    p_comment: comment?.trim() || null,
  });
  if (error) throw friendly(error, "Could not approve the submission.");
  return String(data);
}

export async function requestOrganizerRevision(
  submissionId: string,
  input: RequestRevisionInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_organizer_revision", {
    p_submission_id: submissionId,
    p_instructions: input.instructions.trim(),
    p_priority: input.priority || null,
    p_deadline: input.deadline || null,
    p_reference_urls: (input.reference_urls ?? []).map((l) => ({
      label: l.label,
      url: l.url,
    })),
  });
  if (error) throw friendly(error, "Could not request changes.");
  return String(data);
}

export async function requestSocialMediaRevision(
  handoffId: string,
  input: RequestRevisionInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_social_media_revision", {
    p_handoff_id: handoffId,
    p_instructions: input.instructions.trim(),
    p_priority: input.priority || null,
    p_deadline: input.deadline || null,
    p_reference_urls: (input.reference_urls ?? []).map((l) => ({
      label: l.label,
      url: l.url,
    })),
  });
  if (error) throw friendly(error, "Could not request changes.");
  return String(data);
}

export async function acknowledgeRevision(revisionId: string): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_revision", {
    p_revision_id: revisionId,
  });
  if (error) throw friendly(error, "Could not acknowledge the revision.");
}

export async function forwardRevision(
  revisionId: string,
  clarification?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("forward_revision", {
    p_revision_id: revisionId,
    p_clarification: clarification?.trim() || null,
  });
  if (error) throw friendly(error, "Could not forward the revision.");
}

/* ------------------------------------------------------------------ */
/* RPC review queues                                                   */
/* ------------------------------------------------------------------ */

function toLeadQueueItem(row: Row): LeadQueueItem {
  return {
    submission_id: String(row.submission_id),
    task_id: String(row.task_id),
    task_code: str(row.task_code),
    title: String(row.title ?? "Untitled task"),
    version: num(row.version) ?? 1,
    designer_id: str(row.designer_id),
    designer_name: str(row.designer_name),
    drive_link: str(row.drive_link),
    source_url: str(row.source_url),
    submitted_at: str(row.submitted_at),
    due_date: str(row.due_date),
    priority: str(row.priority),
  };
}

export async function getLeadReviewQueue(): Promise<LeadQueueItem[]> {
  const { data, error } = await supabase.rpc("get_lead_review_queue");
  if (error) throw friendly(error, "Could not load the review queue.");
  return ((data ?? []) as Row[]).map(toLeadQueueItem);
}

export async function getOrganizerReviewQueue(): Promise<OrganizerQueueItem[]> {
  const { data, error } = await supabase.rpc("get_organizer_review_queue");
  if (error) throw friendly(error, "Could not load the approval queue.");
  return ((data ?? []) as Row[]).map((row) => ({
    ...toLeadQueueItem(row),
    lead_id: str(row.lead_id),
    lead_name: str(row.lead_name),
  }));
}

export async function getSmmReadyQueue(): Promise<SmmQueueItem[]> {
  const { data, error } = await supabase.rpc("get_smm_ready_queue");
  if (error) throw friendly(error, "Could not load the ready queue.");
  return ((data ?? []) as Row[]).map((row) => ({
    handoff_id: String(row.handoff_id),
    task_id: String(row.task_id),
    task_code: str(row.task_code),
    title: str(row.title),
    version: num(row.version),
    drive_link: str(row.drive_link),
    source_url: str(row.source_url),
    caption: str(row.caption),
    hashtags: str(row.hashtags),
    platform: str(row.platform),
    instructions: str(row.instructions),
    approved_at: str(row.approved_at),
  }));
}

/* ------------------------------------------------------------------ */
/* RLS-scoped direct reads                                             */
/* ------------------------------------------------------------------ */

/** All versions of a task, newest first. */
export async function listSubmissions(taskId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("task_submissions")
    .select("*")
    .eq("task_id", taskId)
    .order("version", { ascending: false });
  if (error) throw friendly(error, "Could not load submissions.");
  return ((data ?? []) as Row[]).map(toSubmission);
}

/** Designer's own submissions across tasks (for the Submissions page). */
export async function listMySubmissions(
  designerId: string,
): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("task_submissions")
    .select("*, tasks!inner(task_code, title)")
    .eq("designer_id", designerId)
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (error) throw friendly(error, "Could not load your submissions.");
  return ((data ?? []) as Row[]).map((row) => {
    const s = toSubmission(row);
    const t = row.tasks as Row | null;
    if (t && typeof t === "object") {
      s.task_code = str(t.task_code);
      s.task_title = str(t.title);
    }
    return s;
  });
}

export async function listApprovals(
  submissionId: string,
): Promise<ApprovalRow[]> {
  const { data, error } = await supabase
    .from("task_approvals")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });
  if (error) throw friendly(error, "Could not load approvals.");
  return ((data ?? []) as Row[]).map(toApproval);
}

/** Open revisions, optionally scoped to a task and/or routing stage.
 * RLS applies. Set withTaskMeta=false for callers who cannot read the
 * tasks table (e.g. Social Media Manager) — the tasks!inner join would
 * otherwise filter every row out. */
export async function listOpenRevisions(
  taskId?: string,
  opts?: { stage?: RevisionStage; withTaskMeta?: boolean },
): Promise<RevisionRow[]> {
  const withTaskMeta = opts?.withTaskMeta !== false;
  // Dynamic column list defeats the client's literal-type query inference,
  // so select as "*" and map rows defensively via the Row helpers.
  const columns = (
    withTaskMeta ? "*, tasks!inner(task_code, title)" : "*"
  ) as "*";
  let q = supabase
    .from("revision_requests")
    .select(columns)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (taskId) q = q.eq("task_id", taskId);
  if (opts?.stage) q = q.eq("current_stage", opts.stage);
  const { data, error } = await q;
  if (error) throw friendly(error, "Could not load revision requests.");
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((row) => {
    const r = toRevision(row);
    if (withTaskMeta) {
      const t = row["tasks"] as Row | null;
      if (t && typeof t === "object") {
        r.task_code = str(t["task_code"]);
        r.task_title = str(t["title"]);
      }
    }
    return r;
  });
}

/** Full revision history for a task (open + resolved). */
export async function listTaskRevisions(taskId: string): Promise<RevisionRow[]> {
  const { data, error } = await supabase
    .from("revision_requests")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error, "Could not load revision history.");
  return ((data ?? []) as Row[]).map(toRevision);
}

export async function listRoutingEvents(
  revisionId: string,
): Promise<RoutingEventRow[]> {
  const { data, error } = await supabase
    .from("revision_routing_events")
    .select("*")
    .eq("revision_id", revisionId)
    .order("created_at", { ascending: true });
  if (error) throw friendly(error, "Could not load routing history.");
  return ((data ?? []) as Row[]).map(toRoutingEvent);
}

/** Publishing handoffs visible to the caller (RLS-scoped). */
export async function listHandoffs(): Promise<HandoffRow[]> {
  const { data, error } = await supabase
    .from("publishing_records")
    .select("*, tasks!inner(task_code, title)")
    .order("organizer_approved_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw friendly(error, "Could not load publishing handoffs.");
  return ((data ?? []) as Row[]).map((row) => {
    const h = toHandoff(row);
    const t = row.tasks as Row | null;
    if (t && typeof t === "object") {
      h.task_code = str(t.task_code);
      h.task_title = str(t.title);
    }
    return h;
  });
}

/** Resolve display names for a set of profile ids (best effort, RLS-safe). */
export async function resolveNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  for (const row of (data ?? []) as Row[]) {
    const name = str(row.full_name);
    if (name) map.set(String(row.id), name);
  }
  return map;
}
