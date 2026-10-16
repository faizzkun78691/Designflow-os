/**
 * Designer Revisions — open revision requests sitting with the designer,
 * with the full instruction chain and acknowledge action.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquareWarning, ArrowUpCircle } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { RevisionPanel } from "../../features/workflow/components/RevisionPanel";
import { useOpenRevisions } from "../../features/workflow/hooks";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function DesignerRevisions() {
  useTaskRealtime();
  const query = useOpenRevisions();
  const count = (query.data ?? []).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Revisions"
        description="Change requests waiting on you — read the full instruction chain, then submit a new version."
        actions={
          !query.isLoading && !query.isError && count > 0 ? (
            <Badge variant="warning" className="min-h-[32px] px-3 py-1.5 text-sm">
              <MessageSquareWarning className="size-4" aria-hidden="true" />
              {count} pending
            </Badge>
          ) : undefined
        }
      />

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
            icon={MessageSquareWarning}
            title="No revisions pending"
            description="When a reviewer requests changes, the instructions will appear here."
          />
        </motion.div>
      ) : (
        <div className="space-y-5">
          {query.data!.map((r, i) => (
            <motion.div
              key={r.id}
              {...fadeUp}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="space-y-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-display text-sm font-semibold text-(--fg)">
                  {r.task_code && (
                    <span className="mr-2 font-mono text-xs font-medium text-(--ring)">
                      {r.task_code}
                    </span>
                  )}
                  {r.task_title ?? "Task"}
                </p>
                {r.task_id && (
                  <Button asChild variant="secondary" size="sm" className="min-h-[44px] shrink-0">
                    <Link to={`/designer/tasks/${r.task_id}`}>
                      <ArrowUpCircle className="size-4" aria-hidden="true" />
                      Open task & submit v{(r.submission_version ?? 0) + 1}
                    </Link>
                  </Button>
                )}
              </div>
              <RevisionPanel revision={r} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
