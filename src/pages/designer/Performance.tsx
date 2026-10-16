/**
 * Designer — My Performance.
 *
 * Personal analytics only: the designer's own stats and deterministic
 * performance score (server-computed via calculate_designer_score).
 * Never another designer's private data — the shared leaderboard shows
 * approved summaries only.
 */
import { Link } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { ArrowRight, Trophy } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Brush,
  Globe,
  BadgeCheck,
  LineChart,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useDesignerStats, useDesignerScore } from "../../features/analytics/hooks";
import { ScoreBars } from "../../features/analytics/components/ScoreBars";
import { SCORE_META } from "../../features/analytics/types";

export default function DesignerPerformance() {
  useTaskRealtime();
  const { user } = useAuth();
  const stats = useDesignerStats();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const score = useDesignerScore(user?.id ?? null, monthStart, today);
  const s = stats.data;

  const cards = [
    { title: "Active tasks", value: s?.my_active_tasks ?? 0, icon: Brush, loading: stats.isLoading },
    { title: "Completed designs", value: s?.completed_designs ?? 0, icon: Brush, loading: stats.isLoading },
    { title: "Approved designs", value: s?.approved_designs ?? 0, icon: BadgeCheck, loading: stats.isLoading },
    { title: "Published designs", value: s?.published_designs ?? 0, icon: Globe, loading: stats.isLoading },
    { title: "Revision requests", value: s?.revision_requests ?? 0, icon: AlertTriangle, loading: stats.isLoading },
    {
      title: "On-time rate",
      value: s?.on_time_rate == null ? "—" : `${Math.round(s.on_time_rate * 100)}%`,
      icon: CalendarClock,
      loading: stats.isLoading,
    },
    {
      title: "Avg revisions",
      value: s?.avg_revisions == null ? "—" : s.avg_revisions.toFixed(1),
      icon: LineChart,
      loading: stats.isLoading,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="My Performance"
        description="Your personal analytics and deterministic performance score — your data only."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.value}
            icon={c.icon}
            loading={c.loading}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Performance score · this month</CardTitle>
            <CardDescription>
              0.30 × Quality + 0.25 × On-Time + 0.20 × Output + 0.15 ×
              Reliability + 0.10 × Responsiveness
            </CardDescription>
          </CardHeader>
          <CardContent>
            {score.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : score.isError ? (
              <div className="space-y-3">
                <p className="text-sm text-(--error)">Could not load your score.</p>
                <Button variant="secondary" size="sm" onClick={() => void score.refetch()}>
                  Retry
                </Button>
              </div>
            ) : score.data?.eligible && score.data.total_score != null ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <p className="font-display text-5xl font-bold text-(--ring) tabular-nums">{score.data.total_score}</p>
                  <p className="text-sm text-(--fg-subtle)">/ 100</p>
                </div>
                <ScoreBars score={score.data} />
                <p className="text-xs text-(--fg-subtle)">
                  Based on {score.data.sample_tasks} submissions ·{" "}
                  {SCORE_META.quality.explanation}
                </p>
              </div>
            ) : (
              <p className="text-sm text-(--fg-muted)">
                Insufficient data — at least 3 submissions this month are needed
                for a score. Keep shipping.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Leaderboard</CardTitle>
            <CardDescription>
              See how you compare — approved summaries only.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl border border-(--border) bg-(--ring)/10">
              <Trophy className="size-6 text-(--ring)" aria-hidden="true" />
            </div>
            <p className="text-sm text-(--fg-muted)">
              The shared leaderboard ranks eligible designers by their weighted
              performance score. Detailed task records stay private.
            </p>
            <Button asChild className="min-h-[44px] font-display">
              <Link to="/designer/leaderboard">
                View leaderboard <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
