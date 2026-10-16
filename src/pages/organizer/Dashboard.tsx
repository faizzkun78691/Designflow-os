import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Globe,
  Inbox,
  Megaphone,
  Play,
  RotateCcw,
  Rocket,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { buttonVariants } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Avatar } from "../../components/ui/avatar";
import { PageHeader } from "../../components/ui/page-header";
import { StatCard } from "../../components/ui/stat-card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Badge } from "../../components/ui/badge";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { BrandLockup } from "../../components/brand/BrandLockup";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganizerDashboard } from "../../features/organizer/hooks/useOrganizerDashboard";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useHandoffs } from "../../features/workflow/hooks";
import {
  ACTIVE_STATUSES,
  PIPELINE_STAGES,
  TASK_STATUS,
  eventTypeLabel,
  isOverdue,
  productionStatusLabel,
  type DashboardTask,
  type DesignerWorkloadRow,
} from "../../features/dashboard/types";
import { WorkflowStats } from "../../features/workflow/components/WorkflowStats";

/* ------------------------------------------------------------------ */
/* Client-side aggregation — every number derives from live queries.   */
/* ------------------------------------------------------------------ */

interface OrganizerStats {
  total: number;
  active: number;
  unclaimed: number;
  inProgress: number;
  pendingLeadReview: number;
  pendingOrganizerReview: number;
  revisions: number;
  readyToPublish: number;
  published: number;
  overdue: number;
}

const REVISION_STATUSES: readonly string[] = [
  TASK_STATUS.IN_REVISION,
  TASK_STATUS.REVISION_AWAITING_ORGANIZER,
  TASK_STATUS.REVISION_AWAITING_LEAD,
  TASK_STATUS.REVISION_REQUIRED_DESIGNER,
];

function computeStats(tasks: DashboardTask[]): OrganizerStats {
  const now = Date.now();
  const has = (list: readonly string[]) => (t: DashboardTask) =>
    (list as readonly string[]).includes(t.production_status);
  return {
    total: tasks.length,
    active: tasks.filter(has(ACTIVE_STATUSES)).length,
    unclaimed: tasks.filter(
      (t) =>
        t.production_status === TASK_STATUS.AVAILABLE && t.claimed_by === null,
    ).length,
    inProgress: tasks.filter(
      (t) =>
        t.production_status === TASK_STATUS.CLAIMED ||
        t.production_status === TASK_STATUS.IN_PROGRESS,
    ).length,
    pendingLeadReview: tasks.filter(
      (t) => t.production_status === TASK_STATUS.SUBMITTED_LEAD_REVIEW,
    ).length,
    pendingOrganizerReview: tasks.filter(
      (t) => t.production_status === TASK_STATUS.SUBMITTED_ORGANIZER_REVIEW,
    ).length,
    revisions: tasks.filter(has(REVISION_STATUSES)).length,
    readyToPublish: tasks.filter(
      (t) =>
        t.production_status === TASK_STATUS.READY ||
        t.production_status === TASK_STATUS.READY_FOR_PUBLISHING,
    ).length,
    published: tasks.filter(
      (t) => t.production_status === TASK_STATUS.PUBLISHED,
    ).length,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
  };
}

function computePipeline(tasks: DashboardTask[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    counts.set(
      task.production_status,
      (counts.get(task.production_status) ?? 0) + 1,
    );
  }
  const stages = PIPELINE_STAGES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
  // Surface any unexpected statuses instead of hiding them.
  for (const [status, count] of counts) {
    if (!PIPELINE_STAGES.includes(status)) stages.push({ status, count });
  }
  return stages;
}

/* ------------------------------------------------------------------ */

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-3"
    >
      <p className="text-sm text-(--error)">
        Some dashboard data could not be loaded.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Retry
      </button>
    </div>
  );
}

interface KpiDef {
  title: string;
  icon: LucideIcon;
  value: (s: OrganizerStats) => number;
  hint?: string;
  /** Nearest relevant workspace for this metric. */
  to: string;
  /** True when the value needs attention (renders an alert dot). */
  alert?: (s: OrganizerStats) => boolean;
}

