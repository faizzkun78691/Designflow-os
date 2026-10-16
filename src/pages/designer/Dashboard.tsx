import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format, startOfMonth } from "date-fns";
import {
  Brush,
  Globe,
  BadgeCheck,
  Palette,
  LineChart,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
  Layers,
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
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Separator } from "../../components/ui/separator";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useQueryClient } from "@tanstack/react-query";
import { useDesignerDashboard } from "../../features/designer/hooks/useDesignerDashboard";
import { useDesignerStats, useDesignerScore } from "../../features/analytics/hooks";
import { ScoreBars } from "../../features/analytics/components/ScoreBars";
import { useAuth } from "../../contexts/AuthContext";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import {
  isActiveStatus,
  isOverdue,
  productionStatusLabel,
  productionStatusVariant,
  type TaskBoardRow,
} from "../../features/dashboard/types";
import type { DesignerTaskRow } from "../../features/designer/services/dashboard";
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

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const date = format(new Date(dueDate), "MMM d, yyyy");
  if (days < 0) return `Overdue · was due ${date}`;
  if (days === 0) return `Due today · ${date}`;
  if (days === 1) return `Due tomorrow · ${date}`;
  return `Due in ${days} days · ${date}`;
}

function OwnedTaskRow({ task, index }: { task: DesignerTaskRow; index: number }) {
  const overdue = isOverdue(task);
  return (
    <motion.li
      {...fadeUp}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl border border-(--border) bg-(--surface-2) px-4 py-3"
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
        <p
          className={
            overdue
              ? "mt-0.5 text-xs font-medium text-(--error)"
              : "mt-0.5 text-xs text-(--fg-muted)"
          }
        >
          {dueLabel(task.due_date)}
        </p>
      </div>
      <Badge variant={productionStatusVariant(task.production_status)}>
        {productionStatusLabel(task.production_status)}
      </Badge>
    </motion.li>
  );
}

function AvailableTaskRow({
  task,
  index,
}: {
  task: TaskBoardRow;
  index: number;
}) {
  return (
    <motion.li
      {...fadeUp}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="flex min-h-[44px] items-center justify-between gap-4 rounded-xl border border-dashed border-(--ring)/50 bg-(--ring)/5 px-4 py-3"
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
          {task.priority ? ` · ${task.priority} priority` : ""}
        </p>
      </div>
      <Badge variant="volt">Available</Badge>
    </motion.li>
  );
}

