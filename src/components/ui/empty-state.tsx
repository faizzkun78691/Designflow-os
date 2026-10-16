import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-(--border-strong) bg-(--surface)/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        className="flex size-12 items-center justify-center rounded-xl border border-(--border) bg-(--surface-2) text-(--fg-subtle)"
        aria-hidden="true"
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="font-display text-base font-semibold text-(--fg)">
        {title}
      </h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-(--fg-muted)">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
