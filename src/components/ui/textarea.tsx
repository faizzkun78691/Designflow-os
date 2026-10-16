import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, applies the error border and sets aria-invalid. */
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, error = false, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          "flex min-h-[96px] w-full rounded-lg border bg-(--surface) px-3 py-2.5 text-sm text-(--fg) transition-colors placeholder:text-(--fg-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)/60 disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-[color-mix(in_srgb,var(--error)_50%,transparent)]"
            : "border-(--border) hover:border-(--border-strong) focus-visible:border-(--ring)/40",
          className,
        )}
        {...props}
      />
    );
  },
);
