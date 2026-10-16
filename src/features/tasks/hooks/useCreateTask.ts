import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../components/ui/toaster";
import { createTask } from "../services/tasks";
import type { CreateTaskPayload, CreateTaskResult } from "../../../types/tasks";

/** Creates a task via the create_task RPC. Callers handle success (navigation);
 *  errors are toasted here. isPending guards against double-submit. */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation<CreateTaskResult, Error, CreateTaskPayload>({
    mutationFn: createTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => {
      toast.error(err.message || "Could not create the task.");
    },
  });
}
