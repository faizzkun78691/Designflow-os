import { Link } from "react-router-dom";
import { CalendarClock, CircleDashed } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import {
  PRIORITY_META,
  STATUS_META,
  VISIBILITY_META,
} from "../../../utils/taskStatus";
import { timeRemaining } from "../../../utils/taskDates";
import { cn } from "../../../utils/cn";
import type {
  ProductionStatus,
  TaskPriority,
  TaskVisibility,
} from "../../../types/tasks";

export interface TaskCardData {
  id: string;
  task_code: string | null;
  title: string;
  production_status: ProductionStatus;
  priority: TaskPriority;
  due_date: string | null;
  visibility?: TaskVisibility | null;
  claimed_by?: string | null;
  assignee_id?: string | null;
  /** Resolved display name of the claimant/assignee, when known. */
  person_name?: string | null;
}

interface TaskCardProps {
  task: TaskCardData;
  detailBase: string;
  className?: string;
  /**
   * Marks the card as an *available* (claimable) task rather than an owned
   * one: dashed brand border + an "Available" badge so the two are visually
   * distinct at a glance.
   */
  available?: boolean;
}

/** Elegant task card: code, title, badges, deadline + time remaining, ownership. */
export function TaskCard({ task, detailBase, className, available = false }: TaskCardProps) {
  const status = STATUS_META[task.production_status];
  const priority = PRIORITY_META[task.priority];
  const remaining = timeRemaining(task.due_date);
  const claimed = !!task.claimed_by || !!task.assignee_id;

  return (
    <Link
      to={`${detailBase}/${task.id}`}
      className={cn(
        "group flex min-h-[44px] flex-col gap-3 rounded-xl border bg-(--surface) p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-(--ring)/50",
        available
          ? "border-dashed border-(--ring)/50"
          : "border-(--border)",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold tracking-wide text-(--ring)">
          {task.task_code ?? "DF-????"}
        </span>
        <div className="flex items-center gap-1.5">
          {available && <Badge variant="volt">Available</Badge>}
          {task.visibility && (
            <Badge variant={VISIBILITY_META[task.visibility].badge}>
              {VISIBILITY_META[task.visibility].label}
            </Badge>
          )}
        </div>
      </div>

      <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-semibold leading-snug text-(--fg) group-hover:text-(--ring)">
        {task.title}
      </h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={status.badge}>{status.label}</Badge>
        <Badge variant={priority.badge}>{priority.label}</Badge>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-(--border) pt-3 text-xs">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5",
            !remaining && "text-(--fg-subtle)",
            remaining?.overdue && "font-medium text-(--error)",
            remaining && !remaining.overdue && remaining.urgent && "text-(--warning)",
            remaining && !remaining.overdue && !remaining.urgent && "text-(--fg-muted)",
          )}
        >
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {remaining ? remaining.label : "No deadline"}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-(--fg-subtle)">
          <CircleDashed className="size-3.5" aria-hidden="true" />
          <span className="max-w-[10rem] truncate">
            {task.person_name ??
              (claimed ? "Assigned" : "Unassigned")}
          </span>
        </span>
      </div>
    </Link>
  );
}
