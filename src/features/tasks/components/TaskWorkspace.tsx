import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarX2,
  KanbanSquare,
  List as ListIcon,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { PageHeader } from "../../../components/ui/page-header";
import { Skeleton } from "../../../components/ui/skeleton";
import { EmptyState } from "../../../components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Textarea } from "../../../components/ui/textarea";
import { Label } from "../../../components/ui/label";
import { toast } from "../../../components/ui/toaster";
import { useAuth } from "../../../contexts/AuthContext";
import { canPerformTransition } from "../../../utils/taskStatus";
import {
  useClaimTask,
  useTaskBoard,
  useTaskMutations,
  useTasks,
} from "../hooks";
import { TaskCard } from "./TaskCard";
import { TaskFilters } from "./TaskFilters";
import { TaskKanban, type KanbanTask } from "./TaskKanban";
import { cn } from "../../../utils/cn";
import type {
  ProductionStatus,
  Task,
  TaskBoardRow,
  TaskListFilters,
} from "../../../types/tasks";
import { DEFAULT_TASK_FILTERS } from "../../../types/tasks";

interface TaskWorkspaceProps {
  title: string;
  description?: string;
  /** Base path for task detail links, e.g. "/organizer/tasks". */
  detailBase: string;
  /** When set, a "New task" button links here. */
  newTaskPath?: string;
  mode: "list" | "board";
  /** Forced filters merged over the defaults (e.g. { createdBy: "me" }). */
  preset?: Partial<TaskListFilters>;
  defaultView?: "list" | "kanban";
  hideVisibilityFilter?: boolean;
  hideAssignmentFilter?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * When true, list-mode cards render with the "available" treatment
   * (dashed brand border + Available badge) to distinguish claimable
   * tasks from owned ones. Visual only.
   */
  availableCards?: boolean;
}

function toKanbanTask(t: Task | TaskBoardRow): KanbanTask {
  return {
    id: t.id,
    task_code: t.task_code,
    title: t.title,
    production_status: t.production_status,
    priority: t.priority,
    due_date: t.due_date,
    visibility: t.visibility ?? "private",
    created_by: t.created_by ?? null,
    assignee_id: t.assignee_id ?? null,
    claimed_by: t.claimed_by,
    claimant_name: ("claimant_name" in t ? t.claimant_name : null) ?? null,
  };
}

/**
 * List + kanban workspace for tasks. List mode is server-filtered and
 * paginated (keepPreviousData); board mode renders the get_task_board() RPC
 * as a kanban with client-side search.
 */
