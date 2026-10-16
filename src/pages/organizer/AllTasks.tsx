import { TaskWorkspace } from "../../features/tasks/components/TaskWorkspace";

export default function AllTasks() {
  return (
    <TaskWorkspace
      title="All Tasks"
      description="Every task in the workspace — filter, sort, or move work along the board."
      detailBase="/organizer/tasks"
      newTaskPath="/organizer/tasks/new"
      mode="list"
    />
  );
}
