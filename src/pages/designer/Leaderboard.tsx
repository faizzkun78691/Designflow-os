import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Card, CardContent } from "../../components/ui/card";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useAuth } from "../../contexts/AuthContext";
import { LeaderboardView } from "../../features/analytics/components/LeaderboardView";

/**
 * Designer leaderboard page: same rankings, designer-visible.
 * Summaries only (rank, name, score, component bars, badges) — the RPC
 * returns no private task details. The current designer's row is highlighted.
 * Scoring formulas are untouched (Phase 4 weights preserved).
 */
export default function Leaderboard() {
  useTaskRealtime();
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Leaderboard"
        description="How designers rank for the selected period — including you."
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className="overflow-hidden">
          <CardContent className="flex items-center gap-4 bg-gradient-to-r from-electric/15 via-neon/10 to-transparent p-5">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--surface-2) text-(--ring)"
              aria-hidden="true"
            >
              <Trophy className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-(--fg)">
                Climb the ranks
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-(--fg-muted)">
                Quality 30% · On-time 25% · Output 20% · Reliability 15% ·
                Responsiveness 10%. Your row is highlighted.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <LeaderboardView scope="designer" highlightId={user?.id ?? null} />
    </div>
  );
}
