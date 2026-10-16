import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarX2,
  Inbox,
  RefreshCcw,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/skeleton";
import type { Bottlenecks, BottleneckItem } from "../types";

export interface BottleneckListProps {
  data: Bottlenecks | undefined;
  isLoading: boolean;
  error: Error | null;
}

interface Category {
  key: keyof Bottlenecks;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "text-(--warning)" | "text-(--error)" | "text-(--info)" | "text-(--ring)";
  detail: (item: BottleneckItem) => string | null;
}

const ALL_TASKS_LINK = "/organizer/all-tasks";

const CATEGORIES: Category[] = [
  {
    key: "stale_reviews",
    title: "Stale reviews",
    description: "Submissions waiting too long for approval",
    icon: Inbox,
    tone: "text-(--warning)",
    detail: (i) =>
      i.days_waiting !== null
        ? `${i.days_waiting} day${i.days_waiting === 1 ? "" : "s"} waiting`
        : null,
  },
  {
    key: "overdue_submissions",
    title: "Overdue submissions",
    description: "Tasks past their due date without a submission",
    icon: CalendarX2,
    tone: "text-(--error)",
    detail: (i) => (i.due_date ? `Due ${i.due_date}` : null),
  },
  {
    key: "revision_loops",
    title: "Revision loops",
    description: "Tasks stuck in repeated revision rounds",
    icon: RefreshCcw,
    tone: "text-(--info)",
    detail: (i) =>
      i.revision_count !== null
        ? `${i.revision_count} revision round${i.revision_count === 1 ? "" : "s"}`
        : null,
  },
  {
    key: "unpublished_approved",
    title: "Unpublished approved",
    description: "Approved designs still waiting to go live",
    icon: Send,
    tone: "text-(--ring)",
    detail: (i) =>
      i.days_waiting !== null
        ? `${i.days_waiting} day${i.days_waiting === 1 ? "" : "s"} waiting to publish${
            i.platform ? ` · ${i.platform}` : ""
          }`
        : i.platform,
  },
  {
    key: "unclaimed_urgent",
    title: "Unclaimed urgent",
    description: "Urgent tasks nobody has picked up yet",
    icon: AlertTriangle,
    tone: "text-(--error)",
    detail: () => "Needs a designer",
  },
];

function formatTaskCode(item: BottleneckItem): string {
  return item.task_code ?? "Task";
}

/**
 * Renders detect_bottlenecks() output as grouped alert cards with counts,
 * task codes, and links back to the organizer task list.
 */
export function BottleneckList({ data, isLoading, error }: BottleneckListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Bottleneck detection unavailable"
        description="We could not load bottleneck alerts right now. The command center numbers above are unaffected."
      />
    );
  }

  const total = CATEGORIES.reduce(
    (sum, c) => sum + (data?.[c.key]?.length ?? 0),
    0,
  );

  if (!data || total === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No bottlenecks detected"
        description="Every queue is moving. Stale reviews, overdue work, revision loops and unpublished approvals will surface here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {CATEGORIES.map((cat) => {
        const items = data[cat.key];
        if (items.length === 0) return null;
        const Icon = cat.icon;
        return (
          <Card key={cat.key} className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--surface-2)">
                  <Icon className={`size-5 ${cat.tone}`} aria-hidden="true" />
                </span>
                <div>
                  <CardTitle className="text-sm">{cat.title}</CardTitle>
                  <p className="mt-0.5 text-xs text-(--fg-subtle)">
                    {cat.description}
                  </p>
                </div>
              </div>
              <Badge variant="muted" className="shrink-0 tabular-nums">
                {items.length}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <ul className="space-y-1.5">
                {items.slice(0, 6).map((item) => {
                  const detail = cat.detail(item);
                  return (
                    <li
                      key={item.task_id || formatTaskCode(item)}
                      className="flex items-center justify-between gap-2 rounded-lg bg-(--surface-2) px-3 py-2"
                    >
                      <span className="truncate text-sm font-medium text-(--fg)">
                        {formatTaskCode(item)}
                      </span>
                      {detail && (
                        <span className="shrink-0 text-xs text-(--fg-subtle)">
                          {detail}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {items.length > 6 && (
                <p className="text-xs text-(--fg-subtle)">
                  +{items.length - 6} more
                </p>
              )}
              <Link
                to={ALL_TASKS_LINK}
                className="inline-flex items-center gap-1 text-xs font-medium text-(--ring) transition-colors hover:text-(--fg)"
              >
                View in task list
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
