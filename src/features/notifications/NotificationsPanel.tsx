import { useMemo } from "react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { BellRing, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../utils/cn";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../contexts/AuthContext";
import type { AppNotification } from "../dashboard/types";
import { useMarkAllRead, useMarkRead, useNotifications } from "./hooks";
import { notificationRoute } from "./routing";

function NotificationItem({
  notification,
}: {
  notification: AppNotification;
}) {
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleClick = () => {
    if (!notification.is_read) markRead.mutate(notification.id);
    navigate(notificationRoute(notification, role));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
        notification.is_read
          ? "border-transparent hover:bg-surface-2"
          : "border-volt/25 bg-volt/[0.07] hover:bg-volt/[0.11]",
      )}
    >
      {!notification.is_read && (
        <span
          aria-label="Unread"
          className="mt-1.5 size-2 shrink-0 rounded-full bg-volt"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">
          {notification.title ?? "Notification"}
        </span>
        {notification.body && (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
            {notification.body}
          </span>
        )}
        <span className="mt-1 block text-xs text-subtle">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
          })}
        </span>
      </span>
    </button>
  );
}

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return "Earlier";
}

export function NotificationsPanel() {
  const { data, isLoading, isError, refetch } = useNotifications(30);
  const markAllRead = useMarkAllRead();
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.is_read).length;

  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = [];
    const map = new Map<string, AppNotification[]>();
    for (const n of notifications) {
      const label = groupLabel(new Date(n.created_at));
      const list = map.get(label) ?? [];
      list.push(n);
      map.set(label, list);
    }
    for (const label of ["Today", "Yesterday", "Earlier"]) {
      const items = map.get(label);
      if (items) out.push({ label, items });
    }
    return out;
  }, [notifications]);

  return (
    <div className="flex max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-token bg-surface shadow-pop">
      <div className="flex items-center justify-between gap-2 border-b border-token px-4 py-3">
        <p className="font-display text-sm font-bold text-fg">
          Notifications
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-volt/15 px-2 py-0.5 text-xs font-bold text-volt">
              {unread} new
            </span>
          )}
        </p>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="h-8 gap-1.5 text-xs text-volt hover:text-volt"
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted">
              Could not load notifications.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-2">
            <EmptyState
              icon={BellRing}
              title="You're all caught up"
              description="Task updates, approvals and mentions will show up here."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">
                  {g.label}
                </p>
                <ul className="space-y-1.5">
                  {g.items.map((notification) => (
                    <li key={notification.id}>
                      <NotificationItem notification={notification} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
