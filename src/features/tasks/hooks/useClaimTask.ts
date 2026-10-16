import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../../components/ui/toaster";
import { claimTask } from "../services/tasks";

/** Claims a public, available task. The already-claimed race is mapped to a
 *  friendly message by the service layer. */
export function useClaimTask() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: claimTask,
    onSuccess: () => {
      toast.success("Task claimed. It's now in your queue.");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => {
      toast.error(err.message || "Could not claim the task.");
      // Refresh so a lost claim race shows the task's real state.
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
