import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "../../utils/cn";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type ToastListener = (items: ToastItem[]) => void;

const listeners = new Set<ToastListener>();
let items: ToastItem[] = [];
let nextId = 1;
const DISMISS_MS = 4000;

function emit() {
  for (const listener of listeners) listener(items);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string) {
  const id = nextId++;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => dismiss(id), DISMISS_MS);
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
};

const kindStyles: Record<ToastKind, { icon: typeof CheckCircle2; iconClass: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-(--success)" },
  error: { icon: AlertCircle, iconClass: "text-red-400" },
  info: { icon: Info, iconClass: "text-sky-400" },
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>(items);

  useEffect(() => {
    const listener: ToastListener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="safe-bottom pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, iconClass } = kindStyles[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-(--border) bg-(--surface-elev) p-4 shadow-pop"
            >
              <Icon
                className={cn("mt-0.5 size-5 shrink-0", iconClass)}
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 text-sm text-(--fg)">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--fg-subtle) transition-colors hover:bg-(--surface-2) hover:text-(--fg)"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
