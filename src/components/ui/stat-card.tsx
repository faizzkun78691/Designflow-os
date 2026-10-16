import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  loading = false,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="truncate text-sm font-medium text-(--fg-subtle)">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="font-display text-[1.75rem] font-bold leading-none tracking-tight text-(--fg) tabular-nums">
                {value}
              </p>
            )}
            {hint && !loading && (
              <p className="truncate text-xs text-(--fg-subtle)">{hint}</p>
            )}
          </div>
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border border-(--border) bg-(--surface-2) text-(--ring)",
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
