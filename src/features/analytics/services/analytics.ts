/**
 * Analytics RPC data access — DesignFlow OS Phase 4.
 *
 * All metrics come from SECURITY DEFINER RPCs; the server enforces role
 * scoping (organizer/lead/designer). The frontend never fabricates numbers.
 * Row mapping uses the shared Record<string, unknown> + helper pattern —
 * never `as` casts to domain types.
 */
import { supabase } from "../../../integrations/supabase/client";
import type {
  BottleneckItem,
  Bottlenecks,
  DesignerScore,
  DesignerStats,
  LeaderboardEntry,
  LeadStats,
  OrganizerStats,
} from "../types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    const m = error.message.toLowerCase();
    if (m.includes("permission") || m.includes("not allowed") || m.includes("not permitted"))
      return new Error("You don't have permission for this data.");
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

/** Count fields come back as jsonb numbers; coerce defensively to integers. */
const count = (v: unknown): number => Math.max(0, Math.round(num(v) ?? 0));

/** Clamp a 0–100 score component defensively. */
const pct = (v: unknown): number => Math.min(100, Math.max(0, num(v) ?? 0));

function toDesignerScore(v: unknown): DesignerScore {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  return {
    designer_id: str(row.designer_id) ?? "",
    period_start: str(row.period_start) ?? "",
    period_end: str(row.period_end) ?? "",
    eligible: bool(row.eligible),
    quality: pct(row.quality),
    on_time: pct(row.on_time),
    output: pct(row.output),
    reliability: pct(row.reliability),
    responsiveness: pct(row.responsiveness),
    total_score: num(row.total_score),
    sample_tasks: count(row.sample_tasks),
  };
}

function toOrganizerStats(v: unknown): OrganizerStats {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  return {
    total_tasks: count(row.total_tasks),
    available: count(row.available),
    claimed: count(row.claimed),
    assigned: count(row.assigned),
    in_progress: count(row.in_progress),
    awaiting_lead_review: count(row.awaiting_lead_review),
    awaiting_organizer_review: count(row.awaiting_organizer_review),
    revision_required: count(row.revision_required),
    ready_to_publish: count(row.ready_to_publish),
    scheduled: count(row.scheduled),
    published: count(row.published),
    overdue: count(row.overdue),
    cancelled: count(row.cancelled),
    pending_approvals: count(row.pending_approvals),
    publishing_overdue: count(row.publishing_overdue),
    tasks_created_range: count(row.tasks_created_range),
    published_range: count(row.published_range),
  };
}

function toLeadStats(v: unknown): LeadStats {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  return {
    my_created_tasks: count(row.my_created_tasks),
    organizer_assignments: count(row.organizer_assignments),
    active_designs: count(row.active_designs),
    awaiting_my_review: count(row.awaiting_my_review),
    organizer_review_pending: count(row.organizer_review_pending),
    revision_required: count(row.revision_required),
    approved_designs: count(row.approved_designs),
    published_designs: count(row.published_designs),
    overdue_tasks: count(row.overdue_tasks),
  };
}

function toDesignerStats(v: unknown): DesignerStats {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  return {
    my_active_tasks: count(row.my_active_tasks),
    completed_designs: count(row.completed_designs),
    approved_designs: count(row.approved_designs),
    published_designs: count(row.published_designs),
    revision_requests: count(row.revision_requests),
    on_time_rate: num(row.on_time_rate),
    avg_revisions: num(row.avg_revisions),
  };
}

/** Optional numeric fields: null when missing or non-finite. */
const optNum = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

function toBottleneckItem(v: unknown): BottleneckItem {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  return {
    task_id: str(row.task_id) ?? "",
    task_code: str(row.task_code),
    status: str(row.status),
    days_waiting: optNum(row.days_waiting),
    due_date: str(row.due_date),
    platform: str(row.platform),
    revision_count: optNum(row.revision_count),
  };
}

function toBottlenecks(v: unknown): Bottlenecks {
  const row = (typeof v === "object" && v !== null ? v : {}) as Row;
  const list = (key: string): BottleneckItem[] => {
    const arr = row[key];
    return Array.isArray(arr) ? arr.map(toBottleneckItem) : [];
  };
  return {
    stale_reviews: list("stale_reviews"),
    overdue_submissions: list("overdue_submissions"),
    revision_loops: list("revision_loops"),
    unpublished_approved: list("unpublished_approved"),
    unclaimed_urgent: list("unclaimed_urgent"),
  };
}

/* ------------------------------------------------------------------ */
/* RPC wrappers                                                        */
/* ------------------------------------------------------------------ */

export async function getOrganizerStats(
  startISO: string,
  endISO: string,
): Promise<OrganizerStats> {
  const { data, error } = await supabase.rpc("get_organizer_stats", {
    p_start: startISO,
    p_end: endISO,
  });
  if (error) throw friendly(error, "Could not load command-center statistics.");
  return toOrganizerStats(data);
}

export async function getLeadStats(): Promise<LeadStats> {
  const { data, error } = await supabase.rpc("get_lead_stats");
  if (error) throw friendly(error, "Could not load team-lead statistics.");
  return toLeadStats(data);
}

export async function getDesignerStats(): Promise<DesignerStats> {
  const { data, error } = await supabase.rpc("get_designer_stats");
  if (error) throw friendly(error, "Could not load designer statistics.");
  return toDesignerStats(data);
}

export async function calculateDesignerScore(
  designerId: string,
  startDate: string,
  endDate: string,
): Promise<DesignerScore> {
  const { data, error } = await supabase.rpc("calculate_designer_score", {
    p_designer_id: designerId,
    p_start: startDate,
    p_end: endDate,
  });
  if (error) throw friendly(error, "Could not calculate the designer score.");
  return toDesignerScore(data);
}

export async function getLeaderboard(
  startDate: string,
  endDate: string,
  limit?: number,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_start: startDate,
    p_end: endDate,
    p_limit: limit ?? null,
  });
  if (error) throw friendly(error, "Could not load the leaderboard.");
  if (!Array.isArray(data)) return [];
  const entries: LeaderboardEntry[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Row;
    const designer_id = str(row.designer_id);
    if (!designer_id) continue;
    entries.push({
      rank: count(row.rank),
      designer_id,
      designer_name: str(row.designer_name) ?? "Unknown designer",
      score: toDesignerScore(row.score),
    });
  }
  return entries.sort((a, b) => a.rank - b.rank);
}

export async function detectBottlenecks(): Promise<Bottlenecks> {
  const { data, error } = await supabase.rpc("detect_bottlenecks");
  if (error) throw friendly(error, "Could not detect bottlenecks.");
  return toBottlenecks(data);
}
