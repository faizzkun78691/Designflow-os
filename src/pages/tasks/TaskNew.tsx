import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageHeader } from "../../components/ui/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { WaveBackground } from "../../components/brand/WaveBackground";
import { useAuth } from "../../contexts/AuthContext";
import { TaskFormWizard } from "../../features/tasks/components/TaskFormWizard";

/**
 * Role-aware task creation page.
 * Organizers create private tasks only; team leads choose public/private.
 * Expected routes (wired by the coordinator): /organizer/tasks/new, /lead/tasks/new.
 */
export default function TaskNew() {
  const { role } = useAuth();

  const detailBase =
    role === "organizer"
      ? "/organizer/tasks"
      : role === "team_lead"
        ? "/lead/tasks"
        : null;

  if (!detailBase) {
    return (
      <div className="space-y-5">
        <PageHeader title="New task" />
        <EmptyState
          icon={ShieldAlert}
          title="Not permitted"
          description="Only organizers and team leads can create tasks."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-3xl border-token bg-surface">
        <WaveBackground variant="corner" opacity={0.5} />
        <div className="relative space-y-2 p-6 sm:p-8">
          <p className="inline-flex items-center gap-1.5 rounded-full border-token bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
            <Sparkles className="size-3.5 text-volt" aria-hidden="true" />
            {role === "organizer" ? "Organizer workspace" : "Team lead workspace"}
          </p>
          <PageHeader
            title="Create a new task"
            description={
              role === "organizer"
                ? "Create a private task and assign it to a designer or route it to a team lead."
                : "Create a task — publish it for designers to claim, or keep it private for someone specific."
            }
            actions={
              <Button asChild variant="secondary" className="gap-2">
                <Link to={role === "organizer" ? "/organizer/all-tasks" : "/lead/created"}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to tasks
                </Link>
              </Button>
            }
          />
        </div>
      </div>
      <TaskFormWizard detailBase={detailBase} />
    </div>
  );
}
