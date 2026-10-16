import { cn } from "../../utils/cn";

export interface PhaseBadgeProps {
  /** Full label suffix, e.g. label="Phase 2" renders "Coming in Phase 2". */
  label?: string;
  /** Shorthand: phase={2} renders "Coming in Phase 2". Takes precedence over label. */
  phase?: string | number;
  className?: string;
}

export function PhaseBadge({ label = "Phase 2", phase, className }: PhaseBadgeProps) {
  const text =
    phase !== undefined ? `Coming in Phase ${phase}` : `Coming in ${label}`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-volt/30 bg-volt/5 px-2.5 py-1 text-xs font-medium text-volt/90",
        className,
      )}
    >
      {text}
    </span>
  );
}
