import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

const DropdownMenuContext = createContext<{ close: () => void } | null>(null);

export interface DropdownMenuProps {
  /** Phrasing-content trigger (spans, icons). The menu wraps it in an accessible toggle. */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  /** Which side of the trigger the menu opens on. Defaults to "bottom". */
  side?: "top" | "bottom";
  label?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  label,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open ]);

  const handleTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };

  return (
    <DropdownMenuContext.Provider value={{ close: () => setOpen(false) }}>
      <span ref={rootRef} className="relative inline-block max-w-full">
        <span
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label ?? "Open menu"}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={handleTriggerKeyDown}
          className="inline-flex max-w-full cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {trigger}
        </span>
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              aria-label={label}
              initial={{ opacity: 0, y: side === "bottom" ? -6 : 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: side === "bottom" ? -6 : 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute z-50 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elev)] p-1.5 shadow-pop",
                side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
                align === "end" ? "right-0" : "left-0",
              )}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </span>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuItemProps {
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}

export function DropdownMenuItem({
  onSelect,
  disabled = false,
  danger = false,
  icon: Icon,
  children,
}: DropdownMenuItemProps) {
  const ctx = useContext(DropdownMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        ctx?.close();
      }}
      className={cn(
        "flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        danger
          ? "text-[var(--error)] hover:bg-[var(--error)]/10"
          : "text-(--fg-muted) hover:bg-(--surface-2) hover:text-(--fg)",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn("-mx-1.5 my-1.5 h-px bg-[var(--border)]", className)}
    />
  );
}

export function DropdownMenuLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "truncate px-3 py-2 text-xs font-semibold uppercase tracking-wider text-subtle",
        className,
      )}
    >
      {children}
    </div>
  );
}
