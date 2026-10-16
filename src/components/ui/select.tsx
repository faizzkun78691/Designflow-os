import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** When true, applies the error border and sets aria-invalid. */
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, error = false, children, ...props }, ref) {
    return (
      <span className="relative inline-flex w-full">
        <select
          ref={ref}
          aria-invalid={error || undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-(--surface) pl-3 pr-10 text-sm text-(--fg) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)/60 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-(--surface) [&>option]:text-(--fg)",
            error
              ? "border-[color-mix(in_srgb,var(--error)_50%,transparent)]"
              : "border-(--border) hover:border-(--border-strong) focus-visible:border-(--ring)/40",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-(--fg-subtle)"
          aria-hidden="true"
        />
      </span>
    );
  },
);
