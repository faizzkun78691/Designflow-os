/**
 * Team Lead — Team Performance.
 *
 * Renders the shared leaderboard, automatically scoped by the server to the
 * lead's authorized designers (get_leaderboard enforces scope).
 */
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Card, CardContent } from "../../components/ui/card";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { LeaderboardView } from "../../features/analytics/components/LeaderboardView";

export default function LeadPerformance() {
  useTaskRealtime();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Team Performance"
        description="Designer leaderboard scoped to your authorized team — server-computed summaries only."
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
                Fair, transparent rankings
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-(--fg-muted)">
                Scores are deterministic and computed server-side from real
                submissions — quality 30%, on-time 25%, output 20%,
                reliability 15%, responsiveness 10%.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <LeaderboardView scope="organizer" />
    </div>
  );
}
