/** React Query hooks for the organizer dashboard. Query keys are arrays. */
import { useQuery } from "@tanstack/react-query";
import { listEmployees } from "../../../services/profiles";
import {
  fetchOrganizerRecentEvents,
  fetchOrganizerTasks,
} from "../services/dashboard";

export function useOrganizerDashboard() {
  const tasks = useQuery({
    queryKey: ["organizer", "dashboard", "tasks"],
    queryFn: fetchOrganizerTasks,
  });

  const recentEvents = useQuery({
    queryKey: ["organizer", "dashboard", "recent-events"],
    queryFn: () => fetchOrganizerRecentEvents(8),
  });

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: listEmployees,
  });

  return { tasks, recentEvents, employees };
}
