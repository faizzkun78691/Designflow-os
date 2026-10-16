/** React Query hooks for the team-lead dashboard. Query keys are arrays. */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import {
  fetchLeadDesignerWorkload,
  fetchLeadRecentActivity,
  fetchLeadTasks,
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

export function useLeadDashboard() {
  const uid = useUid();
  const enabled = uid !== null;

  /** Created by me + assigned to me by the organizer (one real query). */
  const tasks = useQuery({
    queryKey: ["lead", "dashboard", "tasks", uid],
    queryFn: guarded(uid, fetchLeadTasks),
    enabled,
  });

  /** Designer workload on my tasks (real query). */
  const designerWorkload = useQuery({
    queryKey: ["lead", "dashboard", "designer-workload", uid],
    queryFn: guarded(uid, fetchLeadDesignerWorkload),
    enabled,
  });

  /** My latest task events (real query). */
  const recentActivity = useQuery({
    queryKey: ["lead", "dashboard", "recent-activity", uid],
    queryFn: guarded(uid, (id) => fetchLeadRecentActivity(id, 6)),
    enabled,
  });

  return { tasks, designerWorkload, recentActivity };
}
