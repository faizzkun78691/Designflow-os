import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, GripVertical } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { toast } from "../../../components/ui/toaster";
import {
  PRODUCTION_STATUSES,
  STATUS_META,
} from "../../../utils/taskStatus";
import { timeRemaining } from "../../../utils/taskDates";
import { cn } from "../../../utils/cn";
import type {
  ProductionStatus,
  TaskPriority,
  TaskVisibility,
} from "../../../types/tasks";

export interface KanbanTask {
  id: string;
  task_code: string | null;
  title: string;
  production_status: ProductionStatus;
  priority: TaskPriority;
  due_date: string | null;
  visibility: TaskVisibility;
  created_by: string | null;
  assignee_id: string | null;
  claimed_by: string | null;
  claimant_name?: string | null;
}

interface TaskKanbanProps {
  tasks: KanbanTask[];
  detailBase: string;
  /** Client-side mirror: may this task be dropped on `to`? */
  canDrop: (task: KanbanTask, to: ProductionStatus) => boolean;
  onDrop: (task: KanbanTask, to: ProductionStatus) => void;
  /** While a transition mutation is pending, drops are ignored. */
  disabled?: boolean;
  /** Current user id: cards claimed by someone else are not openable. */
  currentUserId?: string | null;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-surface-2",
  normal: "bg-sky-400",
  high: "bg-amber-400",
  urgent: "bg-orange-500",
  critical: "bg-red-500",
};

/**
 * Kanban board over the six production statuses with native HTML5
 * drag-and-drop. A drop is only accepted when `canDrop` allows the
 * transition for the current user; otherwise a toast explains the rejection.
 * (Touch devices: use the task detail page actions instead — HTML5 DnD is
 * mouse/keyboard only.)
 */
export function TaskKanban({
  tasks,
  detailBase,
  canDrop,
  onDrop,
  disabled = false,
  currentUserId = null,
}: TaskKanbanProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ProductionStatus | null>(null);

  const byStatus = new Map<ProductionStatus, KanbanTask[]>(
    PRODUCTION_STATUSES.map((s) => [s, []]),
  );
  for (const t of tasks) byStatus.get(t.production_status)?.push(t);

  const handleDrop = (task: KanbanTask, to: ProductionStatus) => {
    setDraggingId(null);
    setOverColumn(null);
    if (disabled) return;
    if (task.production_status === to) return;
    if (!canDrop(task, to)) {
      toast.error(
        `This task can't move to “${STATUS_META[to].label}”.`,
      );
      return;
    }
    onDrop(task, to);
  };

  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      aria-label="Task board"
    >
      {PRODUCTION_STATUSES.map((status) => {
        const items = byStatus.get(status) ?? [];
        const isOver = overColumn === status;
        return (
          <section
            key={status}
            aria-label={`${STATUS_META[status].label} column`}
            onDragOver={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOverColumn(status);
            }}
            onDragLeave={() => setOverColumn((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              const task = tasks.find((t) => t.id === id);
              if (task) handleDrop(task, status);
            }}
            className={cn(
              "flex min-h-[12rem] flex-col rounded-xl border bg-(--surface)/60 p-2.5 transition-colors",
              isOver ? "border-(--ring)/60 bg-(--ring)/5" : "border-(--border)",
            )}
          >
            <header className="flex items-center justify-between px-1.5 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-(--fg-muted)">
                {STATUS_META[status].label}
              </h3>
              <Badge variant="muted">{items.length}</Badge>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  detailBase={detailBase}
                  currentUserId={currentUserId}
                  dragging={draggingId === task.id}
                  onDragStart={() => setDraggingId(task.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                />
              ))}
              {items.length === 0 && (
                <p className="rounded-lg border border-dashed border-(--border) px-3 py-6 text-center text-xs text-(--fg-subtle)">
                  Drop here
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  detailBase,
  currentUserId,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: KanbanTask;
  detailBase: string;
  currentUserId?: string | null;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const navigate = useNavigate();
  const remaining = timeRemaining(task.due_date);
  // A task claimed by someone else shows as a minimal read-only record:
  // the viewer is not authorized for its detail page (RLS), so the card
  // is not clickable and not draggable.
  const claimedByOther =
    !!task.claimed_by && task.claimed_by !== currentUserId;

  return (
    <article
      draggable={!claimedByOther}
      onDragStart={(e) => {
        if (claimedByOther) return;
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={claimedByOther ? undefined : () => navigate(`${detailBase}/${task.id}`)}
      onKeyDown={(e) => {
        if (!claimedByOther && e.key === "Enter") navigate(`${detailBase}/${task.id}`);
      }}
      tabIndex={claimedByOther ? -1 : 0}
      role={claimedByOther ? undefined : "button"}
      aria-label={
        claimedByOther
          ? `${task.task_code ?? task.title} (claimed by ${task.claimant_name ?? "another designer"})`
          : `Open task ${task.task_code ?? task.title}`
      }
      aria-disabled={claimedByOther || undefined}
      className={cn(
        "rounded-lg border border-(--border) bg-(--surface) p-3 shadow-card transition-colors active:cursor-grabbing",
        claimedByOther
          ? "cursor-default opacity-80"
          : "cursor-grab hover:border-(--ring)/40",
        dragging && "border-(--ring)/60 opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-(--ring)">
          {task.task_code ?? "DF-????"}
        </span>
        <GripVertical
          className="size-3.5 shrink-0 text-(--fg-subtle)"
          aria-hidden="true"
        />
      </div>
      <h4 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-(--fg)">
        {task.title}
      </h4>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-(--fg-subtle)">
          <span
            className={cn("size-2 rounded-full", PRIORITY_DOT[task.priority])}
            aria-hidden="true"
          />
          <span className="capitalize">{task.priority}</span>
        </span>
        {remaining ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              remaining.overdue
                ? "font-medium text-(--error)"
                : remaining.urgent
                  ? "text-(--warning)"
                  : "text-(--fg-subtle)",
            )}
          >
            <CalendarClock className="size-3" aria-hidden="true" />
            {remaining.label}
          </span>
        ) : (
          <span className="text-(--fg-subtle)">No deadline</span>
        )}
      </div>
      {task.claimant_name && (
        <p className="mt-1.5 truncate text-[11px] text-(--fg-subtle)">
          Claimed by {task.claimant_name}
        </p>
      )}
    </article>
  );
}
