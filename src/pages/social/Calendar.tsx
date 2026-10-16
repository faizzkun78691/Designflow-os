/**
 * Publishing Studio — calendar. Month / Week / Day / List views over the
 * SMM-visible publishing pipeline (ready records + scheduled items from
 * the metrics RPC), with platform/status filters and rescheduling from
 * the event detail popover.
 *
 * NOTE (RLS caveat): SMM can only SELECT publishing_records rows with
 * status='ready' AND is_current=true, so scheduled/pending/published
 * records are invisible to the direct read. The metrics RPC exposes the
 * scheduled items SMM is allowed to see via its `upcoming` array — those
 * light up the calendar until the backend policy is widened.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isValid,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
} from "lucide-react";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../utils/cn";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import {
  usePublishingMetrics,
  usePublishingRecords,
} from "../../features/publishing/hooks";
import { useSmmQueue } from "../../features/workflow/hooks";
import { StatusBadge } from "../../features/publishing/components/StatusBadge";
import { ScheduleModal } from "../../features/publishing/components/ScheduleModal";
import {
  PLATFORMS,
  platformLabel,
} from "../../features/publishing/types";
import type {
  PublishingRecord,
  PublishingStatus,
} from "../../features/publishing/types";

type ViewMode = "month" | "week" | "day" | "list";

interface CalEvent {
  key: string;
  recordId: string;
  title: string;
  platform: string | null;
  status: PublishingStatus;
  at: Date | null;
  atIso: string | null;
  overdue: boolean;
}

/** Where a ready record sits on the calendar: scheduled time first,
 * then the organizer's preferred date/time. */
function placementDate(record: PublishingRecord): Date | null {
  if (record.scheduled_at) {
    const d = new Date(record.scheduled_at);
    if (isValid(d)) return d;
  }
  if (record.preferred_date) {
    const time = record.preferred_time?.trim() || "00:00";
    const d = new Date(`${record.preferred_date}T${time}`);
    if (isValid(d)) return d;
    const fallback = new Date(record.preferred_date);
    return isValid(fallback) ? fallback : null;
  }
  return null;
}

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "ready", label: "Ready" },
  { id: "pending", label: "Pending" },
  { id: "scheduled", label: "Scheduled" },
  { id: "changes_requested", label: "Changes requested" },
  { id: "published", label: "Published" },
];

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "list", label: "List" },
];

