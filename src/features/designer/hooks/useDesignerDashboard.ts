/** React Query hooks for the designer dashboard. Query keys are arrays. */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import {
  fetchAvailableBoardTasks,
  fetchDesignerWorkload,
  fetchMyCompletedTasks,
  fetchMyDesignerTasks,
} from "../services/dashboard";

function useUid(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

function guarded<T>(uid: string | null, fn: (id: string) => Promise<T>) {
  return async (): Promise<T> => {
    if (!uid) throw new Error("You must be signed in.");
    return fn(uid);
  };
}

export function useDesignerDashboard() {
  const uid = useUid();
  const enabled = uid !== null;

  /** My active tasks (assigned to me or claimed by me). */
  const myTasks = useQuery({
    queryKey: ["designer", "dashboard", "my-tasks", uid],
    queryFn: guarded(uid, fetchMyDesignerTasks),
    enabled,
  });

  /** My completed designs. */
  const completedTasks = useQuery({
    queryKey: ["designer", "dashboard", "completed-tasks", uid],
    queryFn: guarded(uid, fetchMyCompletedTasks),
    enabled,
  });

  /** Workload summary: active / overdue / upcoming. */
  const workload = useQuery({
    queryKey: ["designer", "dashboard", "workload", uid],
    queryFn: guarded(uid, fetchDesignerWorkload),
    enabled,
  });

  // Available public tasks are the same for every designer; keyed without uid.
  const availableTasks = useQuery({
    queryKey: ["designer", "dashboard", "available-tasks"],
    queryFn: fetchAvailableBoardTasks,
    enabled,
  });

  return { myTasks, completedTasks, workload, availableTasks };
}
