import { TaskWorkspace } from "../../features/tasks/components/TaskWorkspace";

export default function DesignerAvailableTasks() {
  return (
    <TaskWorkspace
      title="Available Tasks"
      description="Public tasks you can claim — open a card or drag it to claim."
      detailBase="/designer/tasks"
      mode="board"
      availableCards
      emptyTitle="No public tasks right now"
      emptyDescription="New open briefs will appear here as soon as they are published."
    />
  );
}
