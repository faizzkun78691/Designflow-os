import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { platformLabel } from "../types";
import type { PublishingRecord } from "../types";

export interface TaskMeta {
  task_code: string | null;
  title: string | null;
}

interface PublishingCardProps {
  record: PublishingRecord;
  meta?: TaskMeta | null;
}

/**
 * Row card for the publishing queue. The card body navigates to the detail
 * page; the drive-link button stops propagation so it opens Drive instead.
 */
export function PublishingCard({ record, meta }: PublishingCardProps) {
  const navigate = useNavigate();

  const timeLabel = record.published_at
    ? `Published ${format(new Date(record.published_at), "MMM d, h:mm a")}`
    : record.scheduled_at
      ? `Scheduled ${format(new Date(record.scheduled_at), "MMM d, h:mm a")}`
      : record.organizer_approved_at
        ? `Approved ${format(new Date(record.organizer_approved_at), "MMM d, h:mm a")}`
        : null;

  return (
    <Card
      className="group cursor-pointer transition-shadow hover:shadow-[var(--shadow-pop)]"
      onClick={() => navigate(`/social/studio/${record.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/social/studio/${record.id}`);
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {meta?.task_code && (
            <span className="font-mono text-xs font-bold text-[var(--primary)]">
              {meta.task_code}
            </span>
          )}
          <StatusBadge status={record.status} />
          {record.platform && (
            <Badge variant="outline">{platformLabel(record.platform)}</Badge>
          )}
          {record.submission_version != null && (
            <Badge variant="default">v{record.submission_version}</Badge>
          )}
          {timeLabel && (
            <span className="ml-auto text-xs text-[var(--fg-subtle)]">{timeLabel}</span>
          )}
        </div>
        <h3 className="font-display mt-1 text-base font-bold tracking-tight text-[var(--fg)] group-hover:text-[var(--primary)] transition-colors">
          {meta?.title ?? "Untitled post"}
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {record.caption && (
          <p className="line-clamp-2 text-sm text-[var(--fg-muted)]">{record.caption}</p>
        )}
        <div className="flex items-center gap-2">
          {record.drive_link ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              onClick={(e) => e.stopPropagation()}
            >
              <a href={record.drive_link} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open design
              </a>
            </Button>
          ) : (
            <span className="text-xs text-[var(--fg-subtle)]">
              No design file attached
            </span>
          )}
          {record.reschedule_count > 0 && (
            <span className="ml-auto text-xs text-[var(--fg-subtle)]">
              Rescheduled {record.reschedule_count}×
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
