/**
 * Publishing Studio — record detail. Three sections: approved design,
 * caption studio (read-only copy helpers), publishing controls, plus an
 * activity timeline.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileWarning,
  Hourglass,
  MessageSquareWarning,
  Send,
  XCircle,
} from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { toast } from "../../components/ui/toaster";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import {
  usePublishingEvents,
  usePublishingRecord,
  useTransitionPublishing,
} from "../../features/publishing/hooks";
import { useNames } from "../../features/workflow/hooks";
import { StatusBadge } from "../../features/publishing/components/StatusBadge";
import { ScheduleModal } from "../../features/publishing/components/ScheduleModal";
import { PublishConfirmModal } from "../../features/publishing/components/PublishConfirmModal";
import { ChangesRequestModal } from "../../features/publishing/components/ChangesRequestModal";
import { platformLabel } from "../../features/publishing/types";
import type { PublishingRecord } from "../../features/publishing/types";

type ModalKind =
  | "schedule"
  | "publish"
  | "changes"
  | "pending"
  | "cancel"
  | null;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · h:mm a");
}

function useCopy() {
  return async (label: string, text: string) => {
    if (!text.trim()) {
      toast.error(`Nothing to copy — ${label} is empty.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard.`);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  };
}

function ApprovedDesignCard({
  record,
  managedByName,
  onRequestChanges,
}: {
  record: PublishingRecord;
  managedByName: string | null;
  onRequestChanges: () => void;
}) {
  if (!record.drive_link) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approved design</CardTitle>
          <CardDescription>Design file for this record.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] px-6 py-10 text-center">
            <FileWarning
              className="size-8 text-[var(--fg-subtle)]"
              aria-hidden="true"
            />
            <p className="font-display text-sm font-bold text-[var(--fg)]">
              Design file unavailable
            </p>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              No design file is attached to this record yet.
            </p>
            <Button variant="secondary" size="sm" onClick={onRequestChanges}>
              <MessageSquareWarning className="size-4" aria-hidden="true" />
              Request changes
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approved design</CardTitle>
        <CardDescription>Design file for this record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={record.drive_link} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden="true" />
              Open in Drive
            </a>
          </Button>
          {record.source_url && (
            <Button asChild variant="secondary">
              <a href={record.source_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden="true" />
                Source file
              </a>
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Platform
            </dt>
            <dd className="mt-1">
              <Badge variant="outline">{platformLabel(record.platform)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Version
            </dt>
            <dd className="mt-1 font-medium text-[var(--fg)]">
              v{record.submission_version ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Managed by
            </dt>
            <dd className="mt-1 font-medium text-[var(--fg)]">{managedByName ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Approved
            </dt>
            <dd className="mt-1 font-medium text-[var(--fg)]">
              {fmtDateTime(record.organizer_approved_at)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function CaptionStudioCard({
  record,
  copy,
}: {
  record: PublishingRecord;
  copy: (label: string, text: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const caption = record.caption ?? "";
  const hashtags = record.hashtags ?? "";
  const long = caption.length > 280;
  const shown = expanded || !long ? caption : `${caption.slice(0, 280)}…`;

  const fullPost = [caption, "", hashtags, record.published_url ?? ""]
    .filter((s) => s.trim().length > 0)
    .join("\n");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caption studio</CardTitle>
        <CardDescription>
          Approved content is read-only. Use Request Changes for edits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {caption ? (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Caption
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-muted)]">
              {shown}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="size-3" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Show more{" "}
                    <ChevronDown className="size-3" aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-subtle)]">No caption provided.</p>
        )}
        {hashtags && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Hashtags
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--primary)]">{hashtags}</p>
          </div>
        )}
        {record.instructions && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Publishing instructions
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-muted)]">
              {record.instructions}
            </p>
          </div>
        )}
        {record.publishing_notes && (
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
              Publishing notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg-muted)]">
              {record.publishing_notes}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy("Caption", caption)}
          >
            <Copy className="size-3.5" aria-hidden="true" /> Copy caption
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy("Hashtags", hashtags)}
          >
            <Copy className="size-3.5" aria-hidden="true" /> Copy hashtags
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copy("Full post", fullPost)}
          >
            <Copy className="size-3.5" aria-hidden="true" /> Copy full post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublishDetail() {
  useTaskRealtime();
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalKind>(null);

  const recordQuery = usePublishingRecord(recordId ?? null);
  const eventsQuery = usePublishingEvents(recordId ?? null);
  const transition = useTransitionPublishing();

  const record = recordQuery.data ?? null;

  const nameIds = useMemo(
    () => (record?.managed_by ? [record.managed_by] : []),
    [record?.managed_by],
  );
  const namesQuery = useNames(nameIds, !!record?.managed_by);
  const managedByName = record?.managed_by
    ? (namesQuery.data?.get(record.managed_by) ?? null)
    : null;

  const eventActorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of eventsQuery.data ?? []) {
      if (e.actor_id) ids.add(e.actor_id);
    }
    return [...ids];
  }, [eventsQuery.data]);
  const actorNames = useNames(eventActorIds);

  const copy = useCopy();

  const runTransition = (newStatus: "pending" | "cancelled", note?: string) => {
    if (!record) return;
    transition.mutate(
      { recordId: record.id, newStatus, note },
      {
        onSuccess: () => {
          setModal(null);
          if (newStatus === "cancelled") navigate("/social/studio");
        },
      },
    );
  };

  if (recordQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (recordQuery.error || !record) {
    return (
      <div className="space-y-6">
        <Link
          to="/social/studio"
          className="inline-flex items-center gap-2 text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to studio
        </Link>
        <EmptyState
          icon={FileWarning}
          title="Record not found"
          description={
            recordQuery.error instanceof Error
              ? recordQuery.error.message
              : "This publishing record could not be loaded."
          }
        />
      </div>
    );
  }

  const status = record.status;

  return (
    <div className="space-y-6">
      <Link
        to="/social/studio"
        className="inline-flex items-center gap-2 text-sm text-[var(--fg-subtle)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to studio
      </Link>

      <PageHeader
        title="Publishing record"
        description="Review the approved design, prepare the caption, and publish."
        actions={<StatusBadge status={status} />}
      />

      <ApprovedDesignCard
        record={record}
        managedByName={managedByName}
        onRequestChanges={() => setModal("changes")}
      />

      <CaptionStudioCard record={record} copy={copy} />

      {/* Publishing controls */}
      <Card>
        <CardHeader>
          <CardTitle>Publishing controls</CardTitle>
          <CardDescription>
            Actions available for a record in the "{status}" state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "ready" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("publish")}>
                <Send className="size-4" aria-hidden="true" /> Mark published
              </Button>
              <Button variant="secondary" onClick={() => setModal("schedule")}>
                <CalendarClock className="size-4" aria-hidden="true" /> Schedule
              </Button>
              <Button variant="secondary" onClick={() => setModal("pending")}>
                <Hourglass className="size-4" aria-hidden="true" /> Mark pending
              </Button>
              <Button variant="secondary" onClick={() => setModal("changes")}>
                <MessageSquareWarning className="size-4" aria-hidden="true" />
                Request changes
              </Button>
              <Button variant="ghost" onClick={() => setModal("cancel")}>
                <XCircle className="size-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          )}
          {status === "pending" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("schedule")}>
                <CalendarClock className="size-4" aria-hidden="true" /> Schedule
              </Button>
              <Button onClick={() => setModal("publish")}>
                <Send className="size-4" aria-hidden="true" /> Mark published
              </Button>
              <Button variant="secondary" onClick={() => setModal("changes")}>
                <MessageSquareWarning className="size-4" aria-hidden="true" />
                Request changes
              </Button>
              <Button variant="ghost" onClick={() => setModal("cancel")}>
                <XCircle className="size-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          )}
          {status === "scheduled" && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("publish")}>
                <Send className="size-4" aria-hidden="true" /> Mark published
              </Button>
              <Button variant="secondary" onClick={() => setModal("schedule")}>
                <CalendarClock className="size-4" aria-hidden="true" /> Reschedule
              </Button>
              <Button variant="secondary" onClick={() => setModal("changes")}>
                <MessageSquareWarning className="size-4" aria-hidden="true" />
                Request changes
              </Button>
              <Button
                variant="secondary"
                onClick={() => runTransition("pending")}
              >
                <Hourglass className="size-4" aria-hidden="true" /> Back to
                pending
              </Button>
              <Button variant="ghost" onClick={() => setModal("cancel")}>
                <XCircle className="size-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          )}
          {status === "changes_requested" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-[var(--fg-muted)]">
                Awaiting revised version — no publishing actions until the new
                version is approved.
              </p>
              <Button variant="ghost" onClick={() => setModal("cancel")}>
                <XCircle className="size-4" aria-hidden="true" /> Cancel
              </Button>
            </div>
          )}
          {(status === "published" ||
            status === "cancelled" ||
            status === "superseded") && (
            <p className="text-sm text-[var(--fg-muted)]">
              This record is in a terminal state. No further actions are
              available.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                Scheduled at
              </dt>
              <dd className="mt-1 font-medium text-[var(--fg)]">
                {fmtDateTime(record.scheduled_at)}
              </dd>
            </div>
            <div>
              <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                Published at
              </dt>
              <dd className="mt-1 font-medium text-[var(--fg)]">
                {fmtDateTime(record.published_at)}
              </dd>
            </div>
            <div>
              <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                Reschedules
              </dt>
              <dd className="mt-1 font-medium text-[var(--fg)] tabular-nums">{record.reschedule_count}</dd>
            </div>
            <div>
              <dt className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                Platform post ID
              </dt>
              <dd className="mt-1 font-medium text-[var(--fg)]">{record.platform_post_id ?? "—"}</dd>
            </div>
          </dl>
          {record.published_url && (
            <Button asChild variant="secondary" size="sm">
              <a href={record.published_url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                View published post
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Status changes for this publishing record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsQuery.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
            <ol className="space-y-3">
              {eventsQuery.data.map((e) => {
                const actor = e.actor_id
                  ? (actorNames.data?.get(e.actor_id) ?? "Someone")
                  : "System";
                return (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--fg-muted)]">
                        <span className="font-medium text-[var(--fg)]">{actor}</span>
                        {e.from_status && e.to_status ? (
                          <>
                            {" "}
                            moved this from{" "}
                            <span className="font-mono text-xs">
                              {e.from_status}
                            </span>{" "}
                            to{" "}
                            <span className="font-mono text-xs">
                              {e.to_status}
                            </span>
                          </>
                        ) : e.to_status ? (
                          <>
                            {" "}
                            set status to{" "}
                            <span className="font-mono text-xs">
                              {e.to_status}
                            </span>
                          </>
                        ) : (
                          <> updated this record</>
                        )}
                      </p>
                      {e.note && (
                        <p className="mt-1 text-sm text-[var(--fg-muted)]">{e.note}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                      {fmtDateTime(e.created_at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-[var(--fg-subtle)]">No activity yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ScheduleModal
        recordId={record.id}
        currentScheduledAt={record.scheduled_at}
        open={modal === "schedule"}
        onOpenChange={(o) => setModal(o ? "schedule" : null)}
        title={status === "scheduled" ? "Reschedule post" : "Schedule post"}
      />
      <PublishConfirmModal
        recordId={record.id}
        platform={record.platform}
        open={modal === "publish"}
        onOpenChange={(o) => setModal(o ? "publish" : null)}
      />
      <ChangesRequestModal
        recordId={record.id}
        open={modal === "changes"}
        onOpenChange={(o) => setModal(o ? "changes" : null)}
      />
      <ConfirmDialog
        open={modal === "pending"}
        onOpenChange={(o) => setModal(o ? "pending" : null)}
        title="Mark as pending?"
        description="The record will move back to the pending state. You can schedule it again later."
        confirmLabel="Mark pending"
        onConfirm={() => runTransition("pending")}
        loading={transition.isPending}
      />
      <ConfirmDialog
        open={modal === "cancel"}
        onOpenChange={(o) => setModal(o ? "cancel" : null)}
        title="Cancel this record?"
        description="Cancelled records are terminal and cannot be published. This cannot be undone."
        confirmLabel="Cancel record"
        cancelLabel="Keep it"
        onConfirm={() => runTransition("cancelled")}
        loading={transition.isPending}
        variant="danger"
      />
    </div>
  );
}
