import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden max-w-[16rem] whitespace-normal rounded-lg border border-(--border) bg-(--surface-elev) px-2.5 py-1.5 text-xs leading-snug text-(--fg) shadow-pop [@media(hover:hover)]:group-hover/tooltip:block",
          sideClasses[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
