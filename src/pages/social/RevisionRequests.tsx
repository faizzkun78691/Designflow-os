/**
 * Social Media — my revision requests with their routing stage.
 * SMM requests always route SMM → Organizer → Team Lead → Designer.
 */
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { RevisionPanel } from "../../features/workflow/components/RevisionPanel";
import { useOpenRevisions, useSmmQueue } from "../../features/workflow/hooks";

export default function SocialRevisionRequests() {
  useTaskRealtime();
  // SMM has no SELECT on the tasks table, so skip the tasks join (it would
  // filter every row out) and resolve task codes from the ready queue.
  const query = useOpenRevisions(undefined, false);
  const smmQueue = useSmmQueue();

  const taskMeta = useMemo(() => {
    const map = new Map<string, { code: string | null; title: string | null }>();
    for (const item of smmQueue.data ?? []) {
      map.set(item.task_id, {
        code: item.task_code,
        title: item.title,
      });
    }
    return map;
  }, [smmQueue.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="My Revision Requests"
        description="Track where your change requests are in the Organizer → Team Lead → Designer chain."
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
            <p className="text-sm text-[var(--error)]">
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
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No revision requests"
          description="Requests you send from the Ready queue will be tracked here."
        />
      ) : (
        <div className="space-y-4">
          {query.data!.map((r) => {
            const meta = r.task_id ? taskMeta.get(r.task_id) : undefined;
            // The handoff is invalidated when a revision is requested, so the
            // ready queue may no longer carry this task — fall back to the id.
            const taskCode =
              r.task_code ??
              meta?.code ??
              (r.task_id ? `Task ${r.task_id.slice(0, 8)}` : null);
            const taskTitle = r.task_title ?? meta?.title ?? "Task";
            return (
              <div key={r.id} className="space-y-2">
                <p className="font-display text-sm font-bold tracking-tight text-[var(--fg)]">
                  {taskCode && (
                    <span className="mr-2 font-mono text-xs font-bold text-[var(--primary)]">
                      {taskCode}
                    </span>
                  )}
                  {taskTitle}
                </p>
                <RevisionPanel revision={r} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
