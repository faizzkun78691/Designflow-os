import { useMemo, useState } from "react";
import { format, isValid, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { CalendarRange, Info } from "lucide-react";
import { cn } from "../../../utils/cn";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent } from "../../../components/ui/card";
import { toast } from "../../../components/ui/toaster";
import { useLeaderboard, useDesignerLeaderboard } from "../hooks";
import { LeaderboardBoard } from "./LeaderboardBoard";
import { SCORE_META } from "../types";

export interface LeaderboardViewProps {
  /** When "designer", uses the designer-root query key; otherwise organizer. */
  scope: "organizer" | "designer";
  /** Designer id of the viewer — that row is highlighted. */
  highlightId?: string | null;
}

type Preset = "week" | "month" | "90d" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "90d", label: "Last 90 Days" },
  { key: "custom", label: "Custom" },
];

function toDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function presetRange(preset: Preset, now: Date): { start: string; end: string } {
  switch (preset) {
    case "week":
      return { start: toDateOnly(startOfWeek(now)), end: toDateOnly(now) };
    case "month":
      return { start: toDateOnly(startOfMonth(now)), end: toDateOnly(now) };
    case "90d":
      return { start: toDateOnly(subDays(now, 89)), end: toDateOnly(now) };
    case "custom":
      return { start: "", end: "" };
  }
}

/**
 * Shared leaderboard view (period filter + formula explainer + ranked board).
 * All numbers come from the get_leaderboard RPC — server-computed summaries
 * only, no private task details. Organizer and designer pages both render it.
 */
export function LeaderboardView({
  scope,
  highlightId = null,
}: LeaderboardViewProps) {
  const [preset, setPreset] = useState<Preset>("month");
  const [customStart, setCustomStart] = useState(toDateOnly(subDays(new Date(), 29)));
  const [customEnd, setCustomEnd] = useState(toDateOnly(new Date()));

  const range = useMemo(() => {
    if (preset === "custom") {
      const s = parseISO(customStart);
      const e = parseISO(customEnd);
      if (!isValid(s) || !isValid(e) || s > e) {
        return { start: "", end: "", valid: false as const };
      }
      return { start: customStart, end: customEnd, valid: true as const };
    }
    const r = presetRange(preset, new Date());
    return { ...r, valid: true as const };
  }, [preset, customStart, customEnd]);

  const organizerQuery = useLeaderboard(
    scope === "organizer" ? range.start : "",
    scope === "organizer" ? range.end : "",
  );
  const designerQuery = useDesignerLeaderboard(
    scope === "designer" ? range.start : "",
    scope === "designer" ? range.end : "",
  );
  const query = scope === "organizer" ? organizerQuery : designerQuery;

  const applyCustom = () => {
    if (!range.valid) {
      toast.error("Pick a valid date range (start on or before end).");
    }
  };

  return (
    <div className="space-y-6">
      {/* formula explanation */}
      <Card>
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 size-5 shrink-0 text-(--ring)" aria-hidden="true" />
          <div className="text-sm leading-relaxed text-(--fg-muted)">
            <p>
              Total score ={" "}
              {Object.values(SCORE_META)
                .map((m) => `${m.weight}% ${m.label}`)
                .join(" + ")}
              . All components are computed server-side from real submissions.
            </p>
            <p className="mt-1">
              Insufficient data (&lt; 3 submissions) designers are not ranked.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* period filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange
            className="size-4 text-(--fg-subtle)"
            aria-hidden="true"
          />
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant={preset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(p.key)}
              className={cn(preset !== p.key && "text-(--fg-muted)")}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${scope}-lb-start`}>Start date</Label>
              <Input
                id={`${scope}-lb-start`}
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${scope}-lb-end`}>End date</Label>
              <Input
                id={`${scope}-lb-end`}
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={applyCustom}
            >
              Apply
            </Button>
          </div>
        )}
      </div>

      <LeaderboardBoard
        entries={query.data}
        isLoading={query.isLoading}
        error={query.error instanceof Error ? query.error : null}
        highlightId={highlightId}
      />
    </div>
  );
}
