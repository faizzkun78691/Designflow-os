/**
 * Publishing Studio — the Social Media Manager's publishing workspace.
 * Brand: AWS Community Karachi. Hero with signature waves, themed metric
 * tiles, and queue tabs by publishing status.
 *
 * NOTE (RLS caveat): SMM can only SELECT publishing_records rows with
 * status='ready' AND is_current=true. Non-ready tabs correctly return []
 * for SMM until the backend policy is widened. Tab badges show the true
 * counts from get_publishing_metrics() so the state of the pipeline is
 * still visible.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  Inbox,
  ListOrdered,
  MessageSquareWarning,
  Send,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import {
  usePublishingMetrics,
  usePublishingRecords,
} from "../../features/publishing/hooks";
import {
  PublishingCard,
  type TaskMeta,
} from "../../features/publishing/components/PublishingCard";
import { useSmmQueue } from "../../features/workflow/hooks";
import type {
  PublishingRecord,
  PublishingTab,
} from "../../features/publishing/types";

const TABS: { id: PublishingTab; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "scheduled", label: "Scheduled" },
  { id: "pending", label: "Pending" },
  { id: "changes_requested", label: "Changes" },
  { id: "published", label: "Published" },
  { id: "all", label: "All" },
];

function TabBadge({ count }: { count: number }) {
  return (
    <Badge
      variant="default"
      className="ml-1.5 bg-[var(--primary)]/15 text-[var(--primary)] tabular-nums"
    >
      {count}
    </Badge>
  );
}

function QueueTabContent({
  records,
  loading,
  error,
  metaById,
  metaByTask,
}: {
  records: PublishingRecord[] | undefined;
  loading: boolean;
  error: Error | null;
  metaById: Map<string, TaskMeta>;
  metaByTask: Map<string, TaskMeta>;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load the queue"
        description={error.message}
      />
    );
  }
  if (!records || records.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing here"
        description="No records visible in this state."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {records.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
        >
          <PublishingCard
            record={r}
            meta={metaById.get(r.id) ?? metaByTask.get(r.task_id) ?? null}
          />
        </motion.div>
      ))}
    </div>
  );
}

const METRIC_DEFS = [
  { key: "ready" as const, title: "Ready", icon: Sparkles, hint: "Approved, awaiting action" },
  { key: "scheduled" as const, title: "Scheduled", icon: CalendarClock, hint: "Queued for a future time" },
  { key: "pending" as const, title: "Pending", icon: Hourglass, hint: "Held before scheduling" },
  { key: "overdue" as const, title: "Overdue", icon: AlertTriangle, hint: "Scheduled time passed", alert: true },
  { key: "changes_requested" as const, title: "Changes requested", icon: MessageSquareWarning, hint: "Awaiting revised version" },
  { key: "published_today" as const, title: "Published today", icon: Send, hint: "Went live today" },
  { key: "published_week" as const, title: "Published this week", icon: CheckCircle2, hint: "Last 7 days" },
  { key: "published_month" as const, title: "Published this month", icon: ListOrdered, hint: "Calendar month" },
  { key: "total_published" as const, title: "Total published", icon: Clock, hint: "All time" },
];

export default function Studio() {
  useTaskRealtime();
  const [tab, setTab] = useState<PublishingTab>("ready");

  const metrics = usePublishingMetrics();
  const queue = usePublishingRecords(tab);
  const smmQueue = useSmmQueue();

  // Map publishing record id / task id → task meta for card labels.
  const { metaById, metaByTask } = useMemo(() => {
    const byId = new Map<string, TaskMeta>();
    const byTask = new Map<string, TaskMeta>();
    for (const item of smmQueue.data ?? []) {
      const meta: TaskMeta = {
        task_code: item.task_code,
        title: item.title,
      };
      // handoff_id corresponds to the publishing record id in the SMM queue.
      byId.set(item.handoff_id, meta);
      if (item.task_id) byTask.set(item.task_id, meta);
    }
    return { metaById: byId, metaByTask: byTask };
  }, [smmQueue.data]);

  const m = metrics.data;
  const loading = metrics.isLoading;

  const tabCount = (t: PublishingTab): number => {
    if (!m) return 0;
    switch (t) {
      case "ready":
        return m.ready;
      case "scheduled":
        return m.scheduled;
      case "pending":
        return m.pending;
      case "changes_requested":
        return m.changes_requested;
      case "published":
        return m.total_published;
      case "all":
        return (
          m.ready +
          m.scheduled +
          m.pending +
          m.changes_requested +
          m.total_published
        );
      default:
        return 0;
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <section
        aria-label="Publishing Studio"
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#100B2B] via-[#1B0D43] to-[#351078] px-6 py-10 sm:px-10 sm:py-12"
      >
        <WaveBackground opacity={0.9} />
        <div className="relative">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-[#C8A6FF]">
            Publishing pipeline
          </p>
          <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Publishing Studio
          </h1>
          <p className="mt-3 max-w-lg text-sm text-[#E9DEFF]/80 sm:text-base">
            Approved designs through scheduled and published posts — one
            pipeline, every platform.
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section aria-label="Pipeline metrics">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {METRIC_DEFS.map((d) => (
              <Skeleton key={d.key} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {METRIC_DEFS.map((d, i) => {
              const Icon = d.icon;
              const value = m?.[d.key] ?? 0;
              const alert = "alert" in d && d.alert && value > 0;
              return (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
                >
                  <Card
                    className={
                      alert
                        ? "border-[var(--error)]/40 bg-[var(--error)]/5"
                        : ""
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display truncate text-xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                          {d.title}
                        </p>
                        <Icon
                          className={
                            alert
                              ? "size-4 shrink-0 text-[var(--error)]"
                              : "size-4 shrink-0 text-[var(--primary)]"
                          }
                          aria-hidden="true"
                        />
                      </div>
                      <p
                        className={`font-display mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums ${
                          alert ? "text-[var(--error)]" : "text-[var(--fg)]"
                        }`}
                      >
                        {value.toLocaleString()}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--fg-subtle)]">
                        {d.hint}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Queue tabs */}
      <section aria-label="Publishing queue">
        <Tabs value={tab} onValueChange={(v) => setTab(v as PublishingTab)}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max min-w-full gap-1 sm:w-auto">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="font-display">
                  {t.label}
                  <TabBadge count={tabCount(t.id)} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-5">
              {tab === t.id && (
                <QueueTabContent
                  records={queue.data}
                  loading={queue.isLoading}
                  error={queue.error as Error | null}
                  metaById={metaById}
                  metaByTask={metaByTask}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <p className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
        Need a different view?
        <Link
          to="/social/calendar"
          className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
        >
          Open the publishing calendar
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </main>
  );
}
