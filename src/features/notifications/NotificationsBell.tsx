import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { cn } from "../../utils/cn";
import { useTaskRealtime } from "../realtime/useTaskRealtime";
import { useMarkAllRead, useUnreadCount } from "./hooks";
import { NotificationsPanel } from "./NotificationsPanel";

/**
 * Notification bell for the AppShell topbar. Shows the unread count badge,
 * opens the notifications panel, and marks everything read on open.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const { data: unreadCount } = useUnreadCount();
  const markAllRead = useMarkAllRead();

  // Keep the badge fresh while the app is open.
  useTaskRealtime(true);

  // Mark all read once per open (only when there is something unread).
  useEffect(() => {
    if (open && (unreadCount ?? 0) > 0) {
      markAllRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape.
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

  const unread = unreadCount ?? 0;

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "relative flex size-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-fg",
          open && "bg-[var(--surface-2)] text-fg",
        )}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2"
          >
            <NotificationsPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
