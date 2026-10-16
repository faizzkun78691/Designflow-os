import { TaskWorkspace } from "../../features/tasks/components/TaskWorkspace";

export default function LeadAssignments() {
  return (
    <TaskWorkspace
      title="Organizer Assignments"
      description="Tasks the organizer routed to you — brief them out to your design team."
      detailBase="/lead/tasks"
      mode="list"
      preset={{ assignLeadId: "me" }}
      hideAssignmentFilter
      emptyTitle="No assignments right now"
      emptyDescription="Tasks the organizer routes to you will appear here."
    />
  );
}
