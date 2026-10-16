/**
 * Version timeline — every immutable submission version of a task,
 * newest first, with the current version clearly marked.
 */
import { format } from "date-fns";
import { ExternalLink, History } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../utils/cn";
import { useApprovals, useSubmissions } from "../hooks";
import {
  SUBMISSION_STATUS_META,
  type ApprovalRow,
  type SubmissionRow,
} from "../types";

function ApprovalLine({ approval }: { approval: ApprovalRow }) {
  return (
    <p className="text-xs text-subtle">
      <span className="font-medium text-muted">
        {approval.stage === "team_lead" ? "Team Lead" : "Organizer"}
      </span>{" "}
      approved
      {approval.approver_name ? ` by ${approval.approver_name}` : ""}
      {" · "}
      {approval.created_at
        ? format(new Date(approval.created_at), "MMM d, yyyy h:mm a")
        : "—"}
      {approval.comment && (
        <span className="block text-muted">“{approval.comment}”</span>
      )}
    </p>
  );
}

function VersionCard({
  submission,
  isLatest,
}: {
  submission: SubmissionRow;
  isLatest: boolean;
}) {
  const approvals = useApprovals(submission.id);
  const meta = SUBMISSION_STATUS_META[submission.status];
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4",
        isLatest
          ? "border-volt/40 bg-volt/[0.04]"
          : "border-token bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-volt">
          v{submission.version}
        </span>
        {isLatest && (
          <Badge variant="volt">Latest</Badge>
        )}
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="ml-auto text-xs text-subtle">
          {submission.submitted_at
            ? format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")
            : "—"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <a
          href={submission.drive_link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-volt"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open design
        </a>
        {submission.source_url && (
          <div>
            <a
              href={submission.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-volt"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              Source file
            </a>
          </div>
        )}
        {submission.preview_url && (
          <div>
            <a
              href={submission.preview_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-volt"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
              Preview
            </a>
          </div>
        )}
      </div>

      {submission.notes && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted">
          {submission.notes}
        </p>
      )}

      {submission.reference_links.length > 0 && (
        <div className="mt-3 space-y-1">
          {submission.reference_links.map((l, i) => (
            <a
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-subtle hover:text-volt"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}

      {approvals.data && approvals.data.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-token pt-3">
          {approvals.data.map((a) => (
            <ApprovalLine key={a.id} approval={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VersionTimeline({ taskId }: { taskId: string }) {
  const query = useSubmissions(taskId);

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-red-400">
            Could not load version history.
          </p>
        </CardContent>
      </Card>
    );
  }
  const versions = query.data ?? [];
  if (versions.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No submissions yet"
        description="Versions will appear here once the designer submits work."
        className="border border-dashed border-token"
      />
    );
  }
  return (
    <div className="space-y-3">
      {versions.map((s, i) => (
        <VersionCard key={s.id} submission={s} isLatest={i === 0 && s.is_current} />
      ))}
    </div>
  );
}
