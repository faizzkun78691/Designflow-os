import { ArrowDown, ArrowUp, RotateCcw, Search } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../utils/cn";
import { PRODUCTION_STATUSES, STATUS_META } from "../../../utils/taskStatus";
import type {
  DeadlineFilter,
  TaskListFilters,
  TaskPriority,
  TaskSortKey,
  TaskVisibility,
} from "../../../types/tasks";

interface TaskFiltersProps {
  value: TaskListFilters;
  onChange: (next: TaskListFilters) => void;
  hideVisibility?: boolean;
  hideAssignment?: boolean;
}

const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent", "critical"];

const DEADLINE_OPTIONS: { value: DeadlineFilter; label: string }[] = [
  { value: "all", label: "Any deadline" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "this_week", label: "Due this week" },
  { value: "no_deadline", label: "No deadline" },
];

const SORT_OPTIONS: { value: TaskSortKey; label: string }[] = [
  { value: "created_at", label: "Newest" },
  { value: "due_date", label: "Deadline" },
  { value: "priority", label: "Priority" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-volt/50 bg-volt/15 text-volt"
          : "border-token bg-surface-2 text-muted hover:border-token-strong hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** Search + status/priority/deadline/assignment filters + sorting for task lists. */
export function TaskFilters({
  value,
  onChange,
  hideVisibility = false,
  hideAssignment = false,
}: TaskFiltersProps) {
  const set = (patch: Partial<TaskListFilters>) =>
    onChange({ ...value, ...patch, page: 0 });

  const toggleStatus = (s: (typeof PRODUCTION_STATUSES)[number]) =>
    set({
      statuses: value.statuses.includes(s)
        ? value.statuses.filter((x) => x !== s)
        : [...value.statuses, s],
    });

  const togglePriority = (p: TaskPriority) =>
    set({
      priorities: value.priorities.includes(p)
        ? value.priorities.filter((x) => x !== p)
        : [...value.priorities, p],
    });

  const reset = () =>
    onChange({
      ...value,
      search: "",
      statuses: [],
      priorities: [],
      visibility: "all",
      deadline: "all",
      assignment: "all",
      sort: "created_at",
      order: "desc",
      page: 0,
    });

  const hasActive =
    value.search.trim() !== "" ||
    value.statuses.length > 0 ||
    value.priorities.length > 0 ||
    value.visibility !== "all" ||
    value.deadline !== "all" ||
    value.assignment !== "all";

  return (
    <div className="space-y-3 rounded-xl border border-token bg-surface p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <Input
            value={value.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search title, description or task code…"
            aria-label="Search tasks"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          {!hideVisibility && (
            <div className="min-w-[8rem]">
              <Label htmlFor="tf-visibility" className="sr-only">
                Visibility
              </Label>
              <Select
                id="tf-visibility"
                value={value.visibility}
                onChange={(e) =>
                  set({ visibility: e.target.value as TaskVisibility | "all" })
                }
                aria-label="Visibility filter"
              >
                <option value="all">All visibility</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Select>
            </div>
          )}
          <div className="min-w-[8rem]">
            <Label htmlFor="tf-deadline" className="sr-only">
              Deadline
            </Label>
            <Select
              id="tf-deadline"
              value={value.deadline}
              onChange={(e) =>
                set({ deadline: e.target.value as DeadlineFilter })
              }
              aria-label="Deadline filter"
            >
              {DEADLINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {!hideAssignment && (
            <div className="min-w-[8rem]">
              <Label htmlFor="tf-assignment" className="sr-only">
                Assignment
              </Label>
              <Select
                id="tf-assignment"
                value={value.assignment}
                onChange={(e) =>
                  set({
                    assignment: e.target.value as TaskListFilters["assignment"],
                  })
                }
                aria-label="Assignment filter"
              >
                <option value="all">All tasks</option>
                <option value="mine">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </Select>
            </div>
          )}
          <div className="min-w-[8rem]">
            <Label htmlFor="tf-sort" className="sr-only">
              Sort by
            </Label>
            <Select
              id="tf-sort"
              value={value.sort}
              onChange={(e) => set({ sort: e.target.value as TaskSortKey })}
              aria-label="Sort tasks"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              set({ order: value.order === "asc" ? "desc" : "asc" })
            }
            aria-label={value.order === "asc" ? "Sort ascending" : "Sort descending"}
            title={value.order === "asc" ? "Ascending" : "Descending"}
          >
            {value.order === "asc" ? (
              <ArrowUp className="size-4" aria-hidden="true" />
            ) : (
              <ArrowDown className="size-4" aria-hidden="true" />
            )}
          </Button>
          {hasActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-subtle">Status:</span>
        {PRODUCTION_STATUSES.map((s) => (
          <Chip
            key={s}
            active={value.statuses.includes(s)}
            onClick={() => toggleStatus(s)}
          >
            {STATUS_META[s].label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-subtle">Priority:</span>
        {PRIORITIES.map((p) => (
          <Chip
            key={p}
            active={value.priorities.includes(p)}
            onClick={() => togglePriority(p)}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
