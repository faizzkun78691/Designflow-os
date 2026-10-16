import { TaskWorkspace } from "../../features/tasks/components/TaskWorkspace";

export default function LeadCreatedTasks() {
  return (
    <TaskWorkspace
      title="My Created Tasks"
      description="Tasks you created — track every one from draft to delivery."
      detailBase="/lead/tasks"
      newTaskPath="/lead/tasks/new"
      mode="list"
      preset={{ createdBy: "me" }}
      emptyTitle="You haven't created any tasks yet"
      emptyDescription="Create your first task to brief a designer."
    />
  );
}
