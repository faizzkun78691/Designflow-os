import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** When true, applies the error border and sets aria-invalid. */
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error = false, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={error || undefined}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-(--surface) px-3 text-sm text-(--fg) transition-colors placeholder:text-(--fg-subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)/60 disabled:cursor-not-allowed disabled:opacity-50",
        error
          ? "border-[color-mix(in_srgb,var(--error)_50%,transparent)]"
          : "border-(--border) hover:border-(--border-strong) focus-visible:border-(--ring)/40",
        className,
      )}
      {...props}
    />
  );
});
