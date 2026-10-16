/**
 * Social Media Manager dashboard — Publishing Studio home.
 *
 * Brand: AWS Community Karachi. Hero with signature purple waves,
 * semantic theme tokens, Montserrat headings / Poppins body.
 */
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Send,
  Clock,
  Hourglass,
  BadgeCheck,
  CalendarDays,
  Activity,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useSocialDashboard } from "../../features/social/hooks/useSocialDashboard";
import type { PublishingRecordRow } from "../../features/social/services/dashboard";
import { useAuth } from "../../contexts/AuthContext";

function labelize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const TODAY_LABEL = format(new Date(), "EEEE, MMMM d, yyyy");

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const METRICS = [
  {
    key: "ready" as const,
    title: "Ready to publish",
    icon: Send,
    hint: "Approved designs awaiting action",
  },
  {
    key: "scheduled" as const,
    title: "Scheduled",
    icon: Clock,
    hint: "Queued for a future time",
  },
  {
    key: "pending" as const,
    title: "Pending",
    icon: Hourglass,
    hint: "Held before scheduling",
  },
  {
    key: "published" as const,
    title: "Published",
    icon: BadgeCheck,
    hint: "Live across platforms",
  },
];

function MetricTile({
  title,
  value,
  hint,
  icon: Icon,
  index,
}: {
  title: string;
  value: number;
  hint: string;
  icon: typeof Send;
  index: number;
}) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.35, delay: 0.05 * index }}
    >
      <Card className="group h-full transition-shadow hover:shadow-[var(--shadow-pop)]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                {title}
              </p>
              <p className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--fg)] tabular-nums">
                {value}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--fg-subtle)]">
                {hint}
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--secondary-fg)] transition-transform group-hover:scale-105">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ReadyRow({
  record,
  index,
}: {
  record: PublishingRecordRow;
  index: number;
}) {
  return (
    <motion.li
      {...fadeUp}
      transition={{ delay: 0.04 * index, duration: 0.3 }}
    >
      <Link
        to={record.id ? `/social/studio/${record.id}` : "/social/studio"}
        className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-elev)]"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--fg)]">
            {record.task_title ?? "Untitled design"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
            Added {format(new Date(record.created_at), "MMM d, yyyy")}
          </p>
        </div>
        <Badge variant="success" className="shrink-0">
          {labelize(record.status)}
        </Badge>
      </Link>
    </motion.li>
  );
}

export default function SocialDashboard() {
  const { statusCounts, readyToPublish, recentActivity } = useSocialDashboard();
  const { profile } = useAuth();

  const statsLoading = statusCounts.isLoading;
  const counts = statusCounts.data;

  const loadError =
    statusCounts.isError || readyToPublish.isError || recentActivity.isError;

  function retryAll() {
    void statusCounts.refetch();
    void readyToPublish.refetch();
    void recentActivity.refetch();
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <section
        aria-label="Publishing Studio welcome"
        className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#100B2B] via-[#1B0D43] to-[#351078] px-6 py-10 sm:px-10 sm:py-14"
      >
        <WaveBackground opacity={0.9} />
        <div className="relative">
          <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-[#C8A6FF]">
            AWS Community Karachi
          </p>
          <h1 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Publishing Studio
          </h1>
          <p className="mt-3 max-w-lg text-sm text-[#E9DEFF]/80 sm:text-base">
            Assalam-o-Alaikum, {firstName}. Approved designs, scheduled posts
            and the live publishing pipeline — {TODAY_LABEL}.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/social/studio">
                Open Studio <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/social/calendar">
                <CalendarDays className="size-4" aria-hidden="true" />
                Calendar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-[var(--error)]/40 bg-[var(--error)]/10 px-4 py-3"
        >
          <p className="text-sm text-[var(--fg)]">
            Some dashboard data could not be loaded.
          </p>
          <Button variant="outline" size="sm" onClick={retryAll}>
            Retry
          </Button>
        </div>
      )}

      {/* Metric cards */}
      <section aria-label="Key metrics">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <MetricTile
                key={m.key}
                title={m.title}
                value={counts?.[m.key] ?? 0}
                hint={m.hint}
                icon={m.icon}
                index={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* Ready + recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Ready to publish">
          <Card className="h-full">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-[var(--fg)]">
                  Ready to publish
                </h2>
                <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                  Approved designs waiting to go live.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/social/ready">
                  View all <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="p-4 sm:p-6">
              {readyToPublish.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : readyToPublish.data && readyToPublish.data.length > 0 ? (
                <ul className="space-y-3">
                  {readyToPublish.data.slice(0, 5).map((record, i) => (
                    <ReadyRow key={record.id} record={record} index={i} />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Send}
                  title="Nothing ready to publish"
                  description="Approved designs will appear here."
                />
              )}
            </div>
          </Card>
        </section>

        <section aria-label="Recent activity">
          <Card className="h-full">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-6 py-4">
              <Activity
                className="size-5 text-[var(--primary)]"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-[var(--fg)]">
                  Recent activity
                </h2>
                <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                  The latest activity across the workspace.
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {recentActivity.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 rounded-xl" />
                  ))}
                </div>
              ) : recentActivity.data && recentActivity.data.length > 0 ? (
                <ul className="divide-y divide-[var(--border)]">
                  {recentActivity.data.map((event, i) => (
                    <motion.li
                      key={event.id}
                      {...fadeUp}
                      transition={{ delay: 0.04 * i, duration: 0.25 }}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <p className="min-w-0 truncate text-sm text-[var(--fg)]">
                        {labelize(event.event_type)}
                      </p>
                      <p className="shrink-0 text-xs text-[var(--fg-subtle)]">
                        {format(new Date(event.created_at), "MMM d, h:mm a")}
                      </p>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="Workspace activity will appear here."
                />
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
