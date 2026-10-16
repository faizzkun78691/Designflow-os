import { cn } from "../../utils/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  id,
  className,
}: SwitchProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        id={id}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "border-(--ring)/40 bg-(--primary)" : "border-(--border) bg-(--surface-2)",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block size-4 rounded-full shadow transition-transform",
            checked
              ? "translate-x-[23px] bg-black"
              : "translate-x-[3px] bg-white",
          )}
        />
      </button>
      {label && (
        <label
          htmlFor={id}
          className="cursor-pointer text-sm text-(--fg-muted) select-none"
        >
          {label}
        </label>
      )}
    </span>
  );
}
