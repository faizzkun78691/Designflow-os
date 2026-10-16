import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const tint = (v: string, bg: number, border: number) =>
  `border-[color-mix(in_srgb,var(${v})_${border}%,transparent)] bg-[color-mix(in_srgb,var(${v})_${bg}%,transparent)] text-[var(${v})]`;

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-(--border) bg-(--surface-2) text-(--fg-muted)",
        volt: tint("--ring", 12, 35),
        outline: "border-(--border-strong) bg-transparent text-(--fg-muted)",
        success: tint("--success", 12, 30),
        warning: tint("--warning", 14, 32),
        danger: tint("--error", 12, 32),
        muted: "border-transparent bg-(--surface-2) text-(--fg-subtle)",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
