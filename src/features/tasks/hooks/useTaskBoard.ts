import { useQuery } from "@tanstack/react-query";
import { getTaskBoard } from "../services/tasks";

/** Task board rows via the get_task_board() RPC. */
export function useTaskBoard(enabled = true) {
  return useQuery({
    queryKey: ["tasks", "board"],
    queryFn: getTaskBoard,
    enabled,
  });
}