export default function OrganizerDashboard() {
  useTaskRealtime(true);
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { tasks, recentEvents, employees } = useOrganizerDashboard();
  const handoffs = useHandoffs();

  const taskList = useMemo(() => tasks.data ?? [], [tasks.data]);
  const stats = useMemo(() => computeStats(taskList), [taskList]);
  const pipeline = useMemo(() => computePipeline(taskList), [taskList]);
  const events = useMemo(() => recentEvents.data ?? [], [recentEvents.data]);

  /** Scheduled publishing handoffs (real data). */
  const scheduledCount = useMemo(
    () =>
      (handoffs.data ?? []).filter(
        (h) => h.status === "scheduled" && h.is_current,
      ).length,
    [handoffs.data],
  );

  /** Designer workload: active + overdue counts per designer, client-side. */
  const designerWorkload = useMemo((): DesignerWorkloadRow[] => {
    const designers = (employees.data ?? []).filter(
      (e) => e.role === "designer",
    );
    const now = Date.now();
    return designers.map((designer) => {
      const mine = taskList.filter(
        (t) =>
          t.assigned_designer_id === designer.id ||
          t.claimed_by === designer.id,
      );
      const active = mine.filter((t) =>
        ACTIVE_STATUSES.includes(t.production_status),
      );
      return {
        designer_id: designer.id,
        full_name: designer.full_name,
        avatar_url: designer.avatar_url,
        active_count: active.length,
        overdue_count: active.filter((t) => isOverdue(t, now)).length,
      };
    });
  }, [employees.data, taskList]);

  const statsLoading = tasks.isLoading;
  const loadError =
    tasks.isError || recentEvents.isError || employees.isError;

  function retryAll() {
    void queryClient.invalidateQueries({
      predicate: (q) =>
        ["organizer", "employees"].includes(String(q.queryKey[0])),
    });
  }

  const firstName = (profile?.full_name ?? "Organizer").split(" ")[0];
  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");

  const kpis: KpiDef[] = [
    { title: "Total tasks", icon: ClipboardList, value: (s) => s.total, to: "/organizer/all-tasks" },
    { title: "Active tasks", icon: Play, value: (s) => s.active, to: "/organizer/all-tasks" },
    {
      title: "Unclaimed",
      icon: Inbox,
      value: (s) => s.unclaimed,
      hint: "Available, nobody claimed yet",
      to: "/organizer/all-tasks",
      alert: (s) => s.unclaimed > 0,
    },
    { title: "In progress", icon: Activity, value: (s) => s.inProgress, to: "/organizer/all-tasks" },
    {
      title: "Pending lead review",
      icon: FileSearch,
      value: (s) => s.pendingLeadReview,
      hint: "Submitted designs",
      to: "/organizer/all-tasks",
      alert: (s) => s.pendingLeadReview > 0,
    },
    {
      title: "Pending organizer review",
      icon: ShieldCheck,
      value: (s) => s.pendingOrganizerReview,
      hint: "Lead-approved designs",
      to: "/organizer/approvals",
      alert: (s) => s.pendingOrganizerReview > 0,
    },
    {
      title: "Revisions required",
      icon: RotateCcw,
      value: (s) => s.revisions,
      to: "/organizer/all-tasks",
    },
    {
      title: "Ready to publish",
      icon: Rocket,
      value: (s) => s.readyToPublish,
      to: "/organizer/publishing",
    },
    {
      title: "Scheduled",
      icon: CalendarClock,
      value: () => scheduledCount,
      hint: "Publishing handoffs",
      to: "/organizer/publishing",
    },
    {
      title: "Published",
      icon: Globe,
      value: (s) => s.published,
      to: "/organizer/publishing",
    },
    {
      title: "Overdue",
      icon: AlertTriangle,
      value: (s) => s.overdue,
      hint: "Past due date, still active",
      to: "/organizer/all-tasks",
      alert: (s) => s.overdue > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Brand hero — personalized welcome */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.4 }}
        aria-label="Welcome"
        className="relative overflow-hidden rounded-2xl border border-(--border) bg-gradient-to-br from-midnight via-aubergine to-royal"
      >
        <WaveBackground opacity={0.55} />
        <div className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2.5">
            <BrandLockup compact />
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, {firstName}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-lavender/90">
              {todayLabel} — here is the live operational picture of your
              design workspace. Every number below comes from real workspace
              data.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/organizer/tasks/new"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              <ClipboardList className="mr-1 size-4" aria-hidden="true" />
              New task
            </Link>
            <Link
              to="/organizer/approvals"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-token-strong text-white hover:bg-surface-2",
              )}
            >
              <ShieldCheck className="mr-1 size-4" aria-hidden="true" />
              Review queue
            </Link>
          </div>
        </div>
      </motion.section>

      <PageHeader
        title="Command Center"
        description="Organization-wide overview. Select a metric to open its workspace."
      />

      {loadError && <ErrorBanner onRetry={retryAll} />}

      {/* KPI grid — every value from a live query, each links somewhere useful */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <Link
            key={kpi.title}
            to={kpi.to}
            className="group relative rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            aria-label={`${kpi.title}: ${kpi.value(stats)} — open ${kpi.title.toLowerCase()} workspace`}
          >
            <StatCard
              title={kpi.title}
              value={kpi.value(stats)}
              hint={kpi.hint}
              icon={kpi.icon}
              loading={statsLoading}
              className="transition-colors group-hover:border-(--border-strong)"
            />
            {!statsLoading && kpi.alert?.(stats) && (
              <span
                className="absolute right-3 top-3 size-2.5 rounded-full bg-(--warning)"
                aria-hidden="true"
              />
            )}
          </Link>
        ))}
      </motion.div>

      {/* Task pipeline — live counts by production_status */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <Card>
          <CardHeader>
            <CardTitle>Task pipeline</CardTitle>
            <CardDescription>
              Live task counts across workflow stages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.isLoading ? (
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-32 rounded-xl" />
                ))}
              </div>
            ) : (
              <div
                className="flex flex-wrap gap-2"
                aria-label="Task pipeline stages"
              >
                {pipeline.map((stage) => (
                  <span
                    key={stage.status}
                    className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface-2) px-3.5 py-2.5"
                  >
                    <span className="text-sm text-(--fg-muted)">
                      {productionStatusLabel(stage.status)}
                    </span>
                    <span className="font-display text-sm font-bold text-(--fg) tabular-nums">
                      {stage.count}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <WorkflowStats role="organizer" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity — latest task events with task titles */}
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Latest task events across the organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentEvents.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Task activity will appear here once work begins."
                />
              ) : (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-3 border-b border-(--border) pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-(--fg)">
                          {eventTypeLabel(event.event_type)}
                        </p>
                        <p className="truncate text-xs text-(--fg-subtle)">
                          {event.task_title ?? "Task"}
                          {event.task_code ? ` · ${event.task_code}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-(--fg-subtle)">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Designer workload — computed from the live tasks select */}
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Designer workload</CardTitle>
                  <CardDescription>
                    Active and overdue tasks per designer.
                  </CardDescription>
                </div>
                <Link
                  to="/organizer/team"
                  className="inline-flex items-center gap-1 text-sm font-medium text-(--ring) hover:underline"
                >
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {employees.isLoading || tasks.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : designerWorkload.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No designers yet"
                  description="Invite designers to see their workload here."
                />
              ) : (
                <ul className="space-y-3">
                  {designerWorkload.map((row) => (
                    <li
                      key={row.designer_id}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        src={row.avatar_url}
                        name={row.full_name}
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-(--fg)">
                        {row.full_name}
                      </p>
                      <span className="shrink-0 text-xs text-(--fg-subtle)">
                        <span className="font-semibold text-(--fg) tabular-nums">
                          {row.active_count}
                        </span>{" "}
                        active
                      </span>
                      <Badge
                        variant={row.overdue_count > 0 ? "danger" : "muted"}
                      >
                        {row.overdue_count} overdue
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common organizer workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/organizer/team"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                <UserPlus className="mr-1 size-4" aria-hidden="true" />
                Invite employee
              </Link>
              <Link
                to="/organizer/all-tasks"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <ClipboardList className="mr-1 size-4" aria-hidden="true" />
                Browse tasks
              </Link>
              <Link
                to="/organizer/analytics"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <BarChart3 className="mr-1 size-4" aria-hidden="true" />
                View analytics
              </Link>
              <Link
                to="/organizer/publishing"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Megaphone className="mr-1 size-4" aria-hidden="true" />
                Publishing tracker
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status legend — never color alone */}
      <p className="flex items-center gap-2 text-xs text-(--fg-subtle)">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Amber dots mark metrics that currently need attention.
      </p>
    </div>
  );
}
