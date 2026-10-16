/**
 * Organizer Approval Center — every submission awaiting Organizer review.
 * Approve creates the publishing handoff; Request changes routes
 * instructions through the Team Lead (Organizer → Lead → Designer).
 */
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { OpenRevisionInbox } from "../../features/workflow/components/OpenRevisionInbox";
import { ReviewCard } from "../../features/workflow/components/ReviewCard";
import { useOrganizerQueue } from "../../features/workflow/hooks";

export default function Approvals() {
  useTaskRealtime();
  const query = useOrganizerQueue();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Approval Center"
        description="Final approval before content reaches Social Media. Requested changes are routed through the Team Lead."
      />

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-(--error)">
              Could not load the approval queue.
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
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing awaiting approval"
          description="Submissions approved by Team Leads will appear here."
        />
      ) : (
        <div className="space-y-4">
          {query.data!.map((item) => (
            <ReviewCard
              key={item.submission_id}
              item={item}
              stage="organizer"
              detailBase="/organizer/tasks"
            />
          ))}
        </div>
      )}

      <OpenRevisionInbox stage="awaiting_organizer" detailBase="/organizer/tasks" />
    </div>
  );
}
