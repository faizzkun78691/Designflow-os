import { Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./card";
import { EmptyState } from "./empty-state";
import { PhaseBadge } from "./phase-badge";

export interface PhasePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Phase label forwarded to the badge, e.g. "Phase 2". */
  phase?: string;
}

export function PhasePlaceholder({
  title,
  description,
  icon: Icon = Package,
  phase = "Phase 2",
}: PhasePlaceholderProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <PhaseBadge label={phase} />
        <EmptyState
          icon={Icon}
          title={title}
          description={description}
          className="w-full border-none bg-transparent px-4 py-8"
        />
      </CardContent>
    </Card>
  );
}