function EventChip({
  event,
  onClick,
}: {
  event: CalEvent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${event.at ? format(event.at, "h:mm a") : "No time"} · ${event.title}`}
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded-md border px-1.5 py-1 text-left text-xs transition-colors",
        event.overdue
          ? "border-[var(--error)]/40 bg-[var(--error)]/10 text-[var(--fg)] hover:bg-[var(--error)]/20"
          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elev)]",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          event.overdue ? "bg-[var(--error)]" : "bg-[var(--primary)]",
        )}
        aria-hidden="true"
      />
      <span className="truncate">
        {event.at && (
          <span className="mr-1 font-mono text-[var(--fg-subtle)]">
            {format(event.at, "h:mm a")}
          </span>
        )}
        {event.title}
      </span>
    </button>
  );
}

function ListRow({
  event,
  onSelect,
}: {
  event: CalEvent;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        event.overdue
          ? "border-[var(--error)]/40 bg-[var(--error)]/5 hover:bg-[var(--error)]/10"
          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
      )}
    >
      <span className="w-32 shrink-0 font-mono text-xs text-[var(--fg-subtle)]">
        {event.at ? format(event.at, "MMM d, h:mm a") : "No date"}
      </span>
      <span className="flex-1 truncate text-sm font-medium text-[var(--fg)]">
        {event.title}
      </span>
      {event.overdue && (
        <Badge variant="danger" className="shrink-0">
          Overdue
        </Badge>
      )}
      <Badge variant="outline" className="hidden sm:inline-flex">
        {platformLabel(event.platform)}
      </Badge>
      <StatusBadge status={event.status} />
    </button>
  );
}

export default function Calendar() {
  useTaskRealtime();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [rescheduling, setRescheduling] = useState<CalEvent | null>(null);

  const readyQuery = usePublishingRecords("ready");
  const metricsQuery = usePublishingMetrics();
  const smmQueue = useSmmQueue();

  const taskCodes = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of smmQueue.data ?? []) {
      if (item.task_id && item.task_code) map.set(item.task_id, item.task_code);
    }
    return map;
  }, [smmQueue.data]);

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    const seen = new Set<string>();

    for (const r of readyQuery.data ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const at = placementDate(r);
      out.push({
        key: `ready-${r.id}`,
        recordId: r.id,
        title: taskCodes.get(r.task_id) ?? platformLabel(r.platform),
        platform: r.platform,
        status: r.status,
        at,
        atIso: r.scheduled_at,
        overdue:
          r.status === "scheduled" && !!at && at.getTime() < Date.now(),
      });
    }

    for (const u of metricsQuery.data?.upcoming ?? []) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      const parsed = u.scheduled_at ? new Date(u.scheduled_at) : null;
      const at = parsed && isValid(parsed) ? parsed : null;
      out.push({
        key: `upcoming-${u.id}`,
        recordId: u.id,
        title:
          (u.task_id && taskCodes.get(u.task_id)) ?? platformLabel(u.platform),
        platform: u.platform,
        status: "scheduled",
        at,
        atIso: u.scheduled_at || null,
        overdue: !!at && at.getTime() < Date.now(),
      });
    }

    return out;
  }, [readyQuery.data, metricsQuery.data, taskCodes]);

  const filtered = useMemo(() => {
    return events.filter(
      (e) =>
        (platformFilter === "all" || e.platform === platformFilter) &&
        (statusFilter === "all" || e.status === statusFilter),
    );
  }, [events, platformFilter, statusFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of filtered) {
      if (!e.at) continue;
      const k = format(e.at, "yyyy-MM-dd");
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime());
    }
    return map;
  }, [filtered]);

  const loading = readyQuery.isLoading || metricsQuery.isLoading;

  /* navigation */
  const goPrev = () => {
    if (view === "month") setCursor((c) => subMonths(c, 1));
    else if (view === "week") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => addDays(c, -1));
  };
  const goNext = () => {
    if (view === "month") setCursor((c) => addMonths(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };

  const rangeLabel = () => {
    if (view === "month") return format(cursor, "MMMM yyyy");
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = endOfWeek(cursor);
      return isSameMonth(s, e)
        ? `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
        : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    if (view === "day") return format(cursor, "EEEE, MMM d, yyyy");
    return "All upcoming";
  };

  /* month grid */
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [cursor]);

  const weekdayNames = useMemo(() => {
    const s = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => format(addDays(s, i), "EEE"));
  }, []);

  const overdue = filtered.filter((e) => e.overdue && e.at);
  const upcomingSorted = filtered
    .filter((e) => !e.overdue && e.at)
    .sort((a, b) => (a.at as Date).getTime() - (b.at as Date).getTime());
  const undated = filtered.filter((e) => !e.at);

  const openReschedule = (e: CalEvent) => {
    setSelected(null);
    // Defer so the detail dialog unmounts before the schedule dialog opens.
    setTimeout(() => setRescheduling(e), 60);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Publishing calendar"
        description={`Scheduled and ready posts across the publishing pipeline. Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone ?? "your local timezone"}.`}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
          role="tablist"
          aria-label="Calendar view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "font-display rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                view === v.id
                  ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                  : "text-[var(--fg-subtle)] hover:text-[var(--fg)]",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={goNext} aria-label="Next">
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <h2 className="font-display text-lg font-bold tracking-tight text-[var(--fg)]">{rangeLabel()}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            aria-label="Filter by platform"
            className="w-40"
          >
            <option value="all">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="w-44"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No posts on the calendar"
          description="Nothing matches the current filters. Ready posts and scheduled items will appear here."
        />
      ) : (
        <>
          {view === "month" && (
            <Card>
              <CardContent className="p-2 sm:p-4">
                <div className="grid grid-cols-7 gap-1">
                  {weekdayNames.map((d) => (
                    <div
                      key={d}
                      className="font-display px-1 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]"
                    >
                      {d}
                    </div>
                  ))}
                  {monthDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd");
                    const dayEvents = byDay.get(key) ?? [];
                    const inMonth = isSameMonth(day, cursor);
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setCursor(day);
                          setView("day");
                        }}
                        className={cn(
                          "min-h-20 cursor-pointer rounded-lg border p-1 transition-colors sm:min-h-24 sm:p-1.5",
                          inMonth
                            ? "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                            : "border-transparent bg-transparent opacity-40",
                          isToday(day) && "border-[var(--primary)]/50",
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                            isToday(day)
                              ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                              : "text-[var(--fg-subtle)]",
                          )}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((e) => (
                            <EventChip
                              key={e.key}
                              event={e}
                              onClick={() => setSelected(e)}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="px-1 text-xs text-[var(--fg-subtle)]">
                              +{dayEvents.length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {view === "week" && (
            <div className="grid grid-cols-7 gap-2 overflow-x-auto">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = byDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-40 min-w-28 rounded-xl border p-2",
                      isToday(day)
                        ? "border-[var(--primary)]/50 bg-[var(--surface)]"
                        : "border-[var(--border)] bg-[var(--surface-2)]",
                    )}
                  >
                    <p
                      className={cn(
                        "font-display mb-2 text-center text-xs font-bold",
                        isToday(day) ? "text-[var(--primary)]" : "text-[var(--fg-subtle)]",
                      )}
                    >
                      {format(day, "EEE d")}
                    </p>
                    <div className="space-y-1">
                      {dayEvents.map((e) => (
                        <EventChip
                          key={e.key}
                          event={e}
                          onClick={() => setSelected(e)}
                        />
                      ))}
                      {dayEvents.length === 0 && (
                        <p className="text-center text-xs text-[var(--fg-subtle)] opacity-60">—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === "day" && (
            <Card>
              <CardHeader>
                <CardTitle>{format(cursor, "EEEE, MMMM d")}</CardTitle>
              </CardHeader>
              <CardContent>
                {(byDay.get(format(cursor, "yyyy-MM-dd")) ?? []).length ===
                0 ? (
                  <p className="text-sm text-[var(--fg-subtle)]">
                    Nothing scheduled for this day.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(byDay.get(format(cursor, "yyyy-MM-dd")) ?? []).map(
                      (e) => (
                        <button
                          key={e.key}
                          type="button"
                          onClick={() => setSelected(e)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                            e.overdue
                              ? "border-[var(--error)]/40 bg-[var(--error)]/5 hover:bg-[var(--error)]/10"
                              : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
                          )}
                        >
                          <span className="font-mono text-sm text-[var(--fg-subtle)]">
                            {e.at ? format(e.at, "h:mm a") : "—"}
                          </span>
                          <span className="flex-1 truncate text-sm font-medium text-[var(--fg)]">
                            {e.title}
                          </span>
                          {e.overdue && (
                            <Badge variant="danger" className="shrink-0">
                              Overdue
                            </Badge>
                          )}
                          <Badge variant="outline" className="hidden sm:inline-flex">
                            {platformLabel(e.platform)}
                          </Badge>
                          <StatusBadge status={e.status} />
                        </button>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {view === "list" && (
            <div className="space-y-6">
              {overdue.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-display flex items-center gap-2 text-sm font-bold text-[var(--error)]">
                    <Clock className="size-4" aria-hidden="true" />
                    Overdue ({overdue.length})
                  </h3>
                  {overdue.map((e) => (
                    <ListRow
                      key={e.key}
                      event={e}
                      onSelect={() => setSelected(e)}
                    />
                  ))}
                </section>
              )}
              <section className="space-y-2">
                <h3 className="font-display text-sm font-bold text-[var(--fg-muted)]">
                  Upcoming ({upcomingSorted.length})
                </h3>
                {upcomingSorted.length === 0 && overdue.length === 0 && (
                  <p className="text-sm text-[var(--fg-subtle)]">
                    No dated posts match the current filters.
                  </p>
                )}
                {upcomingSorted.map((e) => (
                  <ListRow
                    key={e.key}
                    event={e}
                    onSelect={() => setSelected(e)}
                  />
                ))}
              </section>
              {undated.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-display flex items-center gap-2 text-sm font-bold text-[var(--fg-muted)]">
                    <Inbox className="size-4" aria-hidden="true" />
                    No date set ({undated.length})
                  </h3>
                  {undated.map((e) => (
                    <ListRow
                      key={e.key}
                      event={e}
                      onSelect={() => setSelected(e)}
                    />
                  ))}
                </section>
              )}
            </div>
          )}
        </>
      )}

      {/* Event detail popover */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.at
                    ? format(selected.at, "EEEE, MMM d, yyyy · h:mm a")
                    : "No date set"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {platformLabel(selected.platform)}
                </Badge>
                <StatusBadge status={selected.status} />
                {selected.overdue && (
                  <Badge variant="danger">Overdue</Badge>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => openReschedule(selected)}
                >
                  <Clock className="size-4" aria-hidden="true" /> Reschedule
                </Button>
                <Button
                  onClick={() => {
                    setSelected(null);
                    navigate(`/social/studio/${selected.recordId}`);
                  }}
                >
                  Open detail
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleModal
        recordId={rescheduling?.recordId ?? null}
        currentScheduledAt={rescheduling?.atIso ?? null}
        open={rescheduling !== null}
        onOpenChange={(o) => {
          if (!o) setRescheduling(null);
        }}
        title="Reschedule post"
      />
    </main>
  );
}
