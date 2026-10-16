import { cn } from "../../../utils/cn";
import { SCORE_COMPONENT_KEYS, SCORE_META } from "../types";
import type { DesignerScore } from "../types";

export interface ScoreBarsProps {
  score: DesignerScore;
  compact?: boolean;
}

/**
 * Horizontal 0–100 component bars for one DesignerScore.
 * Uses divs only (no chart library): volt fills on matte black.
 */
export function ScoreBars({ score, compact = false }: ScoreBarsProps) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {SCORE_COMPONENT_KEYS.map((key) => {
        const meta = SCORE_META[key];
        const value = score[key];
        const clamped = Math.min(100, Math.max(0, value));
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <p
                className={cn(
                  "truncate font-medium text-(--fg-muted)",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {meta.label}
              </p>
              <p className="text-[11px] text-(--fg-subtle)">{meta.weight}% weight</p>
            </div>
            <div
              className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-(--surface-2)"
              role="img"
              aria-label={`${meta.label}: ${Math.round(clamped)} of 100`}
            >
              <div
                className="h-full rounded-full bg-(--primary) transition-[width] duration-500"
                style={{ width: `${clamped}%` }}
              />
            </div>
            <span
              className={cn(
                "w-12 shrink-0 text-right font-semibold tabular-nums text-(--fg)",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {Math.round(clamped)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
