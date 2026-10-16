import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardList,
  Inbox,
  PenTool,
  BarChart3,
  Activity,
  Globe,
  Eye,
  Hourglass,
  RefreshCcw,
  BadgeCheck,
  AlertTriangle,
  Plus,
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";
import { StatCard } from "../../components/ui/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Avatar } from "../../components/ui/avatar";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useAuth } from "../../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useLeadDashboard } from "../../features/lead/hooks/useLeadDashboard";
import { useLeadStats } from "../../features/analytics/hooks";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useLeadQueue } from "../../features/workflow/hooks";
import {
  TASK_STATUS,
  eventTypeLabel,
  isActiveStatus,
  productionStatusLabel,
  productionStatusVariant,
} from "../../features/dashboard/types";
import type { LeadTaskRow } from "../../features/lead/services/dashboard";
import { WorkflowStats } from "../../features/workflow/components/WorkflowStats";

const TODAY_LABEL = format(new Date(), "EEEE, MMMM d, yyyy");

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function firstName(name: string | null | undefined): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

function TaskRowItem({ task, index }: { task: LeadTaskRow; index: number }) {
  return (
    <motion.li
      {...fadeUp}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="flex items-center justify-between gap-4 rounded-xl border border-(--border) bg-(--surface-2) px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-(--fg)">
          {task.task_code ? (
            <span className="mr-2 font-mono text-xs font-medium text-(--fg-subtle)">
              {task.task_code}
            </span>
          ) : null}
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-(--fg-muted)">
          {task.due_date
            ? `Due ${format(new Date(task.due_date), "MMM d, yyyy")}`
            : "No due date"}
        </p>
      </div>
      <Badge variant={productionStatusVariant(task.production_status)}>
        {productionStatusLabel(task.production_status)}
      </Badge>
    </motion.li>
  );
}

