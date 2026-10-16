import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Hand,
  Link2,
  ListChecks,
  Pencil,
  Play,
  Upload,
  ArrowLeftRight,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { EmptyState } from "../../components/ui/empty-state";
import { PageHeader } from "../../components/ui/page-header";
import { WaveBackground } from "../../components/brand/WaveBackground";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "../../components/ui/toaster";
import { useAuth } from "../../contexts/AuthContext";
import {
  allowedNextStatuses,
  eventLabel,
  PRIORITY_META,
  STATUS_META,
  VISIBILITY_META,
} from "../../utils/taskStatus";
import {
  formatDateTime,
  splitISOToDateTime,
  timeRemaining,
  zonedDateTimeToISO,
} from "../../utils/taskDates";
import { cn } from "../../utils/cn";
import {
  useClaimTask,
  useTaskDetail,
  useTaskMutations,
} from "../../features/tasks/hooks";
import { DuplicateWarning } from "../../features/tasks/components/DuplicateWarning";
import { WorkloadPicker } from "../../features/tasks/components/WorkloadPicker";
import { SubmissionModal } from "../../features/workflow/components/SubmissionModal";
import { VersionTimeline } from "../../features/workflow/components/VersionTimeline";
import { ReviewCard } from "../../features/workflow/components/ReviewCard";
import { RevisionPanel } from "../../features/workflow/components/RevisionPanel";
import { SmmRevisionModal } from "../../features/workflow/components/SmmRevisionModal";
import { WorkflowProgress } from "../../features/workflow/components/WorkflowProgress";
import {
  useHandoffs,
  useNames,
  useRequestSocialMediaRevision,
  useSubmissions,
  useTaskRevisions,
} from "../../features/workflow/hooks";
import type { OrganizerQueueItem } from "../../features/workflow/types";
import type {
  ProductionStatus,
  Task,
  TaskBrief,
  TaskPatch,
  TaskPriority,
} from "../../types/tasks";

/**
 * Task detail page — tabs for overview, brief, references, social content,
 * checklist and activity, plus role-aware actions (claim, accept/decline,
 * status advances, edit, cancel, reassign).
 * Expected routes (wired by the coordinator): /:roleBase/tasks/:id
 */
