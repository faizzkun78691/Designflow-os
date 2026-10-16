import { TaskWorkspace } from "../../features/tasks/components/TaskWorkspace";

export default function DesignerMyTasks() {
  return (
    <TaskWorkspace
      title="My Tasks"
      description="Your assigned and claimed tasks — briefs, due dates and checklists."
      detailBase="/designer/tasks"
      mode="list"
      preset={{ assignment: "mine" }}
      defaultView="kanban"
      hideAssignmentFilter
      emptyTitle="Nothing in your queue"
      emptyDescription="Claim a task from the Available board to get started."
    />
  );
}
