import { Award, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../utils/cn";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { ScoreBars } from "./ScoreBars";
import type { LeaderboardEntry, ScoreComponentKey } from "../types";

export interface LeaderboardBoardProps {
  entries: LeaderboardEntry[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Designer id of the viewer — that row is highlighted. */
  highlightId?: string | null;
}

interface BadgeDef {
  key: ScoreComponentKey;
  label: string;
  icon: LucideIcon;
}

/** Badges derived from real metrics, awarded only among eligible designers. */
const BADGE_DEFS: BadgeDef[] = [
  { key: "quality", label: "Quality Champion", icon: Trophy },
  { key: "on_time", label: "Deadline Master", icon: Award },
  { key: "output", label: "Powerhouse", icon: Award },
  { key: "reliability", label: "Most Reliable", icon: Award },
];

/**
 * Awards one badge per metric among eligible entries.
 * Ties on the metric break by higher total_score.
 */
function awardBadges(
  entries: LeaderboardEntry[],
): Map<string, BadgeDef[]> {
  const awarded = new Map<string, BadgeDef[]>();
  const eligible = entries.filter(
    (e) => e.score.eligible && e.score.total_score !== null,
  );
  for (const def of BADGE_DEFS) {
    let winner: LeaderboardEntry | null = null;
    for (const e of eligible) {
      const metric = e.score[def.key];
      const total = e.score.total_score ?? -Infinity;
      if (
        winner === null ||
        metric > winner.score[def.key] ||
        (metric === winner.score[def.key] &&
          total > (winner.score.total_score ?? -Infinity))
      ) {
        winner = e;
      }
    }
    if (winner) {
      const list = awarded.get(winner.designer_id) ?? [];
      list.push(def);
      awarded.set(winner.designer_id, list);
    }
  }
  return awarded;
}

export function LeaderboardBoard({
  entries,
  isLoading,
  error,
  highlightId = null,
}: LeaderboardBoardProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Trophy}
        title="Leaderboard unavailable"
        description="We could not load the rankings right now. Please try again shortly."
      />
    );
  }

  const eligible = (entries ?? []).filter(
    (e) => e.score.eligible && e.score.total_score !== null,
  );

  if (eligible.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No designers ranked yet"
        description="Insufficient data: designers need at least 3 submissions in the selected period to be ranked."
      />
    );
  }

  const badges = awardBadges(eligible);

  return (
    <div className="space-y-4">
      {eligible.map((entry) => {
        const isYou = highlightId !== null && entry.designer_id === highlightId;
        const entryBadges = badges.get(entry.designer_id) ?? [];
        const total = entry.score.total_score ?? 0;
        return (
          <Card
            key={entry.designer_id}
            className={cn(
              "overflow-hidden",
              isYou && "border-(--ring)/40 shadow-[0_0_24px_-8px] shadow-(--ring)/30",
            )}
          >
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                {/* rank + identity + score */}
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl border font-display font-bold tabular-nums",
                      entry.rank === 1
                        ? "border-(--ring)/50 bg-[color-mix(in_srgb,var(--ring)_15%,transparent)] text-(--ring)"
                        : "border-(--border) bg-(--surface-2) text-(--fg-muted)",
                    )}
                    aria-label={`Rank ${entry.rank}`}
                  >
                    {entry.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-base font-semibold text-(--fg)">
                        {entry.designer_name}
                      </p>
                      {isYou && (
                        <Badge className="bg-(--primary) text-(--primary-fg) hover:bg-(--primary-hover)">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {entryBadges.map((b) => {
                        const Icon = b.icon;
                        return (
                          <Badge key={b.label} variant="volt">
                            <Icon
                              className="mr-1 size-3"
                              aria-hidden="true"
                            />
                            {b.label}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-(--fg-subtle)">
                      {entry.score.sample_tasks} submitted designs in period ·
                      on-time {Math.round(entry.score.on_time)}%
                    </p>
                  </div>
                </div>
                {/* total score */}
                <div className="shrink-0 lg:w-40">
                  <p className="font-display text-xs font-medium uppercase tracking-wider text-(--fg-subtle)">
                    Total score
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold tabular-nums text-(--fg)">
                    {total.toFixed(1)}
                    <span className="font-sans text-base font-medium text-(--fg-subtle)">
                      /100
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-(--border) pt-4">
                <ScoreBars score={entry.score} compact />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
