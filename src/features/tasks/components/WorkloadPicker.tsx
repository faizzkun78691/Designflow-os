import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { Avatar } from "../../../components/ui/avatar";
import { Badge } from "../../../components/ui/badge";
import { listEmployees } from "../../../services/profiles";
import { getDesignerWorkload } from "../services/tasks";
import { cn } from "../../../utils/cn";
import type { TaskMemberOption } from "../../../types/tasks";

interface WorkloadPickerProps {
  value: string;
  onChange: (id: string) => void;
  memberRole: "designer" | "team_lead";
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/** Selectable member list showing designation + live active/overdue workload.
 *  Inactive members are blocked from selection. */
export function WorkloadPicker({
  value,
  onChange,
  memberRole,
  label,
  hint,
  error,
  required = false,
}: WorkloadPickerProps) {
  const {
    data: employees,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: listEmployees,
    staleTime: 60_000,
  });

  const members: TaskMemberOption[] = (employees ?? [])
    .filter((e) => e.role === memberRole)
    .map((e) => ({
      id: e.id,
      full_name: e.full_name,
      email: e.email,
      designation: e.designation,
      avatar_url: e.avatar_url,
      is_active: e.is_active,
      role: e.role,
    }));

  return (
    <fieldset>
      <legend className="text-sm font-medium text-muted">
        {label}
        {required && (
          <span className="text-red-400" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </legend>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}

      <div className="mt-2 space-y-2" role="radiogroup" aria-label={label}>
        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-token bg-surface p-4 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading team members…
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <span>Could not load team members.</span>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 font-medium text-red-200 underline-offset-4 hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
        {!isLoading && !isError && members.length === 0 && (
          <p className="rounded-xl border border-dashed border-token bg-surface/50 px-4 py-6 text-center text-sm text-subtle">
            No {memberRole === "designer" ? "designers" : "team leads"} found.
          </p>
        )}
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            selected={value === m.id}
            onSelect={() => onChange(m.id)}
          />
        ))}
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-2 text-xs text-subtle underline-offset-4 hover:text-white hover:underline"
        >
          Clear selection
        </button>
      )}
      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}

function MemberRow({
  member,
  selected,
  onSelect,
}: {
  member: TaskMemberOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: workload } = useQuery({
    queryKey: ["workload", member.id],
    queryFn: () => getDesignerWorkload(member.id),
    staleTime: 60_000,
    enabled: member.is_active,
  });

  const blocked = !member.is_active;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={blocked}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        blocked && "cursor-not-allowed opacity-50",
        !blocked &&
          (selected
            ? "border-volt/60 bg-volt/10"
            : "border-token bg-surface hover:border-token-strong"),
      )}
    >
      <Avatar src={member.avatar_url} name={member.full_name} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {member.full_name}
          </span>
          {blocked && <Badge variant="muted">Inactive</Badge>}
        </span>
        <span className="block truncate text-xs text-subtle">
          {member.designation ?? member.email}
        </span>
      </span>
      {!blocked && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs">
          {workload ? (
            <>
              <Badge variant="default" title="Active tasks">
                {workload.active_count} active
              </Badge>
              {workload.overdue_count > 0 && (
                <Badge variant="danger" title="Overdue tasks">
                  {workload.overdue_count} overdue
                </Badge>
              )}
            </>
          ) : (
            <span className="text-subtle">…</span>
          )}
        </span>
      )}
    </button>
  );
}