function TaskListCard({
  title,
  description,
  tasks,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  description: string;
  tasks: LeadTaskRow[];
  isLoading: boolean;
  emptyIcon: typeof ClipboardList;
  emptyTitle: string;
  emptyDescription: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {viewAllHref && (
            <Button asChild variant="ghost" size="sm" className="min-h-[44px] shrink-0">
              <Link to={viewAllHref}>
                {viewAllLabel ?? "View all"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : tasks.length > 0 ? (
          <ul className="space-y-3">
            {tasks.map((task, i) => (
              <TaskRowItem key={task.id} task={task} index={i} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Scoped team-lead analytics from the get_lead_stats RPC (server-scoped). */
function LeadAnalyticsSection() {
  const stats = useLeadStats();
  const s = stats.data;
  const loading = stats.isLoading;

  const cards = [
    { title: "Awaiting my review", value: s?.awaiting_my_review ?? 0, icon: Eye, hint: "Needs your decision" },
    { title: "At organizer review", value: s?.organizer_review_pending ?? 0, icon: Hourglass, hint: "You approved, organizer pending" },
    { title: "Revision required", value: s?.revision_required ?? 0, icon: RefreshCcw, hint: "Across your scope" },
    { title: "Approved designs", value: s?.approved_designs ?? 0, icon: BadgeCheck, hint: "Ready or published" },
    { title: "Published designs", value: s?.published_designs ?? 0, icon: Globe, hint: "All platforms done" },
    { title: "Overdue tasks", value: s?.overdue_tasks ?? 0, icon: AlertTriangle, hint: "Past due date" },
  ];

  return (
    <section aria-label="Team analytics">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="size-4 text-(--ring)" aria-hidden="true" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-(--fg-muted)">
          Team analytics
        </h2>
      </div>
      {stats.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-(--error)">
              Could not load team analytics.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 min-h-[44px]"
              onClick={() => void stats.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              {...fadeUp}
              transition={{ duration: 0.3, delay: 0.04 * i }}
            >
              <StatCard
                title={c.title}
                value={c.value}
                icon={c.icon}
                hint={c.hint}
                loading={loading}
              />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Compact preview of the review queue with a shortcut to the Review Center. */
function ReviewQueuePreview() {
  const queue = useLeadQueue();
  const items = useMemo(() => (queue.data ?? []).slice(0, 3), [queue.data]);

  return (
    <Card className="h-full border-(--ring)/30">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-(--ring)" aria-hidden="true" />
            <CardTitle className="font-display">Review queue</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm" className="min-h-[44px] shrink-0">
            <Link to="/lead/reviews">
              Review Center
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <CardDescription>
          Submissions from your designers awaiting your decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queue.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : queue.isError ? (
          <p className="text-sm text-(--error)">
            Could not load the review queue.{" "}
            <button
              type="button"
              className="font-medium text-(--ring) underline underline-offset-4"
              onClick={() => void queue.refetch()}
            >
              Retry
            </button>
          </p>
        ) : items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item, i) => (
              <motion.li key={item.submission_id} {...fadeUp} transition={{ delay: 0.05 * i, duration: 0.3 }}>
                <Link
                  to="/lead/reviews"
                  className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl border border-(--border) bg-(--surface-2) px-4 py-3 transition-colors hover:border-(--ring)/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-(--fg)">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-(--fg-muted)">
                      v{item.version} · {item.designer_name ?? "Designer"}
                    </p>
                  </div>
                  <Badge variant="warning">Needs review</Badge>
                </Link>
              </motion.li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Queue is clear"
            description="No submissions are waiting for your review right now."
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function LeadDashboard() {
  useTaskRealtime(true);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const uid = user?.id ?? null;
  const { tasks, designerWorkload, recentActivity } = useLeadDashboard();

  const taskList = useMemo(() => tasks.data ?? [], [tasks.data]);

  const createdByMe = useMemo(
    () => taskList.filter((t) => t.created_by === uid),
    [taskList, uid],
  );
  const assignedByOrganizer = useMemo(
    () => taskList.filter((t) => t.assigned_lead_id === uid),
    [taskList, uid],
  );
  const unclaimedPublicCreated = useMemo(
    () =>
      createdByMe.filter(
        (t) =>
          t.visibility === "public" &&
          t.production_status === TASK_STATUS.AVAILABLE &&
          t.claimed_by === null,
      ),
    [createdByMe],
  );
  const activeDesigns = useMemo(
    () => createdByMe.filter((t) => isActiveStatus(t.production_status)),
    [createdByMe],
  );

  const workloadRows = useMemo(
    () => designerWorkload.data ?? [],
    [designerWorkload.data],
  );
  const activity = useMemo(
    () => recentActivity.data ?? [],
    [recentActivity.data],
  );

  const statsLoading = tasks.isLoading;
  const loadError =
    tasks.isError || designerWorkload.isError || recentActivity.isError;

  function retryAll() {
    void queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]) === "lead",
    });
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      {/* Hero — brand moment with signature waves */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.4 }}
        aria-label="Welcome"
        className="relative overflow-hidden rounded-2xl border border-token bg-gradient-to-br from-midnight via-aubergine to-royal text-white shadow-pop"
      >
        <WaveBackground variant="bottom" />
        <div className="relative space-y-5 p-6 sm:p-8">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-lavender">
            AWS Community Karachi · Team Lead
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {firstName(profile?.full_name)}.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/75">
              {TODAY_LABEL} — brief designers, keep reviews moving, and ship
              the next community design.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="min-h-[48px] font-display">
              <Link to="/lead/tasks/new">
                <Plus className="size-4" aria-hidden="true" />
                Create task
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-[48px] border-token-strong bg-white/10 font-display text-white hover:bg-white/20"
            >
              <Link to="/lead/reviews">
                <ClipboardCheck className="size-4" aria-hidden="true" />
                Review queue
              </Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-(--error)/30 bg-(--error)/10 px-4 py-3"
        >
          <p className="text-sm text-(--error)">
            Some dashboard data could not be loaded.
          </p>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={retryAll}>
            Retry
          </Button>
        </div>
      )}

      {/* Stat cards — every value from a live query */}
      <section aria-label="Key metrics">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
              <StatCard
                title="Tasks created by me"
                value={createdByMe.length}
                icon={ClipboardList}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
              <StatCard
                title="Assigned by organizer"
                value={assignedByOrganizer.length}
                icon={Inbox}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
              <StatCard
                title="Unclaimed public"
                value={unclaimedPublicCreated.length}
                hint="My briefs still open"
                icon={Globe}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
              <StatCard
                title="Active designs"
                value={activeDesigns.length}
                icon={PenTool}
              />
            </motion.div>
          </div>
        )}
      </section>

      <WorkflowStats role="team_lead" />

      <LeadAnalyticsSection />

      {/* Review queue + created */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Review queue">
          <ReviewQueuePreview />
        </section>
        <section aria-label="My created tasks">
          <TaskListCard
            title="My created tasks"
            description="Your five most recent tasks."
            tasks={createdByMe.slice(0, 5)}
            isLoading={tasks.isLoading}
            emptyIcon={ClipboardList}
            emptyTitle="No tasks created yet"
            emptyDescription="Tasks you create will appear here."
            viewAllHref="/lead/created"
            viewAllLabel="All created"
          />
        </section>
      </div>

      {/* Assigned + workload */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Assigned by organizer">
          <TaskListCard
            title="Assigned by organizer"
            description="Tasks routed to you for review and routing."
            tasks={assignedByOrganizer.slice(0, 5)}
            isLoading={tasks.isLoading}
            emptyIcon={Inbox}
            emptyTitle="Nothing assigned yet"
            emptyDescription="The organizer has not routed any tasks to you."
            viewAllHref="/lead/assignments"
            viewAllLabel="All assignments"
          />
        </section>

        <section aria-label="Team workload">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-(--ring)" aria-hidden="true" />
                <CardTitle className="font-display">Team workload</CardTitle>
              </div>
              <CardDescription>
                Designers working on your tasks right now.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {designerWorkload.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : workloadRows.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No designers on your tasks"
                  description="Once designers pick up your tasks, their workload shows here."
                />
              ) : (
                <ul className="space-y-3">
                  {workloadRows.map((row) => (
                    <li
                      key={row.designer_id}
                      className="flex min-h-[44px] items-center gap-3"
                    >
                      <Avatar
                        src={row.avatar_url}
                        name={row.full_name}
                        size="sm"
                      />
                      <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-(--fg)">
                        {row.full_name}
                      </p>
                      <span className="shrink-0 text-xs text-(--fg-muted)">
                        <span className="font-bold text-(--fg)">
                          {row.active_count}
                        </span>{" "}
                        active
                      </span>
                      <span
                        className={
                          row.overdue_count > 0
                            ? "shrink-0 text-xs font-semibold text-(--error)"
                            : "shrink-0 text-xs text-(--fg-subtle)"
                        }
                      >
                        {row.overdue_count} overdue
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Recent activity */}
      <section aria-label="Recent activity">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-(--ring)" aria-hidden="true" />
              <CardTitle className="font-display">Recent activity</CardTitle>
            </div>
            <CardDescription>
              Your latest actions across tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : activity.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {activity.map((event, i) => (
                  <motion.li
                    key={event.id}
                    {...fadeUp}
                    transition={{ delay: 0.04 * i, duration: 0.25 }}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-(--fg)">
                        {eventTypeLabel(event.event_type)}
                      </p>
                      {event.task_title && (
                        <p className="truncate text-xs text-(--fg-muted)">
                          {event.task_title}
                          {event.task_code ? ` · ${event.task_code}` : ""}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-(--fg-muted)">
                      {formatDistanceToNow(new Date(event.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Actions you take on tasks will appear here."
              />
            )}
          </CardContent>
        </Card>
      </section>

      <Separator />
    </main>
  );
}
