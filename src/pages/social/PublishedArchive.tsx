/**
 * Social Media — Published Archive. The live published queue lives in the
 * Publishing Studio ("Published" tab); this page restyles the Phase 4
 * placeholder and routes users there.
 */
import { Link } from "react-router-dom";
import { Archive, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { PageHeader } from "../../components/ui/page-header";

export default function SocialPublishedArchive() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Published Archive"
        description="Every published post, searchable and linked back to its design."
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--secondary-fg)]">
            <Archive className="size-7" aria-hidden="true" />
          </span>
          <EmptyState
            icon={Archive}
            title="The live Published archive lives in the Studio"
            description="Every published post with its design, caption and platform links is in the Publishing Studio."
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
