import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import { fetchTaskDetail } from "../services/tasks";

/** Full task detail aggregate: task, brief, references, checklist, assignments, events. */
export function useTaskDetail(taskId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => fetchTaskDetail(taskId!, user?.id ?? null),
    enabled: !!taskId,
  });
}
