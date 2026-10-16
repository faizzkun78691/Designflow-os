/**
 * Workflow progress tracker — who owns the task now, what stage it is in,
 * and who must act next. Derived from the production status.
 * Stages: Design → Team Lead review → Organizer review → Publishing.
 */
import { Check, Circle, CircleDot } from "lucide-react";
import { cn } from "../../../utils/cn";
import type { ProductionStatus } from "../../../types/tasks";
import { workflowStagesFor } from "../types";

const NEXT_ACTOR: Record<string, string> = {
  submitted_lead_review: "Team Lead",
  submitted_organizer_review: "Organizer",
  ready_for_publishing: "Social Media Manager",
  revision_awaiting_organizer: "Organizer",
  revision_awaiting_lead: "Team Lead",
  revision_required_designer: "Designer",
};

export function WorkflowProgress({ status }: { status: ProductionStatus }) {
  const stages = workflowStagesFor(status);
  const nextActor = NEXT_ACTOR[status] ?? null;

  return (
    <div className="rounded-2xl border border-token bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xs font-bold uppercase tracking-wider text-subtle">
          Workflow
        </p>
        {nextActor && (
          <p className="text-xs text-muted">
            Next: <span className="font-semibold text-volt">{nextActor}</span>
          </p>
        )}
      </div>
      <ol className="mt-3 space-y-2.5">
        {stages.map((s, i) => (
          <li key={s.key} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-token bg-surface-2 font-display text-[10px] font-bold text-muted">
              {i + 1}
            </span>
            {s.state === "done" ? (
              <Check className="mt-0.5 size-4 shrink-0 text-volt" aria-hidden="true" />
            ) : s.state === "current" ? (
              <CircleDot
                className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                aria-hidden="true"
              />
            ) : s.state === "blocked" ? (
              <CircleDot
                className="mt-0.5 size-4 shrink-0 text-[var(--error)]"
                aria-hidden="true"
              />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
            )}
            <span
              className={cn(
                "text-sm",
                s.state === "done" && "text-subtle line-through",
                s.state === "current" && "font-semibold text-fg",
                s.state === "blocked" && "font-semibold text-[var(--error)]",
                s.state === "upcoming" && "text-subtle",
              )}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
