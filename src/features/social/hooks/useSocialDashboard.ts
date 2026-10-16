/** React Query hooks for the social dashboard. Query keys are arrays. */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import {
  fetchPublishingStatusCounts,
  fetchReadyToPublish,
  fetchRecentActivity,
} from "../services/dashboard";

export function useSocialDashboard() {
  const { user } = useAuth();
  const enabled = user !== null;

  const statusCounts = useQuery({
    queryKey: ["social", "dashboard", "status-counts"],
    queryFn: fetchPublishingStatusCounts,
    enabled,
  });

  const readyToPublish = useQuery({
    queryKey: ["social", "dashboard", "ready-to-publish"],
    queryFn: fetchReadyToPublish,
    enabled,
  });

  const recentActivity = useQuery({
    queryKey: ["social", "dashboard", "recent-activity"],
    queryFn: fetchRecentActivity,
    enabled,
  });

  return { statusCounts, readyToPublish, recentActivity };
}
