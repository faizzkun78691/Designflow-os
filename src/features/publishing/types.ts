/**
 * DesignFlow OS Phase 4 — Publishing Studio types.
 *
 * All mutations go through the backend RPCs (SECURITY DEFINER). Reads use
 * RLS-scoped direct selects. NEVER direct INSERT/UPDATE/DELETE on the
 * publishing tables — always via RPC.
 */

export type PublishingStatus =
  | "ready"
  | "pending"
  | "scheduled"
  | "changes_requested"
  | "published"
  | "cancelled"
  | "superseded";

export type PublishingTab = PublishingStatus | "all";

export interface RefLink {
  label: string;
  url: string;
}

export interface PublishingRecord {
  id: string;
  task_id: string;
  platform: string | null;
  caption: string | null;
  hashtags: string | null;
  drive_link: string | null;
  scheduled_at: string | null;
  published_url: string | null;
  status: PublishingStatus;
  managed_by: string | null;
  submission_id: string | null;
  submission_version: number | null;
  source_url: string | null;
  instructions: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  organizer_approved_at: string | null;
  is_current: boolean;
  published_at: string | null;
  published_by: string | null;
  scheduled_by: string | null;
  platform_post_id: string | null;
  publishing_notes: string | null;
  extra_urls: RefLink[];
  reschedule_count: number;
  status_changed_at: string | null;
  status_changed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PublishingEvent {
  id: string;
  record_id: string;
  task_id: string | null;
  actor_id: string | null;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string | null;
}

export interface UpcomingItem {
  id: string;
  task_id: string | null;
  platform: string | null;
  scheduled_at: string;
}

export interface PublishingMetrics {
  ready: number;
  scheduled: number;
  pending: number;
  overdue: number;
  changes_requested: number;
  published_today: number;
  published_week: number;
  published_month: number;
  total_published: number;
  upcoming: UpcomingItem[];
}

export interface StatusMeta {
  label: string;
  variant: "volt" | "success" | "warning" | "danger" | "muted" | "default" | "outline";
  hint: string;
}

export const STATUS_META: Record<PublishingStatus, StatusMeta> = {
  ready: {
    label: "Ready",
    variant: "volt",
    hint: "Approved and waiting to be scheduled or published.",
  },
  pending: {
    label: "Pending",
    variant: "warning",
    hint: "Held before scheduling.",
  },
  scheduled: {
    label: "Scheduled",
    variant: "default",
    hint: "Queued for a future publish time.",
  },
  changes_requested: {
    label: "Changes requested",
    variant: "danger",
    hint: "Sent back for a revised version.",
  },
  published: {
    label: "Published",
    variant: "success",
    hint: "Live on the platform.",
  },
  cancelled: {
    label: "Cancelled",
    variant: "muted",
    hint: "Terminal — will not be published.",
  },
  superseded: {
    label: "Superseded",
    variant: "muted",
    hint: "Terminal — replaced by a newer version.",
  },
};

/** Allowed forward transitions per the DB contract. Terminal statuses have none. */
export const ALLOWED_TRANSITIONS: Record<PublishingStatus, PublishingStatus[]> = {
  ready: ["pending", "scheduled", "published", "changes_requested", "cancelled"],
  pending: ["scheduled", "published", "changes_requested", "cancelled"],
  scheduled: ["pending", "published", "changes_requested", "cancelled"],
  changes_requested: ["ready", "cancelled"],
  published: [],
  cancelled: [],
  superseded: [],
};

export interface PlatformInfo {
  id: string;
  label: string;
}

export const PLATFORMS: PlatformInfo[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
  { id: "other", label: "Other" },
];

export function platformLabel(id: string | null): string {
  if (!id) return "Unset";
  const found = PLATFORMS.find((p) => p.id === id);
  return found ? found.label : id;
}

export type RevisionPriority = "low" | "normal" | "high" | "urgent";

export interface RequestPublishingChangesInput {
  instructions: string;
  priority?: RevisionPriority;
  deadline?: string | null;
  referenceUrls?: RefLink[] | null;
}

export interface MarkPublishedInput {
  publishedUrl?: string | null;
  platformPostId?: string | null;
  publishingNotes?: string | null;
  extraUrls?: RefLink[] | null;
}
