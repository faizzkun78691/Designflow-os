/**
 * Publishing Studio data access — DesignFlow OS Phase 4.
 *
 * All mutations go through the backend RPCs (SECURITY DEFINER). Reads use
 * RLS-scoped direct selects. NEVER direct INSERT/UPDATE/DELETE on the
 * publishing tables — always via RPC.
 *
 * NOTE (RLS caveat): the Social Media Manager role can only SELECT
 * publishing_records rows with status='ready' AND is_current=true. All other
 * status tabs correctly return [] for SMM until the backend policy is
 * widened — this is expected behaviour, not a bug.
 */
import { supabase } from "../../../integrations/supabase/client";
import type {
  MarkPublishedInput,
  PublishingEvent,
  PublishingMetrics,
  PublishingRecord,
  PublishingStatus,
  PublishingTab,
  RefLink,
  RequestPublishingChangesInput,
  RevisionPriority,
  UpcomingItem,
} from "../types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function friendly(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message) {
    const m = error.message.toLowerCase();
    if (
      m.includes("permission") ||
      m.includes("not allowed") ||
      m.includes("not permitted") ||
      m.includes("policy")
    )
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

const VALID_STATUSES: PublishingStatus[] = [
  "ready",
  "pending",
  "scheduled",
  "changes_requested",
  "published",
  "cancelled",
  "superseded",
];

function toPublishingStatus(v: unknown): PublishingStatus {
  const s = String(v ?? "");
  return (VALID_STATUSES as string[]).includes(s)
    ? (s as PublishingStatus)
    : "ready";
}

const VALID_PRIORITIES: RevisionPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

function toPublishingRecord(row: Row): PublishingRecord {
  return {
    id: String(row.id),
    task_id: String(row.task_id ?? ""),
    platform: str(row.platform),
    caption: str(row.caption),
    hashtags: str(row.hashtags),
    drive_link: str(row.drive_link),
    scheduled_at: str(row.scheduled_at),
    published_url: str(row.published_url),
    status: toPublishingStatus(row.status),
    managed_by: str(row.managed_by),
    submission_id: str(row.submission_id),
    submission_version: num(row.submission_version),
    source_url: str(row.source_url),
    instructions: str(row.instructions),
    preferred_date: str(row.preferred_date),
    preferred_time: str(row.preferred_time),
    organizer_approved_at: str(row.organizer_approved_at),
    is_current: bool(row.is_current),
    published_at: str(row.published_at),
    published_by: str(row.published_by),
    scheduled_by: str(row.scheduled_by),
    platform_post_id: str(row.platform_post_id),
    publishing_notes: str(row.publishing_notes),
    extra_urls: asRefLinks(row.extra_urls),
    reschedule_count: num(row.reschedule_count) ?? 0,
    status_changed_at: str(row.status_changed_at),
    status_changed_by: str(row.status_changed_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function toPublishingEvent(row: Row): PublishingEvent {
  return {
    id: String(row.id),
    record_id: String(row.record_id ?? ""),
    task_id: str(row.task_id),
    actor_id: str(row.actor_id),
    from_status: str(row.from_status),
    to_status: str(row.to_status),
    note: str(row.note),
    created_at: str(row.created_at),
  };
}

function toMetrics(row: Row): PublishingMetrics {
  const upcoming: UpcomingItem[] = Array.isArray(row.upcoming)
    ? (row.upcoming as Row[]).map((u) => ({
        id: String(u.id),
        task_id: str(u.task_id),
        platform: str(u.platform),
        scheduled_at: String(u.scheduled_at ?? ""),
      }))
    : [];
  const n = (v: unknown): number => num(v) ?? 0;
  return {
    ready: n(row.ready),
    scheduled: n(row.scheduled),
    pending: n(row.pending),
    overdue: n(row.overdue),
    changes_requested: n(row.changes_requested),
    published_today: n(row.published_today),
    published_week: n(row.published_week),
    published_month: n(row.published_month),
    total_published: n(row.total_published),
    upcoming,
  };
}

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

export async function listPublishingRecords(
  status: PublishingTab = "all",
): Promise<PublishingRecord[]> {
  let query = supabase.from("publishing_records").select("*");
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query
    .eq("is_current", true)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error, "Could not load the publishing queue.");
  return ((data ?? []) as Row[]).map(toPublishingRecord);
}

export async function getPublishingRecord(
  id: string,
): Promise<PublishingRecord | null> {
  const { data, error } = await supabase
    .from("publishing_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendly(error, "Could not load the publishing record.");
  if (!data) return null;
  return toPublishingRecord(data as Row);
}

export async function listPublishingEvents(
  recordId: string,
): Promise<PublishingEvent[]> {
  const { data, error } = await supabase
    .from("publishing_events")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });
  if (error) throw friendly(error, "Could not load the activity timeline.");
  return ((data ?? []) as Row[]).map(toPublishingEvent);
}

export async function getPublishingMetrics(): Promise<PublishingMetrics> {
  const { data, error } = await supabase.rpc("get_publishing_metrics");
  if (error) throw friendly(error, "Could not load publishing metrics.");
  return toMetrics((data ?? {}) as Row);
}

/* ------------------------------------------------------------------ */
/* mutations (all via RPC)                                             */
/* ------------------------------------------------------------------ */

export async function transitionPublishingStatus(
  recordId: string,
  newStatus: PublishingStatus,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("transition_publishing_status", {
    p_record_id: recordId,
    p_new_status: newStatus,
    p_note: note ?? null,
  });
  if (error) throw friendly(error, "Could not update the record status.");
}

export async function schedulePublishing(
  recordId: string,
  scheduledAt: string,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("schedule_publishing", {
    p_record_id: recordId,
    p_scheduled_at: scheduledAt,
    p_note: note ?? null,
  });
  if (error) throw friendly(error, "Could not schedule the post.");
}

export async function markPublished(
  recordId: string,
  input: MarkPublishedInput,
): Promise<void> {
  const { error } = await supabase.rpc("mark_published", {
    p_record_id: recordId,
    p_published_url: input.publishedUrl ?? null,
    p_platform_post_id: input.platformPostId ?? null,
    p_publishing_notes: input.publishingNotes ?? null,
    p_extra_urls: (input.extraUrls ?? []).map((l) => ({
      url: l.url,
      label: l.label,
    })),
  });
  if (error) throw friendly(error, "Could not mark the post as published.");
}

export async function requestPublishingChanges(
  recordId: string,
  input: RequestPublishingChangesInput,
): Promise<string> {
  const priority: RevisionPriority = VALID_PRIORITIES.includes(
    input.priority as RevisionPriority,
  )
    ? (input.priority as RevisionPriority)
    : "normal";
  const { data, error } = await supabase.rpc("request_publishing_changes", {
    p_record_id: recordId,
    p_instructions: input.instructions,
    p_priority: priority,
    p_deadline: input.deadline ?? null,
    p_reference_urls: (input.referenceUrls ?? []).map((l) => ({
      url: l.url,
      label: l.label,
    })),
  });
  if (error) throw friendly(error, "Could not request changes.");
  return String(data);
}