/** Personal analytics — the designer's own data only (server-scoped RPCs). */
function DesignerAnalyticsSection() {
  const { user } = useAuth();
  const stats = useDesignerStats();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const score = useDesignerScore(user?.id ?? null, monthStart, today);
  const s = stats.data;
  const loading = stats.isLoading;

  const cards = [
    { title: "Active tasks", value: s?.my_active_tasks ?? 0, icon: Brush },
    { title: "Approved designs", value: s?.approved_designs ?? 0, icon: BadgeCheck },
    { title: "Published designs", value: s?.published_designs ?? 0, icon: Globe },
    { title: "Revision requests", value: s?.revision_requests ?? 0, icon: AlertTriangle },
    {
      title: "On-time rate",
      value: s?.on_time_rate == null ? "—" : `${Math.round(s.on_time_rate * 100)}%`,
      icon: CalendarClock,
    },
    {
      title: "Avg revisions",
      value: s?.avg_revisions == null ? "—" : s.avg_revisions.toFixed(1),
      icon: LineChart,
    },
  ];

  return (
    <section aria-label="My analytics">
      <div className="mb-3 flex items-center gap-2">
        <LineChart className="size-4 text-(--ring)" aria-hidden="true" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-(--fg-muted)">
          My analytics · this month
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
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
                loading={loading}
              />
            </motion.div>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-sm">Performance score</CardTitle>
            <CardDescription>
              Weighted 0–100 · this month · your data only
            </CardDescription>
          </CardHeader>
          <CardContent>
            {score.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : score.data?.eligible && score.data.total_score != null ? (
              <div className="space-y-3">
                <p className="font-display text-3xl font-bold text-(--ring) tabular-nums">
                  {score.data.total_score}
                </p>
                <ScoreBars score={score.data} compact />
                <Button asChild variant="ghost" size="sm" className="min-h-[44px] px-0">
                  <Link to="/designer/performance">
                    Full breakdown
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-(--fg-muted)">
                Insufficient data — at least 3 submissions this month are
                needed for a score.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default function DesignerDashboard() {
  useTaskRealtime(true);
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { myTasks, completedTasks, workload, availableTasks } =
    useDesignerDashboard();

  const ownedTasks = useMemo(
    () =>
      (myTasks.data ?? []).filter((t: DesignerTaskRow) =>
        isActiveStatus(t.production_status),
      ),
    [myTasks.data],
  );

  /** Upcoming deadlines: owned active tasks with a due date, soonest first. */
  const upcomingDeadlines = useMemo(
    () =>
      ownedTasks
        .filter((t) => t.due_date)
        .slice()
        .sort(
          (a, b) =>
            new Date(a.due_date as string).getTime() -
            new Date(b.due_date as string).getTime(),
        )
        .slice(0, 5),
    [ownedTasks],
  );

  const available = useMemo(() => availableTasks.data ?? [], [availableTasks.data]);
  const completedCount = completedTasks.data?.length ?? 0;

  const statsLoading =
    myTasks.isLoading || availableTasks.isLoading || workload.isLoading;

  const loadError =
    myTasks.isError ||
    completedTasks.isError ||
    workload.isError ||
    availableTasks.isError;

  function retryAll() {
    void queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]) === "designer",
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
            AWS Community Karachi · Designer
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {firstName(profile?.full_name)}.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/75">
              {TODAY_LABEL} — pick up a brief, push your craft, and climb the
              leaderboard.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="min-h-[48px] font-display">
              <Link to="/designer/available">
                <Globe className="size-4" aria-hidden="true" />
                Browse available tasks
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="min-h-[48px] border-token-strong bg-white/10 font-display text-white hover:bg-white/20"
            >
              <Link to="/designer/my-tasks">
                <Layers className="size-4" aria-hidden="true" />
                My task board
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
                title="My active tasks"
                value={workload.data?.active_count ?? ownedTasks.length}
                icon={Brush}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
              <StatCard
                title="Available public tasks"
                value={available.length}
                hint="Open briefs you can claim"
                icon={Globe}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
              <StatCard
                title="Overdue"
                value={workload.data?.overdue_count ?? 0}
                hint="Past due date, still active"
                icon={AlertTriangle}
              />
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
              <StatCard
                title="Completed designs"
                value={completedCount}
                icon={BadgeCheck}
              />
            </motion.div>
          </div>
        )}
      </section>

      <WorkflowStats role="designer" />

      <DesignerAnalyticsSection />

      {/* Owned vs available — clearly separated */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="My tasks">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display">My tasks</CardTitle>
                  <CardDescription>
                    Work assigned to you or claimed by you.
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="min-h-[44px] shrink-0">
                  <Link to="/designer/my-tasks">
                    Board
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myTasks.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : ownedTasks.length > 0 ? (
                <ul className="space-y-3">
                  {ownedTasks.slice(0, 5).map((task, i) => (
                    <OwnedTaskRow key={task.id} task={task} index={i} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Palette}
                  title="No active tasks"
                  description="Claim a public task from the board or wait for an assignment."
                />
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-label="Available public tasks">
          <Card className="h-full border-dashed border-(--ring)/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display">Available board</CardTitle>
                  <CardDescription>
                    Open public briefs — not yours until you claim one.
                  </CardDescription>
                </div>
                <Badge variant="volt">{available.length} open</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {availableTasks.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : available.length > 0 ? (
                <ul className="space-y-3">
                  {available.slice(0, 5).map((task, i) => (
                    <AvailableTaskRow key={task.id} task={task} index={i} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Globe}
                  title="No public tasks available"
                  description="New open briefs will appear here."
                />
              )}
              {available.length > 0 && (
                <Button asChild variant="secondary" className="mt-4 min-h-[44px] w-full font-display">
                  <Link to="/designer/available">
                    Open the available board
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Upcoming deadlines */}
      <section aria-label="Upcoming deadlines">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock
                className="size-5 text-(--ring)"
                aria-hidden="true"
              />
              <CardTitle className="font-display">Upcoming deadlines</CardTitle>
            </div>
            <CardDescription>
              Your owned tasks with the nearest due dates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myTasks.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : upcomingDeadlines.length > 0 ? (
              <ul className="space-y-3">
                {upcomingDeadlines.map((task, i) => (
                  <OwnedTaskRow key={task.id} task={task} index={i} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming deadlines"
                description="Your owned tasks with due dates will be listed here."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Performance — live, links to full page */}
      <section aria-label="My performance">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--surface-2) text-(--ring)"
              aria-hidden="true"
            >
              <LineChart className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-(--fg)">
                My performance
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-(--fg-muted)">
                Turnaround, quality, and output trends for your work — computed
                from your real submissions.
              </p>
            </div>
            <Button asChild className="min-h-[44px] shrink-0 font-display">
              <Link to="/designer/performance">
                View performance
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />
    </main>
  );
}
