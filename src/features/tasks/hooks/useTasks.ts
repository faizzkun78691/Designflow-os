import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import { listTasks } from "../services/tasks";
import type { TaskListFilters } from "../../../types/tasks";

/** Paginated, filterable task list for the current user (RLS-scoped). */
export function useTasks(filters: TaskListFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", "list", filters, user?.id],
    queryFn: () => listTasks(filters, user!.id),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}
