import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { LeaderboardView } from "../../features/analytics/components/LeaderboardView";

/**
 * Organizer leaderboard page. All numbers come from the get_leaderboard RPC
 * (server-computed, deterministic).
 */
export default function Leaderboard() {
  useTaskRealtime();

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        aria-label="Leaderboard intro"
        className="relative overflow-hidden rounded-2xl border border-(--border) bg-gradient-to-br from-midnight via-aubergine to-royal"
      >
        <WaveBackground variant="corner" opacity={0.6} />
        <div className="relative flex items-center gap-4 p-6 sm:p-8">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-token-strong bg-surface-2"
            aria-hidden="true"
          >
            <Trophy className="size-6 text-lavender" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              Designer Leaderboard
            </h2>
            <p className="mt-1 text-sm text-lavender/90">
              Transparent, server-computed performance rankings — quality 30%,
              on-time 25%, output 20%, reliability 15%, responsiveness 10%.
            </p>
          </div>
        </div>
      </motion.section>

      <PageHeader
        title="Rankings"
        description="Designer performance for the selected period."
      />
      <LeaderboardView scope="organizer" />
    </div>
  );
}
