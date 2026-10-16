/**
 * React Query hooks for Phase 4 analytics, leaderboard & command center.
 * Query keys use the roots the realtime invalidator covers
 * (organizer / lead / designer / social).
 */
import { useQuery } from "@tanstack/react-query";
import {
  calculateDesignerScore,
  detectBottlenecks,
  getDesignerStats,
  getLeaderboard,
  getLeadStats,
  getOrganizerStats,
} from "./services/analytics";

export interface DateRange {
  /** ISO timestamptz strings for get_organizer_stats. */
  start: string;
  end: string;
}

export interface DateOnlyRange {
  /** YYYY-MM-DD strings for score/leaderboard RPCs. */
  start: string;
  end: string;
}

export function useOrganizerStats(range: DateRange | null) {
  return useQuery({
    queryKey: ["organizer", "analytics", range?.start ?? "", range?.end ?? ""],
    queryFn: () => {
      if (!range) throw new Error("Date range is required.");
      return getOrganizerStats(range.start, range.end);
    },
    enabled: range !== null,
  });
}

/** Team-lead overview numbers. Parent reuses this in lead/Dashboard.tsx. */
export function useLeadStats() {
  return useQuery({
    queryKey: ["lead", "analytics", "stats"],
    queryFn: getLeadStats,
  });
}

/** Designer overview numbers. Parent reuses this in designer/Dashboard.tsx. */
export function useDesignerStats() {
  return useQuery({
    queryKey: ["designer", "analytics", "stats"],
    queryFn: getDesignerStats,
  });
}

/**
 * Deterministic score for one designer in a period (server computes it).
 * Designers may only score themselves — the server enforces that.
 * Parent reuses this for the designer's own dashboard.
 */
export function useDesignerScore(
  designerId: string | null,
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: ["designer", "analytics", "score", designerId ?? "", start, end],
    queryFn: () => {
      if (!designerId) throw new Error("Designer id is required.");
      return calculateDesignerScore(designerId, start, end);
    },
    enabled: designerId !== null && start !== "" && end !== "",
  });
}

export function useLeaderboard(start: string, end: string) {
  return useQuery({
    queryKey: ["organizer", "leaderboard", start, end],
    queryFn: () => getLeaderboard(start, end),
    enabled: start !== "" && end !== "",
  });
}

export function useDesignerLeaderboard(start: string, end: string) {
  return useQuery({
    queryKey: ["designer", "leaderboard", start, end],
    queryFn: () => getLeaderboard(start, end),
    enabled: start !== "" && end !== "",
  });
}

export function useBottlenecks() {
  return useQuery({
    queryKey: ["organizer", "analytics", "bottlenecks"],
    queryFn: detectBottlenecks,
  });
}
