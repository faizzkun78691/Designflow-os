/**
 * Social Media — Scheduled queue. The live scheduling queue lives in the
 * Publishing Studio ("Scheduled" tab); this page restyles the Phase 4
 * placeholder and routes users there.
 */
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { PageHeader } from "../../components/ui/page-header";

export default function SocialScheduled() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Scheduled"
        description="Plan posts ahead of time and let the queue handle publishing for you."
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--secondary-fg)]">
            <CalendarClock className="size-7" aria-hidden="true" />
          </span>
          <EmptyState
            icon={CalendarClock}
            title="The live Scheduled queue lives in the Studio"
            description="Scheduling, rescheduling and the full queue by status are handled in the Publishing Studio."
            className="w-full border-none bg-transparent px-4 py-2"
          />
          <Button asChild>
            <Link to="/social/studio">
              Open Publishing Studio
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
