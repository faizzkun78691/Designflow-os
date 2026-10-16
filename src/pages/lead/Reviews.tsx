/**
 * Team Lead Review Center — submissions awaiting this lead's decision.
 * Approve moves the submission to Organizer review; Request changes
 * routes instructions back to the designer.
 */
import { motion } from "framer-motion";
import { ClipboardCheck, Inbox } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { OpenRevisionInbox } from "../../features/workflow/components/OpenRevisionInbox";
import { ReviewCard } from "../../features/workflow/components/ReviewCard";
import { useLeadQueue } from "../../features/workflow/hooks";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function LeadReviews() {
  useTaskRealtime();
  const query = useLeadQueue();
  const count = (query.data ?? []).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Review Center"
        description="Submissions from your designers awaiting your decision."
        actions={
          !query.isLoading && !query.isError ? (
            <Badge variant={count > 0 ? "warning" : "success"} className="min-h-[32px] px-3 py-1.5 text-sm">
              {count === 0 ? (
                <>
                  <Inbox className="size-4" aria-hidden="true" />
                  Queue clear
                </>
              ) : (
                <>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  {count} awaiting review
                </>
              )}
            </Badge>
          ) : undefined
        }
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
              Could not load the review queue.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 min-h-[44px]"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : count === 0 ? (
        <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
          <EmptyState
            icon={ClipboardCheck}
            title="Queue is clear"
            description="No submissions are waiting for your review right now. New designer submissions will appear here."
          />
        </motion.div>
      ) : (
        <div className="space-y-4">
          {query.data!.map((item, i) => (
            <motion.div
              key={item.submission_id}
              {...fadeUp}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <ReviewCard
                item={item}
                stage="team_lead"
                detailBase="/lead/tasks"
              />
            </motion.div>
          ))}
        </div>
      )}

      <OpenRevisionInbox stage="awaiting_lead" detailBase="/lead/tasks" />
    </div>
  );
}
