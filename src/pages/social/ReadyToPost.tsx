/**
 * Social Media — Ready to Publish queue. Only organizer-approved handoffs
 * appear here (never unfinished work). Requesting changes routes
 * SMM → Organizer → Team Lead → Designer.
 */
import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, MessageSquareWarning, Send } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { toast } from "../../components/ui/toaster";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { SmmRevisionModal } from "../../features/workflow/components/SmmRevisionModal";
import {
  useRequestSocialMediaRevision,
  useSmmQueue,
} from "../../features/workflow/hooks";
import type { SmmQueueItem } from "../../features/workflow/types";

function HandoffCard({
  item,
  onRevise,
}: {
  item: SmmQueueItem;
  onRevise: (item: SmmQueueItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.task_code && (
            <span className="font-mono text-xs font-bold text-[var(--primary)]">
              {item.task_code}
            </span>
          )}
          <Badge variant="outline">v{item.version ?? "—"}</Badge>
          {item.platform && <Badge variant="default">{item.platform}</Badge>}
          <span className="ml-auto text-xs text-[var(--fg-subtle)]">
            Approved{" "}
            {item.approved_at
              ? format(new Date(item.approved_at), "MMM d, h:mm a")
              : "—"}
          </span>
        </div>
        <h3 className="font-display mt-1 text-base font-bold tracking-tight text-[var(--fg)]">
          {item.title ?? "Untitled task"}
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {item.drive_link && (
            <Button asChild variant="secondary" size="sm">
              <a href={item.drive_link} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open design
              </a>
            </Button>
          )}
          {item.source_url && (
            <Button asChild variant="ghost" size="sm">
              <a href={item.source_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Source file
              </a>
            </Button>
          )}
        </div>

        {item.caption && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Caption
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-muted)]">
              {item.caption}
            </p>
          </div>
        )}
        {item.hashtags && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Hashtags
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--primary)]">{item.hashtags}</p>
          </div>
        )}
        {item.instructions && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Publishing instructions
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-muted)]">
              {item.instructions}
            </p>
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRevise(item)}
          >
            <MessageSquareWarning className="size-4" aria-hidden="true" />
            Request changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialReadyToPost() {
  useTaskRealtime();
  const query = useSmmQueue();
  const request = useRequestSocialMediaRevision();
  const [reviseTarget, setReviseTarget] = useState<SmmQueueItem | null>(null);

  const sendRevision = (instructions: string, priority: string) => {
    if (!reviseTarget) return;
    request.mutate(
      {
        handoffId: reviseTarget.handoff_id,
        input: { instructions, priority },
      },
      {
        onSuccess: () => {
          toast.success(
            "Revision requested — the Organizer will review it first.",
          );
          setReviseTarget(null);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Ready to Publish"
        description="Organizer-approved content, with captions and publishing instructions."
      />

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-[var(--error)]">Could not load the queue.</p>
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
          icon={Send}
          title="Nothing ready yet"
          description="Approved designs will queue up here with captions and hashtags."
        />
      ) : (
        <div className="space-y-4">
          {query.data!.map((item) => (
            <HandoffCard
              key={item.handoff_id}
              item={item}
              onRevise={setReviseTarget}
            />
          ))}
        </div>
      )}

      <SmmRevisionModal
        open={!!reviseTarget}
        onOpenChange={(v) => !v && setReviseTarget(null)}
        taskCode={reviseTarget?.task_code ?? null}
        version={reviseTarget?.version ?? null}
        submitting={request.isPending}
        onSubmit={sendRevision}
      />
    </div>
  );
}
