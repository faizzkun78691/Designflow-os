/**
 * Open revision inbox — revisions sitting at one routing stage, rendered
 * with the full RevisionPanel (acknowledge / forward actions included).
 * Used by the Team Lead Review Center (awaiting_lead) and the Organizer
 * Approval Center (awaiting_organizer).
 */
import { Link } from "react-router-dom";
import { MessageSquareWarning } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { useOpenRevisionsByStage } from "../hooks";
import type { RevisionStage } from "../types";
import { RevisionPanel } from "./RevisionPanel";

const STAGE_COPY: Record<RevisionStage, { title: string; description: string }> = {
  awaiting_organizer: {
    title: "Open revisions — awaiting you",
    description:
      "Change requests routed to the Organizer. Acknowledge them and forward to the Team Lead with optional clarification.",
  },
  awaiting_lead: {
    title: "Open revisions — awaiting you",
    description:
      "Change requests routed to the Team Lead. Acknowledge them and forward to the designer with optional clarification.",
  },
  with_designer: {
    title: "Open revisions",
    description: "Change requests currently with designers.",
  },
  resolved: {
    title: "Resolved revisions",
    description: "Revisions resolved by a new submission.",
  },
};

export function OpenRevisionInbox({
  stage,
  detailBase,
}: {
  stage: RevisionStage;
  detailBase: string;
}) {
  const query = useOpenRevisionsByStage(stage);
  const copy = STAGE_COPY[stage];
  const revisions = query.data ?? [];

  return (
    <section aria-label={copy.title} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-(--fg)">{copy.title}</h2>
        <p className="mt-0.5 text-sm text-(--fg-subtle)">{copy.description}</p>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-(--error)">
              Could not load revision requests.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : revisions.length === 0 ? (
        <EmptyState
          icon={MessageSquareWarning}
          title="No revisions waiting"
          description="New change requests routed to you will appear here."
        />
      ) : (
        <div className="space-y-4">
          {revisions.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-(--fg)">
                  {r.task_code && (
                    <span className="mr-2 font-mono text-xs text-(--ring)">
                      {r.task_code}
                    </span>
                  )}
                  {r.task_title ?? "Task"}
                </p>
                {r.task_id && (
                  <Button asChild variant="secondary" size="sm">
                    <Link to={`${detailBase}/${r.task_id}`}>Open task</Link>
                  </Button>
                )}
              </div>
              <RevisionPanel revision={r} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
