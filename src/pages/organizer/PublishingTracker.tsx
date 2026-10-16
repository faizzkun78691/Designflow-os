/**
 * Organizer Publishing Tracker — current publishing handoffs: which
 * approved versions are with Social Media, and which were superseded
 * by later revisions.
 */
import { format } from "date-fns";
import { ExternalLink, Megaphone } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useHandoffs } from "../../features/workflow/hooks";

const STATUS_VARIANT: Record<
  string,
  "success" | "muted" | "default" | "warning" | "volt"
> = {
  ready: "success",
  superseded: "muted",
  scheduled: "default",
  published: "volt",
  pending: "warning",
};

export default function PublishingTracker() {
  useTaskRealtime();
  const query = useHandoffs();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Publishing Tracker"
        description="Approved handoffs handed to Social Media — and versions superseded by revisions."
      />

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-(--error)">Could not load handoffs.</p>
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
          icon={Megaphone}
          title="No handoffs yet"
          description="Approved designs will appear here once they are handed to Social Media."
        />
      ) : (
        <ul className="space-y-3">
          {query.data!.map((h) => (
            <li key={h.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-(--fg)">
                      {h.task_code && (
                        <span className="font-mono text-xs font-semibold text-(--ring)">
                          {h.task_code}
                        </span>
                      )}
                      <span className="truncate">{h.task_title ?? "Task"}</span>
                    </p>
                    <p className="mt-1 text-xs text-(--fg-subtle)">
                      Version {h.submission_version ?? "—"}
                      {h.platform ? ` · ${h.platform}` : ""} ·{" "}
                      {h.organizer_approved_at
                        ? format(
                            new Date(h.organizer_approved_at),
                            "MMM d, yyyy h:mm a",
                          )
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[h.status] ?? "default"}>
                      {h.is_current ? "Current" : h.status}
                    </Badge>
                    {h.drive_link && (
                      <Button asChild variant="ghost" size="sm">
                        <a href={h.drive_link} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          Design
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
