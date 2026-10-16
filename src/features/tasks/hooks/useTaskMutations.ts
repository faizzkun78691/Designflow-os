import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../components/ui/toaster";
import {
  acceptAssignment,
  acceptMyAssignment,
  cancelTask,
  declineAssignment,
  publishTask,
  reassignTask,
  toggleChecklistItem,
  updateTask,
  updateTaskStatus,
} from "../services/tasks";
import type {
  ProductionStatus,
  TaskPatch,
} from "../../../types/tasks";

/** Single task mutation with ["tasks"] invalidation + error toast. */
function useTaskMutation<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  successMessage?: string,
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong.");
    },
  });
}

/**
 * All task mutations in one place. Every mutation invalidates the ["tasks"]
 * query family on success and toasts on error. Buttons should disable while
 * their mutation's isPending is true (double-submit prevention).
 */
export function useTaskMutations() {
  const publish = useTaskMutation<void, string>(
    (taskId) => publishTask(taskId),
    "Task published.",
  );
  const accept = useTaskMutation<void, string>((assignmentId) =>
    acceptAssignment(assignmentId),
  );
  const acceptMine = useTaskMutation<void, { taskId: string; userId: string }>(
    ({ taskId, userId }) => acceptMyAssignment(taskId, userId),
    "Assignment accepted.",
  );
  const decline = useTaskMutation<void, { assignmentId: string; reason?: string }>(
    ({ assignmentId, reason }) => declineAssignment(assignmentId, reason),
  );
  const reassign = useTaskMutation<void, { taskId: string; newAssigneeId: string }>(
    ({ taskId, newAssigneeId }) => reassignTask(taskId, newAssigneeId),
    "Task reassigned.",
  );
  const updateStatus = useTaskMutation<
    void,
    { taskId: string; status: ProductionStatus; reason?: string }
  >(
    ({ taskId, status, reason }) => updateTaskStatus(taskId, status, reason),
    "Status updated.",
  );
  const cancel = useTaskMutation<void, { taskId: string; reason?: string }>(
    ({ taskId, reason }) => cancelTask(taskId, reason),
  );
  const toggleChecklist = useTaskMutation<boolean, string>((itemId) =>
    toggleChecklistItem(itemId),
  );
  const patch = useTaskMutation<void, { taskId: string; patch: TaskPatch }>(
    ({ taskId, patch }) => updateTask(taskId, patch),
    "Task updated.",
  );

  return {
    publish,
    accept,
    acceptMine,
    decline,
    reassign,
    updateStatus,
    cancel,
    toggleChecklist,
    patch,
  };
}
