/**
 * Review queue card — one submission awaiting a decision.
 * Shared by the Team Lead Review Center, the Organizer Approval Center,
 * and the TaskDetail reviewer block.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  History,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../../components/ui/card";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { toast } from "../../../components/ui/toaster";
import { cn } from "../../../utils/cn";
import { RevisionRequestModal } from "./RevisionRequestModal";
import {
  useApproveAsOrganizer,
  useApproveAsTeamLead,
  useApprovals,
  useRequestOrganizerRevision,
  useRequestTeamLeadRevision,
  useTaskRevisions,
} from "../hooks";
import {
  REVISION_STAGE_META,
  type LeadQueueItem,
  type OrganizerQueueItem,
  type RequestRevisionInput,
} from "../types";

export type ReviewStage = "team_lead" | "organizer";

/** Queue item for either review stage (organizer items carry lead info). */
export type ReviewQueueItem = LeadQueueItem | OrganizerQueueItem;

interface ReviewCardProps {
  item: ReviewQueueItem;
  stage: ReviewStage;
  /** Base path for the task detail link, e.g. "/lead/tasks". */
  detailBase: string;
}


export function ReviewCard({ item, stage, detailBase }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [comment, setComment] = useState("");

  const approveLead = useApproveAsTeamLead();
  const approveOrg = useApproveAsOrganizer();
  const reviseLead = useRequestTeamLeadRevision();
  const reviseOrg = useRequestOrganizerRevision();

  const revisions = useTaskRevisions(expanded ? item.task_id : null, expanded);
  const approvals = useApprovals(expanded ? item.submission_id : null, expanded);

  const approvePending = approveLead.isPending || approveOrg.isPending;
  const revisionPending = reviseLead.isPending || reviseOrg.isPending;

  const doApprove = () => {
    const opts = {
      onSuccess: () => {
        toast.success(
          stage === "organizer"
            ? `Version ${item.version} approved — ready for publishing.`
            : `Version ${item.version} approved — sent to Organizer review.`,
        );
        setApproveOpen(false);
        setComment("");
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (stage === "organizer")
      approveOrg.mutate({ submissionId: item.submission_id, comment }, opts);
    else approveLead.mutate({ submissionId: item.submission_id, comment }, opts);
  };

  const doRevision = (input: RequestRevisionInput) => {
    const opts = {
      onSuccess: () => {
        toast.success("Revision request sent.");
        setRevisionOpen(false);
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (stage === "organizer")
      reviseOrg.mutate({ submissionId: item.submission_id, input }, opts);
    else reviseLead.mutate({ submissionId: item.submission_id, input }, opts);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.task_code && (
            <span className="font-mono text-xs font-semibold text-(--ring)">
              {item.task_code}
            </span>
          )}
          <Badge variant="outline">v{item.version}</Badge>
          {item.priority && (
            <Badge variant="warning" className="capitalize">
              {item.priority}
            </Badge>
          )}
          <span className="ml-auto text-xs text-(--fg-subtle)">
            {item.submitted_at
              ? format(new Date(item.submitted_at), "MMM d, h:mm a")
              : "—"}
          </span>
        </div>
        <h3 className="mt-1 text-base font-semibold text-(--fg)">{item.title}</h3>
        <p className="text-xs text-(--fg-subtle)">
          Designer: {item.designer_name ?? "—"}
          {stage === "organizer" && "lead_name" in item && item.lead_name
            ? ` · Lead: ${item.lead_name}`
            : ""}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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
                Source
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to={`${detailBase}/${item.task_id}`}>Open task</Link>
          </Button>
          {item.due_date && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-(--fg-subtle)">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Due {format(new Date(item.due_date), "MMM d, yyyy")}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-(--fg-muted) hover:text-(--fg)"
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          {expanded ? "Hide history" : "Revision history & previous decisions"}
        </button>
        {expanded && (
          <div className="space-y-2 rounded-lg border border-(--border) bg-(--surface) p-3">
            {revisions.isLoading || approvals.isLoading ? (
              <p className="text-xs text-(--fg-subtle)">Loading…</p>
            ) : (
              <>
                {(approvals.data ?? []).map((a) => (
                  <p key={a.id} className="text-xs text-(--fg-subtle)">
                    <span className="font-medium text-(--fg-muted)">
                      {a.stage === "team_lead" ? "Team Lead" : "Organizer"}
                    </span>{" "}
                    approved v{a.submission_version ?? "—"}
                    {a.comment ? ` — “${a.comment}”` : ""} ·{" "}
                    {a.created_at
                      ? format(new Date(a.created_at), "MMM d, h:mm a")
                      : "—"}
                  </p>
                ))}
                {(revisions.data ?? []).map((r) => {
                  const meta = REVISION_STAGE_META[r.current_stage];
                  return (
                    <p key={r.id} className="text-xs text-(--fg-subtle)">
                      Revision on v{r.submission_version ?? "—"} ·{" "}
                      <Badge variant={meta.variant}>{meta.label}</Badge>{" "}
                      <span className="text-(--fg-muted)">
                        {r.original_instructions?.slice(0, 120)}
                        {(r.original_instructions?.length ?? 0) > 120 ? "…" : ""}
                      </span>
                    </p>
                  );
                })}
                {(approvals.data ?? []).length === 0 &&
                  (revisions.data ?? []).length === 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-(--fg-subtle)">
                      <History className="size-3.5" aria-hidden="true" />
                      No previous decisions yet.
                    </p>
                  )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-(--border) pt-3">
          <Button
            type="button"
            onClick={() => setApproveOpen(true)}
            disabled={approvePending}
          >
            Approve
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRevisionOpen(true)}
            disabled={revisionPending}
          >
            Request changes
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`approve-comment-${item.submission_id}`}>
            Approval comment (optional)
          </Label>
          <Input
            id={`approve-comment-${item.submission_id}`}
            placeholder="Nice work — approved."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </CardContent>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title={stage === "organizer" ? "Approve for publishing?" : "Approve submission?"}
        description={
          stage === "organizer"
            ? `Version ${item.version} will be marked approved and handed to Social Media. This cannot be undone.`
            : `Version ${item.version} will move to Organizer review. This cannot be undone.`
        }
        confirmLabel="Approve"
        loading={approvePending}
        onConfirm={doApprove}
      />
      <RevisionRequestModal
        open={revisionOpen}
        onOpenChange={setRevisionOpen}
        taskCode={item.task_code}
        version={item.version}
        routingNote={
          stage === "organizer"
            ? "Your instructions go to the Team Lead first, who forwards them to the designer."
            : "Your instructions go directly to the designer."
        }
        submitting={revisionPending}
        error={null}
        onSubmit={doRevision}
      />
    </Card>
  );
}
