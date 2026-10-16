/**
 * Phase 3 workflow stats — real Supabase counters per role, for embedding
 * in the four dashboards. Every number comes from an RLS-scoped query or
 * a scoped RPC; nothing is mocked.
 */
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ClipboardCheck,
  FileCheck2,
  Hourglass,
  Inbox,
  Megaphone,
  PenLine,
  Send,
} from "lucide-react";
import { StatCard } from "../../../components/ui/stat-card";
import { supabase } from "../../../integrations/supabase/client";
import type { AppRole } from "../../../types";
import {
  useHandoffs,
  useLeadQueue,
  useMySubmissions,
  useOpenRevisions,
  useOrganizerQueue,
  useSmmQueue,
} from "../hooks";

function useTaskStatusCounts(statuses: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["workflow", "taskStatusCounts", [...statuses].sort()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .in("production_status", statuses);
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
  });
}

interface StatDef {
  title: string;
  value: number;
  hint?: string;
  icon: typeof Inbox;
  loading: boolean;
}

export function WorkflowStats({ role }: { role: AppRole | null }) {
  const leadQueue = useLeadQueue(role === "team_lead");
  const orgQueue = useOrganizerQueue(role === "organizer");
  const smmQueue = useSmmQueue(role === "social_media_manager");
  const revisions = useOpenRevisions();
  const handoffs = useHandoffs();
  const mySubs = useMySubmissions();

  const leadReviewCount = useTaskStatusCounts(
    ["submitted_lead_review"],
    role === "organizer",
  );

  if (!role) return null;

  let stats: StatDef[] = [];
  let heading = "Workflow";

  if (role === "organizer") {
    const ready = (handoffs.data ?? []).filter(
      (h) => h.is_current && h.status === "ready",
    ).length;
    stats = [
      {
        title: "Awaiting my approval",
        value: orgQueue.data?.length ?? 0,
        hint: "Organizer review queue",
        icon: ClipboardCheck,
        loading: orgQueue.isLoading,
      },
      {
        title: "In Team Lead review",
        value: leadReviewCount.data ?? 0,
        hint: "Across all teams",
        icon: Hourglass,
        loading: leadReviewCount.isLoading,
      },
      {
        title: "Open revisions",
        value: revisions.data?.length ?? 0,
        hint: "Needs routing",
        icon: PenLine,
        loading: revisions.isLoading,
      },
      {
        title: "Ready for publishing",
        value: ready,
        hint: "Approved handoffs",
        icon: Megaphone,
        loading: handoffs.isLoading,
      },
    ];
  } else if (role === "team_lead") {
    const ready = (handoffs.data ?? []).filter(
      (h) => h.is_current && h.status === "ready",
    ).length;
    stats = [
      {
        title: "Awaiting my review",
        value: leadQueue.data?.length ?? 0,
        hint: "Submissions to decide",
        icon: Inbox,
        loading: leadQueue.isLoading,
      },
      {
        title: "Open revisions",
        value: revisions.data?.length ?? 0,
        hint: "On my tasks",
        icon: PenLine,
        loading: revisions.isLoading,
      },
      {
        title: "Ready for publishing",
        value: ready,
        hint: "My tasks approved",
        icon: Megaphone,
        loading: handoffs.isLoading,
      },
    ];
  } else if (role === "designer") {
    const subs = mySubs.data ?? [];
    const awaiting = subs.filter(
      (s) => s.status === "submitted" || s.status === "lead_approved",
    ).length;
    const approved = subs.filter(
      (s) => s.status === "organizer_approved",
    ).length;
    stats = [
      {
        title: "Awaiting review",
        value: awaiting,
        hint: "My submitted versions",
        icon: Hourglass,
        loading: mySubs.isLoading,
      },
      {
        title: "Revisions required",
        value: revisions.data?.length ?? 0,
        hint: "Action needed",
        icon: PenLine,
        loading: revisions.isLoading,
      },
      {
        title: "Approved designs",
        value: approved,
        hint: "All versions",
        icon: BadgeCheck,
        loading: mySubs.isLoading,
      },
    ];
  } else {
    const myRevisions = (revisions.data ?? []).length;
    stats = [
      {
        title: "Ready to publish",
        value: smmQueue.data?.length ?? 0,
        hint: "Approved handoffs",
        icon: Send,
        loading: smmQueue.isLoading,
      },
      {
        title: "My revision requests",
        value: myRevisions,
        hint: "In routing",
        icon: PenLine,
        loading: revisions.isLoading,
      },
      {
        title: "Approved designs",
        value: (handoffs.data ?? []).length,
        hint: "Visible to me",
        icon: FileCheck2,
        loading: handoffs.isLoading,
      },
    ];
  }

  return (
    <section aria-label={`${heading} statistics`} className="space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-(--fg-subtle)">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard
            key={s.title}
            title={s.title}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            loading={s.loading}
          />
        ))}
      </div>
    </section>
  );
}