export function TaskWorkspace({
  title,
  description,
  detailBase,
  newTaskPath,
  mode,
  preset,
  defaultView = "list",
  hideVisibilityFilter = false,
  hideAssignmentFilter = false,
  emptyTitle = "No tasks found",
  emptyDescription = "Try adjusting the filters, or create a new task to get started.",
  availableCards = false,
}: TaskWorkspaceProps) {
  const { role, user } = useAuth();
  const [filters, setFilters] = useState<TaskListFilters>({
    ...DEFAULT_TASK_FILTERS,
    ...preset,
  });
  const [view, setView] = useState<"list" | "kanban">(
    mode === "board" ? "kanban" : defaultView,
  );
  const [boardSearch, setBoardSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<KanbanTask | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const listQuery = useTasks(filters);
  const boardQuery = useTaskBoard(mode === "board");
  const mutations = useTaskMutations();
  const claim = useClaimTask();

  const transitionBusy =
    mutations.publish.isPending ||
    mutations.acceptMine.isPending ||
    mutations.updateStatus.isPending ||
    mutations.cancel.isPending ||
    claim.isPending;

  // Reset to the first page whenever filters (other than page) change.
  const applyFilters = (next: TaskListFilters) => setFilters(next);

  const canDrop = (task: KanbanTask, to: ProductionStatus): boolean =>
    canPerformTransition({
      from: task.production_status,
      to,
      role,
      userId: user?.id ?? null,
      task: {
        created_by: task.created_by,
        assignee_id: task.assignee_id,
        claimed_by: task.claimed_by,
        visibility: task.visibility,
      },
    });

  const handleDrop = (task: KanbanTask, to: ProductionStatus) => {
    if (!user) return;
    if (to === "cancelled") {
      setCancelReason("");
      setCancelTarget(task);
      return;
    }
    if (to === "available") {
      mutations.publish.mutate(task.id);
      return;
    }
    if (to === "assigned") {
      // Designer claiming a public task from the board.
      claim.mutate(task.id);
      return;
    }
    if (to === "accepted") {
      mutations.acceptMine.mutate({ taskId: task.id, userId: user.id });
      return;
    }
    if (to === "in_progress") {
      mutations.updateStatus.mutate({ taskId: task.id, status: "in_progress" });
      return;
    }
    toast.error("That move isn't supported from the board.");
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    mutations.cancel.mutate(
      { taskId: cancelTarget.id, reason: cancelReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Task cancelled.");
          setCancelTarget(null);
        },
      },
    );
  };

  const boardTasks = useMemo(() => {
    const rows = boardQuery.data ?? [];
    const q = boardSearch.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            (r.task_code ?? "").toLowerCase().includes(q),
        )
      : rows;
    return filtered.map(toKanbanTask);
  }, [boardQuery.data, boardSearch]);

  const listTasks = useMemo(
    () => (listQuery.data?.items ?? []).map(toKanbanTask),
    [listQuery.data],
  );

  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const rangeStart = total === 0 ? 0 : filters.page * filters.pageSize + 1;
  const rangeEnd = Math.min(total, (filters.page + 1) * filters.pageSize);

  useEffect(() => {
    if (filters.page > pageCount - 1)
      setFilters((f) => ({ ...f, page: Math.max(0, pageCount - 1) }));
  }, [filters.page, pageCount]);

  const headerActions = (
    <>
      {mode === "list" && (
        <div
          className="inline-flex items-center gap-1 rounded-xl border border-(--border) bg-(--surface) p-1"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              view === "list"
                ? "bg-(--primary) font-display font-semibold text-(--primary-fg)"
                : "text-(--fg-muted) hover:text-(--fg)",
            )}
          >
            <ListIcon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            aria-pressed={view === "kanban"}
            className={cn(
              "inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              view === "kanban"
                ? "bg-(--primary) font-display font-semibold text-(--primary-fg)"
                : "text-(--fg-muted) hover:text-(--fg)",
            )}
          >
            <KanbanSquare className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Board</span>
          </button>
        </div>
      )}
      {newTaskPath && (
        <Button asChild>
          <Link to={newTaskPath} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            New task
          </Link>
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={headerActions} />

      {mode === "list" ? (
        <TaskFilters
          value={filters}
          onChange={applyFilters}
          hideVisibility={hideVisibilityFilter}
          hideAssignment={hideAssignmentFilter}
        />
      ) : (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--fg-subtle)"
            aria-hidden="true"
          />
          <Input
            value={boardSearch}
            onChange={(e) => setBoardSearch(e.target.value)}
            placeholder="Search the board…"
            aria-label="Search the board"
            className="pl-9"
          />
        </div>
      )}

      {mode === "list" && view === "list" && (
        <>
          {listQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <EmptyState
              icon={CalendarX2}
              title="Could not load tasks"
              description="Something went wrong while fetching tasks."
              action={
                <Button variant="secondary" onClick={() => void listQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : listTasks.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title={emptyTitle}
              description={emptyDescription}
              action={
                newTaskPath ? (
                  <Button asChild>
                    <Link to={newTaskPath} className="gap-2">
                      <Plus className="size-4" aria-hidden="true" />
                      New task
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(listQuery.data?.items ?? []).map((task) => (
                <TaskCard
                  key={task.id}
                  detailBase={detailBase}
                  available={availableCards}
                  task={{
                    id: task.id,
                    task_code: task.task_code,
                    title: task.title,
                    production_status: task.production_status,
                    priority: task.priority,
                    due_date: task.due_date,
                    visibility: task.visibility,
                    claimed_by: task.claimed_by,
                    assignee_id: task.assignee_id,
                  }}
                />
              ))}
            </div>
          )}

          {!listQuery.isLoading && !listQuery.isError && total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-(--fg-subtle)" aria-live="polite">
                Showing {rangeStart}–{rangeEnd} of {total} tasks
                {listQuery.isFetching && " · updating…"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={filters.page === 0 || listQuery.isFetching}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: Math.max(0, f.page - 1) }))
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-(--fg-subtle)">
                  Page {filters.page + 1} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={filters.page >= pageCount - 1 || listQuery.isFetching}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {(mode === "board" || (mode === "list" && view === "kanban")) && (
        <>
          {mode === "board" && boardQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : mode === "board" && boardQuery.isError ? (
            <EmptyState
              icon={CalendarX2}
              title="Could not load the board"
              description="Something went wrong while fetching the task board."
              action={
                <Button variant="secondary" onClick={() => void boardQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <TaskKanban
              tasks={mode === "board" ? boardTasks : listTasks}
              detailBase={detailBase}
              canDrop={canDrop}
              onDrop={handleDrop}
              disabled={transitionBusy}
              currentUserId={user?.id ?? null}
            />
          )}
          {mode === "list" && view === "kanban" && listQuery.isLoading && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          )}
          {mode === "list" && view === "kanban" && listQuery.isError && (
            <EmptyState
              icon={CalendarX2}
              title="Could not load tasks"
              description="Something went wrong while fetching tasks."
              action={
                <Button variant="secondary" onClick={() => void listQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          )}
        </>
      )}

      {/* Cancel-from-board dialog (reason is optional but encouraged). */}
      <Dialog open={cancelTarget !== null} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel task</DialogTitle>
            <DialogDescription>
              {cancelTarget?.task_code} — {cancelTarget?.title}. This moves the
              task to Cancelled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="board-cancel-reason">Reason (optional)</Label>
            <Textarea
              id="board-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this task being cancelled?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelTarget(null)}
              disabled={mutations.cancel.isPending}
            >
              Keep task
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCancel}
              disabled={mutations.cancel.isPending}
            >
              {mutations.cancel.isPending ? "Cancelling…" : "Cancel task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
