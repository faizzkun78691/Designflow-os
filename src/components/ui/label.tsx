import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export const Label = forwardRef<
  HTMLLabelElement,
  LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-(--fg-muted)", className)}
      {...props}
    />
  );
});
