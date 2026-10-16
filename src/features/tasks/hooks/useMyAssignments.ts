import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import { fetchMyAssignments } from "../services/tasks";

/** Assignment inbox rows for the signed-in user. */
export function useMyAssignments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", "my-assignments", user?.id],
    queryFn: () => fetchMyAssignments(user!.id),
    enabled: !!user,
  });
}
