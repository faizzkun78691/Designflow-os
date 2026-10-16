/**
 * Analytics, leaderboard & command-center domain types — DesignFlow OS Phase 4.
 *
 * Every number in these interfaces comes from Supabase RPCs (server computes
 * the scoring deterministically); the frontend never invents metrics.
 */

export type ScoreComponentKey =
  | "quality"
  | "on_time"
  | "output"
  | "reliability"
  | "responsiveness";

/** Deterministic score formula (computed server-side by calculate_designer_score):
 *  total = 0.30*quality + 0.25*on_time + 0.20*output + 0.15*reliability + 0.10*responsiveness
 *  A designer is `eligible` only with >= 3 submissions inside the period;
 *  ineligible designers get total_score = null and are excluded from ranking. */
export interface DesignerScore {
  designer_id: string;
  period_start: string;
  period_end: string;
  eligible: boolean;
  quality: number;
  on_time: number;
  output: number;
  reliability: number;
  responsiveness: number;
  total_score: number | null;
  sample_tasks: number;
}

/** Label, deterministic weight, and one-line explanation per score component. */
export const SCORE_META: Record<
  ScoreComponentKey,
  { label: string; weight: number; explanation: string }
> = {
  quality: {
    label: "Quality",
    weight: 30,
    explanation: "First-pass approval rate minus a penalty for each revision round.",
  },
  on_time: {
    label: "On Time",
    weight: 25,
    explanation: "Share of submissions delivered by the task due date.",
  },
  output: {
    label: "Output",
    weight: 20,
    explanation: "Complexity-weighted approved output, normalized to 10 units.",
  },
  reliability: {
    label: "Reliability",
    weight: 15,
    explanation: "Accepted submissions that made it all the way to publish.",
  },
  responsiveness: {
    label: "Responsiveness",
    weight: 10,
    explanation: "Share of revision requests acknowledged within 24 hours.",
  },
};

export const SCORE_COMPONENT_KEYS: readonly ScoreComponentKey[] = [
  "quality",
  "on_time",
  "output",
  "reliability",
  "responsiveness",
];

export interface OrganizerStats {
  total_tasks: number;
  available: number;
  claimed: number;
  assigned: number;
  in_progress: number;
  awaiting_lead_review: number;
  awaiting_organizer_review: number;
  revision_required: number;
  ready_to_publish: number;
  scheduled: number;
  published: number;
  overdue: number;
  cancelled: number;
  pending_approvals: number;
  publishing_overdue: number;
  tasks_created_range: number;
  published_range: number;
}

export interface LeadStats {
  my_created_tasks: number;
  organizer_assignments: number;
  active_designs: number;
  awaiting_my_review: number;
  organizer_review_pending: number;
  revision_required: number;
  approved_designs: number;
  published_designs: number;
  overdue_tasks: number;
}

export interface DesignerStats {
  my_active_tasks: number;
  completed_designs: number;
  approved_designs: number;
  published_designs: number;
  revision_requests: number;
  on_time_rate: number | null;
  avg_revisions: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  designer_id: string;
  designer_name: string;
  score: DesignerScore;
}

export interface BottleneckItem {
  task_id: string;
  task_code: string | null;
  status: string | null;
  days_waiting: number | null;
  due_date: string | null;
  platform: string | null;
  revision_count: number | null;
}

export interface Bottlenecks {
  stale_reviews: BottleneckItem[];
  overdue_submissions: BottleneckItem[];
  revision_loops: BottleneckItem[];
  unpublished_approved: BottleneckItem[];
  unclaimed_urgent: BottleneckItem[];
}
