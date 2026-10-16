import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

export const buttonVariants = cva(
  "inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-lg font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-(--primary) text-(--primary-fg) shadow-glow hover:bg-(--primary-hover) active:bg-(--primary-active)",
        secondary:
          "border border-(--border) bg-(--surface-2) text-(--fg) hover:bg-(--surface-elev)",
        outline:
          "border border-(--border-strong) bg-transparent text-(--fg) hover:bg-(--surface-2)",
        ghost: "text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg)",
        destructive:
          "border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_14%,transparent)] text-(--error) hover:bg-[color-mix(in_srgb,var(--error)_22%,transparent)]",
        link: "h-auto min-h-0 p-0 font-sans font-medium text-(--primary) underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-10 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render the button styles on the single child element instead of a
   * native <button> (e.g. a react-router <Link>). Class names and event
   * handlers are merged onto the child.
   */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, type = "button", asChild = false, children, ...props },
    ref,
  ) {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild) {
      const child = Children.only(children);
      if (!isValidElement(child)) {
        throw new Error("Button with asChild requires exactly one child element.");
      }
      const typedChild = child as ReactElement<{ className?: string }>;
      // Note: `type` was destructured out above, so it never reaches the child.
      return cloneElement(typedChild, {
        ...props,
        className: cn(classes, typedChild.props.className),
      });
    }

    return (
      <button ref={ref} type={type} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