export default function TaskDetail() {
  const params = useParams();
  const id = params.id ?? params.taskId;
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useTaskDetail(id);
  const mutations = useTaskMutations();
  const claim = useClaimTask();

  const [tab, setTab] = useState("overview");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [smmReviseOpen, setSmmReviseOpen] = useState(false);

  const duplicateWarning =
    (location.state as { duplicateWarning?: string | null } | null)
      ?.duplicateWarning ?? null;

  const detail = query.data;
  const t = detail?.task ?? null;

  const isCreator = !!t && !!user && t.created_by === user.id;
  const isAssignee =
    !!t && !!user && (t.assignee_id === user.id || t.claimed_by === user.id);
  const canClaim =
    role === "designer" &&
    t?.production_status === "available" &&
    t?.visibility === "public" &&
    !t?.claimed_by;
  const myPending = detail?.my_pending_assignment ?? null;
  const canEdit = !!t && (role === "organizer" || isCreator);
  const canReassign = !!t && (role === "organizer" || isCreator);

  const nextStatuses: ProductionStatus[] = useMemo(
    () =>
      t
        ? allowedNextStatuses(t.production_status, role, user?.id ?? null, {
            created_by: t.created_by,
            assignee_id: t.assignee_id,
            claimed_by: t.claimed_by,
            visibility: t.visibility,
          })
        : [],
    [t, role, user],
  );

  interface ActionDef {
    key: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
    pending: boolean;
    variant?: "default" | "secondary" | "destructive";
  }

  /* ---------------- Phase 3 workflow state ---------------- */
  const submissionsQuery = useSubmissions(t?.id ?? null, !!t);
  const revisionsQuery = useTaskRevisions(t?.id ?? null, !!t);
  // RLS scopes handoffs to what the viewer may see; the SMM branch
  // only renders when a current handoff exists for this task.
  const handoffsQuery = useHandoffs();
  const smmRevision = useRequestSocialMediaRevision();

  const currentSubmission =
    submissionsQuery.data?.find((s) => s.is_current) ?? null;
  const openRevisions = (revisionsQuery.data ?? []).filter(
    (r) => !r.resolved_at && r.status !== "resolved",
  );
  const nextVersion =
    (submissionsQuery.data ?? []).reduce(
      (m, s) => Math.max(m, s.version ?? 0),
      0,
    ) + 1;

  const canSubmitDesign =
    role === "designer" &&
    isAssignee &&
    !!t &&
    [
      "assigned",
      "accepted",
      "in_progress",
      "revision_required_designer",
    ].includes(t.production_status);

  const leadDecision =
    role === "team_lead" && t?.production_status === "submitted_lead_review";
  const orgDecision =
    role === "organizer" &&
    t?.production_status === "submitted_organizer_review";
  const smmDecision =
    role === "social_media_manager" &&
    t?.production_status === "ready_for_publishing";
  const currentHandoff =
    handoffsQuery.data?.find((h) => h.task_id === t?.id && h.is_current) ??
    null;

  const nameIds = [
    ...(currentSubmission?.designer_id ? [currentSubmission.designer_id] : []),
    ...(t?.assign_lead_id ? [t.assign_lead_id] : []),
  ];
  const namesQuery = useNames(nameIds, !!currentSubmission);
  const names = namesQuery.data ?? new Map<string, string>();

  const reviewItem: OrganizerQueueItem | null =
    t && currentSubmission && (leadDecision || orgDecision)
      ? {
          submission_id: currentSubmission.id,
          task_id: t.id,
          task_code: t.task_code,
          title: t.title,
          version: currentSubmission.version ?? 0,
          designer_id: currentSubmission.designer_id,
          designer_name:
            (currentSubmission.designer_id &&
              names.get(currentSubmission.designer_id)) ||
            "Designer",
          drive_link: currentSubmission.drive_link,
          source_url: currentSubmission.source_url,
          submitted_at: currentSubmission.submitted_at,
          due_date: t.due_date,
          priority: t.priority,
          lead_id: t.assign_lead_id,
          lead_name:
            (t.assign_lead_id && names.get(t.assign_lead_id)) || null,
        }
      : null;

  const detailBase =
    role === "organizer"
      ? "/organizer/tasks"
      : role === "team_lead"
        ? "/lead/tasks"
        : role === "social_media_manager"
          ? "/social/tasks"
          : "/designer/tasks";

  const actions: ActionDef[] = [];
  if (t) {
    if (canClaim) {
      actions.push({
        key: "claim",
        label: claim.isPending ? "Claiming…" : "Claim this task",
        icon: Hand,
        run: () => claim.mutate(t.id),
        pending: claim.isPending,
      });
    }
    if (myPending) {
      actions.push({
        key: "accept",
        label: mutations.accept.isPending ? "Accepting…" : "Accept assignment",
        icon: Check,
        run: () => mutations.accept.mutate(myPending.id),
        pending: mutations.accept.isPending,
      });
      actions.push({
        key: "decline",
        label: "Decline",
        icon: X,
        run: () => {
          setDeclineReason("");
          setDeclineOpen(true);
        },
        pending: false,
        variant: "secondary",
      });
    }
    if (canSubmitDesign) {
      actions.push({
        key: "submit-design",
        label: "Submit design",
        icon: Upload,
        run: () => setSubmitOpen(true),
        pending: false,
      });
    }
    for (const s of nextStatuses) {
      if (s === "available") {
        actions.push({
          key: "publish",
          label: mutations.publish.isPending ? "Publishing…" : "Publish task",
          icon: Upload,
          run: () => mutations.publish.mutate(t.id),
          pending: mutations.publish.isPending,
        });
      } else if (s === "in_progress") {
        actions.push({
          key: "start",
          label:
            t.production_status === "assigned" ? "Start work" : "Resume work",
          icon: Play,
          run: () =>
            mutations.updateStatus.mutate({
              taskId: t.id,
              status: "in_progress",
            }),
          pending: mutations.updateStatus.isPending,
        });
      } else if (s === "cancelled") {
        actions.push({
          key: "cancel",
          label: "Cancel task",
          icon: XCircle,
          run: () => {
            setCancelReason("");
            setCancelOpen(true);
          },
          pending: false,
          variant: "destructive",
        });
      }
      // "assigned" is only reachable via claim (covered above);
      // "accepted" without a pending assignment row is not actionable.
    }
    if (canEdit) {
      actions.push({
        key: "edit",
        label: "Edit task",
        icon: Pencil,
        run: () => setEditOpen(true),
        pending: false,
        variant: "secondary",
      });
    }
    if (canReassign) {
      actions.push({
        key: "reassign",
        label: "Reassign",
        icon: ArrowLeftRight,
        run: () => setReassignOpen(true),
        pending: false,
        variant: "secondary",
      });
    }
  }

  const doneCount = detail?.checklist.filter((c) => c.is_done).length ?? 0;
  const totalCount = detail?.checklist.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={t?.task_code ?? "Task"}
        description={t ? t.title : "Loading task…"}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        }
      />

      <DuplicateWarning message={duplicateWarning} />

      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : query.isError || !detail || !t ? (
        <EmptyState
          icon={CircleDashed}
          title="Task not found"
          description="This task may have been deleted, or you don't have access to it."
          action={
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Go back
            </Button>
          }
        />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="brief">Design brief</TabsTrigger>
            <TabsTrigger value="references">
              References
              {detail.references.length > 0 && ` (${detail.references.length})`}
            </TabsTrigger>
            <TabsTrigger value="social">Social content</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="checklist">
              Checklist
              {totalCount > 0 && ` (${doneCount}/${totalCount})`}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <OverviewHeader task={t} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <MetaCard detail={detail} />
                <AssignmentCard detail={detail} />
                <ActionsCard actions={actions} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <WorkflowProgress status={t.production_status} />
                {reviewItem && (
                  <div className="lg:col-span-2">
                    <ReviewCard
                      item={reviewItem}
                      stage={leadDecision ? "team_lead" : "organizer"}
                      detailBase={detailBase}
                    />
                  </div>
                )}
                {smmDecision && currentHandoff && (
                  <div className="lg:col-span-2">
                    <div className="rounded-xl border border-token bg-surface-2 p-4">
                      <p className="text-sm font-medium text-fg">
                        Approved and ready for publishing (v
                        {currentHandoff.submission_version ?? "—"}).
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        If something needs fixing, request changes — they
                        route through the Organizer and Team Lead before
                        reaching the designer.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setSmmReviseOpen(true)}
                      >
                        Request changes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {t.spec && <SpecCard task={t} />}
            </div>
          </TabsContent>

          <TabsContent value="brief">
            <BriefTab brief={detail.brief} />
          </TabsContent>

          <TabsContent value="references">
            <ReferencesTab taskId={t.id} references={detail.references} />
          </TabsContent>

          <TabsContent value="social">
            <SocialTab task={t} />
          </TabsContent>

          <TabsContent value="versions">
            <div className="space-y-4">
              <VersionTimeline taskId={t.id} />
              {openRevisions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-fg">
                    Open revisions
                  </h3>
                  {openRevisions.map((r) => (
                    <RevisionPanel key={r.id} revision={r} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="checklist">
            <ChecklistTab
              taskId={t.id}
              items={detail.checklist}
              canToggle={isAssignee}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTab events={detail.events} />
          </TabsContent>
        </Tabs>
      )}

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel task</DialogTitle>
            <DialogDescription>
              {t?.task_code} — {t?.title}. This moves the task to Cancelled and
              can't be undone from here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="detail-cancel-reason">Reason (optional)</Label>
            <Textarea
              id="detail-cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this task being cancelled?"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={mutations.cancel.isPending}
            >
              Keep task
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutations.cancel.isPending}
              onClick={() =>
                t &&
                mutations.cancel.mutate(
                  {
                    taskId: t.id,
                    reason: cancelReason.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Task cancelled.");
                      setCancelOpen(false);
                    },
                  },
                )
              }
            >
              {mutations.cancel.isPending ? "Cancelling…" : "Cancel task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline assignment</DialogTitle>
            <DialogDescription>
              Let the team know why you can't take this task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="detail-decline-reason">Reason</Label>
            <Textarea
              id="detail-decline-reason"
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="E.g. bandwidth, skill mismatch…"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeclineOpen(false)}
              disabled={mutations.decline.isPending}
            >
              Keep assignment
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={mutations.decline.isPending || !myPending}
              onClick={() =>
                myPending &&
                mutations.decline.mutate(
                  {
                    assignmentId: myPending.id,
                    reason: declineReason.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Assignment declined.");
                      setDeclineOpen(false);
                    },
                  },
                )
              }
            >
              {mutations.decline.isPending ? "Declining…" : "Decline assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {t && (
        <EditTaskDialog task={t} open={editOpen} onOpenChange={setEditOpen} />
      )}
      {t && (
        <ReassignDialog task={t} open={reassignOpen} onOpenChange={setReassignOpen} />
      )}

      {/* Phase 3 workflow dialogs */}
      {t && (
        <SubmissionModal
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          taskId={t.id}
          taskCode={t.task_code}
          nextVersion={nextVersion}
          checklistTotal={totalCount}
          checklistDone={doneCount}
        />
      )}
      <SmmRevisionModal
        open={smmReviseOpen}
        onOpenChange={setSmmReviseOpen}
        taskCode={t?.task_code ?? null}
        version={currentHandoff?.submission_version ?? null}
        submitting={smmRevision.isPending}
        onSubmit={(instructions, priority) => {
          if (!currentHandoff) return;
          smmRevision.mutate(
            {
              handoffId: currentHandoff.id,
              input: { instructions, priority },
            },
            {
              onSuccess: () => {
                toast.success(
                  "Revision requested — the Organizer will review it first.",
                );
                setSmmReviseOpen(false);
              },
              onError: (err) => toast.error(err.message),
            },
          );
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* overview tab pieces                                                 */
/* ------------------------------------------------------------------ */

function OverviewHeader({ task }: { task: Task }) {
  const status = STATUS_META[task.production_status];
  const priority = PRIORITY_META[task.priority];
  const remaining = timeRemaining(task.due_date);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <WaveBackground variant="corner" opacity={0.4} />
      <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold tracking-wide text-volt">
          {task.task_code ?? "DF-????"}
        </span>
        <Badge variant={status.badge}>{status.label}</Badge>
        <Badge variant={priority.badge}>{priority.label}</Badge>
        <Badge variant={VISIBILITY_META[task.visibility].badge}>
          {VISIBILITY_META[task.visibility].label}
        </Badge>
      </div>
      <h1 className="mt-3 font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
        {task.title}
      </h1>
      {task.description && (
        <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted">
          {task.description}
        </p>
      )}
      {remaining && (
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 text-sm",
            remaining.overdue
              ? "font-medium text-[var(--error)]"
              : remaining.urgent
                ? "text-[var(--warning)]"
                : "text-muted",
          )}
        >
          <CalendarClock className="size-4" aria-hidden="true" />
          Due {formatDateTime(task.due_date)} · {remaining.label}
        </p>
      )}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wider text-subtle">
        {label}
      </span>
      <span className="text-right text-sm text-fg">{value ?? "—"}</span>
    </div>
  );
}

