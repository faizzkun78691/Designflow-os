/**
 * Designer Submissions — every version the designer has submitted,
 * across tasks, newest first. Rendered as a version timeline.
 * Latest version per task is highlighted.
 */
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { ExternalLink, Upload, GitBranch } from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useMySubmissions } from "../../features/workflow/hooks";
import { SUBMISSION_STATUS_META } from "../../features/workflow/types";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function DesignerSubmissions() {
  useTaskRealtime();
  const query = useMySubmissions();
  const items = query.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Submissions"
        description="Every version you have submitted, with its review status."
        actions={
          !query.isLoading && !query.isError && items.length > 0 ? (
            <Badge variant="default" className="min-h-[32px] px-3 py-1.5 text-sm">
              <GitBranch className="size-4" aria-hidden="true" />
              {items.length} {items.length === 1 ? "version" : "versions"}
            </Badge>
          ) : undefined
        }
      />

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-(--error)">
              Could not load your submissions.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 min-h-[44px]"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
          <EmptyState
            icon={Upload}
            title="No submissions yet"
            description="Submit your first design from a task in your queue."
          />
        </motion.div>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-(--border) pl-6 sm:pl-8">
          {items.map((s, i) => {
            const meta = SUBMISSION_STATUS_META[s.status];
            return (
              <motion.li
                key={s.id}
                {...fadeUp}
                transition={{ duration: 0.3, delay: Math.min(0.05 * i, 0.3) }}
                className="relative"
              >
                {/* timeline node */}
                <span
                  aria-hidden="true"
                  className={
                    "absolute -left-6 top-5 size-3 -translate-x-[7px] rounded-full border-2 sm:-left-8 " +
                    (s.is_current
                      ? "border-(--ring) bg-(--ring) shadow-glow"
                      : "border-(--border-strong) bg-(--surface)")
                  }
                />
                <Card className={s.is_current ? "border-(--ring)/40" : undefined}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-display text-sm font-semibold text-(--fg)">
                        {s.task_code && (
                          <span className="font-mono text-xs font-medium text-(--ring)">
                            {s.task_code}
                          </span>
                        )}
                        <span className="truncate">
                          {s.task_title ?? "Task"}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-(--fg-subtle)">
                        Version {s.version} ·{" "}
                        {s.submitted_at
                          ? format(
                              new Date(s.submitted_at),
                              "MMM d, yyyy h:mm a",
                            )
                          : "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {s.is_current && <Badge variant="volt">Latest</Badge>}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {s.drive_link && (
                        <Button asChild variant="ghost" size="sm" className="min-h-[44px]">
                          <a
                            href={s.drive_link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Design
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="secondary" size="sm" className="min-h-[44px]">
                        <Link to={`/designer/tasks/${s.task_id}`}>
                          Open task
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