function MetaCard({ detail }: { detail: NonNullable<ReturnType<typeof useTaskDetail>["data"]> }) {
  const t = detail.task;
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card">
      <h2 className="font-display text-sm font-bold text-fg">Details</h2>
      <dl className="mt-2 divide-y divide-[var(--border)]">
        <MetaRow label="Created by" value={detail.creator_name} />
        <MetaRow label="Created" value={formatDateTime(t.created_at)} />
        <MetaRow
          label="Campaign"
          value={t.campaign_name}
        />
        <MetaRow label="Category" value={t.design_category} />
        <MetaRow label="Platform" value={t.target_platform} />
        <MetaRow
          label="Difficulty"
          value={t.difficulty ? t.difficulty[0].toUpperCase() + t.difficulty.slice(1) : "—"}
        />
        <MetaRow
          label="Est. hours"
          value={t.est_hours != null ? `${t.est_hours}h` : "—"}
        />
        <MetaRow label="Timezone" value={t.timezone} />
      </dl>
    </div>
  );
}

function AssignmentCard({ detail }: { detail: NonNullable<ReturnType<typeof useTaskDetail>["data"]> }) {
  const t = detail.task;
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card">
      <h2 className="font-display text-sm font-bold text-fg">Assignment</h2>
      <dl className="mt-2 divide-y divide-[var(--border)]">
        <MetaRow label="Assignee" value={detail.assignee_name} />
        <MetaRow label="Claimed by" value={detail.claimant_name} />
        <MetaRow
          label="Status"
          value={STATUS_META[t.production_status].hint}
        />
      </dl>
      {detail.assignments.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-token pt-3">
          {detail.assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-muted">
                {a.assignee_name ?? "Designer"}
              </span>
              <Badge
                variant={
                  a.status === "accepted"
                    ? "success"
                    : a.status === "declined"
                      ? "danger"
                      : "warning"
                }
              >
                {a.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionsCard({
  actions,
}: {
  actions: {
    key: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
    pending: boolean;
    variant?: "default" | "secondary" | "destructive";
  }[];
}) {
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card">
      <h2 className="font-display text-sm font-bold text-fg">Actions</h2>
      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">
          No actions available for you on this task right now.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {actions.map((a) => (
            <Button
              key={a.key}
              type="button"
              variant={a.variant ?? "default"}
              onClick={a.run}
              disabled={a.pending}
              className="justify-start gap-2"
            >
              <a.icon className="size-4" aria-hidden="true" />
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpecCard({ task }: { task: Task }) {
  const s = task.spec!;
  const rows: [string, React.ReactNode][] = [
    ["Design type", s.design_type],
    [
      "Dimensions",
      s.width && s.height ? `${s.width} × ${s.height} px` : null,
    ],
    ["Orientation", s.orientation],
    ["Slides", s.slides],
    ["Format", s.format],
    ["Source file", s.source_file_required ? "Required" : null],
    ["Brand colors", s.brand_colors],
    ["Fonts", s.fonts],
    ["Style", s.style],
    ["Background", s.background],
    ["Must include", s.mandatory_elements],
    ["Avoid", s.avoid_elements],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "") as [
    string,
    React.ReactNode,
  ][];
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <h2 className="font-display text-sm font-bold text-fg">Design spec</h2>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-token py-2.5">
            <dt className="text-xs font-medium uppercase tracking-wider text-subtle">
              {label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-fg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* other tabs                                                          */
/* ------------------------------------------------------------------ */

function BriefTab({ brief }: { brief: TaskBrief | null }) {
  if (!brief) {
    return (
      <EmptyState
        icon={Pencil}
        title="No brief yet"
        description="The design brief hasn't been written for this task."
      />
    );
  }
  const rows: [string, string | null][] = [
    ["Objective", brief.objective],
    ["Target audience", brief.audience],
    ["Headlines", brief.headlines],
    ["Mandatory copy", brief.mandatory_copy],
    ["Concept", brief.concept],
    ["Layout guidance", brief.layout],
    ["Color & typography", brief.color_type_instructions],
    ["Call to action", brief.cta],
    ["Notes", brief.notes],
  ];
  const filled = rows.filter(([, v]) => v && v.trim());
  if (brief.brief_text && filled.length === 0) {
    return (
      <div className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
          {brief.brief_text}
        </p>
      </div>
    );
  }
  if (filled.length === 0) {
    return (
      <EmptyState
        icon={Pencil}
        title="Brief is empty"
        description="The brief exists but has no content yet."
      />
    );
  }
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <dl className="space-y-5">
        {filled.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-volt">
              {label}
            </dt>
            <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReferencesTab({
  taskId,
  references,
}: {
  taskId: string;
  references: NonNullable<ReturnType<typeof useTaskDetail>["data"]>["references"];
}) {
  void taskId;
  if (references.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No references"
        description="No reference links were attached to this task."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {references.map((r) => (
        <li key={r.id}>
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-token bg-surface p-4 transition-colors hover:border-volt/40"
          >
            <ExternalLink
              className="size-4 shrink-0 text-subtle"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">
                {r.label}
              </span>
              <span className="block truncate text-xs text-subtle">
                {r.url}
              </span>
            </span>
            <Badge variant="outline" className="shrink-0 capitalize">
              {r.kind}
            </Badge>
          </a>
        </li>
      ))}
    </ul>
  );
}

function SocialTab({ task }: { task: Task }) {
  const s = task.social;
  const rows: [string, string | null][] = [
    ["Caption", s?.caption ?? null],
    ["Hashtags", s?.hashtags ?? null],
    ["Mentions", s?.mentions ?? null],
    ["Call to action", s?.cta ?? null],
    ["Platform", s?.platform ?? null],
    [
      "Preferred publish time",
      s?.preferred_publish_at ? formatDateTime(s.preferred_publish_at) : null,
    ],
    ["Instructions", s?.instructions ?? null],
  ];
  const filled = rows.filter(([, v]) => v && v.trim());
  if (filled.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No social content"
        description="No caption or publishing notes were added to this task."
      />
    );
  }
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <dl className="space-y-5">
        {filled.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-volt">
              {label}
            </dt>
            <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChecklistTab({
  taskId,
  items,
  canToggle,
}: {
  taskId: string;
  items: NonNullable<ReturnType<typeof useTaskDetail>["data"]>["checklist"];
  canToggle: boolean;
}) {
  void taskId;
  const mutations = useTaskMutations();
  const done = items.filter((i) => i.is_done).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No checklist"
        description="This task has no checklist items."
      />
    );
  }
  return (
    <div className="rounded-xl border border-token bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {done} of {items.length} done
        </p>
        <div
          className="h-2 w-40 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checklist progress"
        >
          <div
            className="h-full rounded-full bg-volt transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!canToggle || mutations.toggleChecklist.isPending}
              onClick={() => mutations.toggleChecklist.mutate(item.id)}
              aria-pressed={item.is_done}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                item.is_done
                  ? "border-volt/30 bg-volt/5"
                  : "border-token bg-surface-2 hover:border-token-strong",
                !canToggle && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border",
                  item.is_done
                    ? "border-volt bg-volt text-white"
                    : "border-token-strong text-transparent",
                )}
                aria-hidden="true"
              >
                <Check className="size-3.5" />
              </span>
              <span
                className={cn(
                  "text-sm",
                  item.is_done ? "text-subtle line-through" : "text-fg",
                )}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!canToggle && (
        <p className="mt-3 text-xs text-subtle">
          Only the assigned designer can tick off checklist items.
        </p>
      )}
    </div>
  );
}

function ActivityTab({
  events,
}: {
  events: NonNullable<ReturnType<typeof useTaskDetail>["data"]>["events"];
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No activity yet"
        description="Task events will appear here as things happen."
      />
    );
  }
  return (
    <ol className="relative space-y-0 border-l border-token pl-0">
      {events.map((e) => (
        <li key={e.id} className="relative pb-6 pl-8 last:pb-0">
          <span
            className="absolute left-0 top-1 size-2.5 -translate-x-[5px] rounded-full border-2 border-token-strong bg-volt"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-fg">
            {eventLabel(e.event_type)}
          </p>
          <p className="mt-0.5 text-xs text-subtle">
            {e.actor_name ?? "System"} ·{" "}
            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* dialogs                                                             */
/* ------------------------------------------------------------------ */

function EditTaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const mutations = useTaskMutations();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [difficulty, setDifficulty] = useState(task.difficulty ?? "");
  const [estHours, setEstHours] = useState(
    task.est_hours != null ? String(task.est_hours) : "",
  );
  const [campaign, setCampaign] = useState(task.campaign_name ?? "");
  const [category, setCategory] = useState(task.design_category ?? "");
  const [platform, setPlatform] = useState(task.target_platform ?? "");
  const initial = splitISOToDateTime(task.due_date);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setDifficulty(task.difficulty ?? "");
    setEstHours(task.est_hours != null ? String(task.est_hours) : "");
    setCampaign(task.campaign_name ?? "");
    setCategory(task.design_category ?? "");
    setPlatform(task.target_platform ?? "");
    const parts = splitISOToDateTime(task.due_date);
    setDate(parts.date);
    setTime(parts.time);
    setFormError(null);
  }, [open, task]);

  const save = () => {
    if (title.trim().length < 2) {
      setFormError("The title needs at least 2 characters.");
      return;
    }
    let due_date: string | null = task.due_date;
    if (date) {
      if (!time) {
        setFormError("Add a time for the deadline.");
        return;
      }
      try {
        due_date = zonedDateTimeToISO(
          date,
          time,
          task.timezone ?? "Asia/Karachi",
        );
      } catch {
        setFormError("That deadline date/time is not valid.");
        return;
      }
    } else {
      due_date = null;
    }
    const patch: TaskPatch = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      difficulty: (difficulty || undefined) as TaskPatch["difficulty"],
      est_hours: estHours === "" ? null : Number(estHours),
      campaign_name: campaign.trim() || undefined,
      design_category: category.trim() || undefined,
      target_platform: platform.trim() || undefined,
      due_date,
    };
    mutations.patch.mutate(
      { taskId: task.id, patch },
      {
        onSuccess: () => {
          toast.success("Task updated.");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            {task.task_code} — changes are saved immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-priority">Priority</Label>
            <Select
              id="edit-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-difficulty">Difficulty</Label>
            <Select
              id="edit-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Not set</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-hours">Est. hours</Label>
            <Input
              id="edit-hours"
              type="number"
              min={0}
              value={estHours}
              onChange={(e) => setEstHours(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-campaign">Campaign</Label>
            <Input
              id="edit-campaign"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-category">Category</Label>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-platform">Platform</Label>
            <Input
              id="edit-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">Deadline date</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-time">Deadline time</Label>
            <Input
              id="edit-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-[var(--error)]">
            {formError}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutations.patch.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={mutations.patch.isPending}
          >
            {mutations.patch.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReassignDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const mutations = useTaskMutations();
  const [selected, setSelected] = useState(task.assignee_id ?? "");

  useEffect(() => {
    if (open) setSelected(task.assignee_id ?? "");
  }, [open, task.assignee_id]);

  const confirm = () => {
    if (!selected) {
      toast.error("Choose a designer first.");
      return;
    }
    mutations.reassign.mutate(
      { taskId: task.id, newAssigneeId: selected },
      {
        onSuccess: () => {
          toast.success("Task reassigned.");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Reassign task</DialogTitle>
          <DialogDescription>
            {task.task_code} — {task.title}
          </DialogDescription>
        </DialogHeader>
        <WorkloadPicker
          label="New assignee"
          memberRole="designer"
          value={selected}
          onChange={setSelected}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutations.reassign.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={mutations.reassign.isPending || !selected}
          >
            {mutations.reassign.isPending ? "Reassigning…" : "Reassign task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
