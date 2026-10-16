import { useMemo, useState } from "react";
import {
  endOfDay,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import {
  AlertOctagon,
  Ban,
  BellRing,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  Globe,
  Hand,
  PackageOpen,
  Rocket,
  RotateCcw,
  TimerOff,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { PageHeader } from "../../components/ui/page-header";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { StatCard } from "../../components/ui/stat-card";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { toast } from "../../components/ui/toaster";
import { useTaskRealtime } from "../../features/realtime/useTaskRealtime";
import { useBottlenecks, useOrganizerStats } from "../../features/analytics/hooks";
import { BottleneckList } from "../../features/analytics/components/BottleneckList";
import type { OrganizerStats } from "../../features/analytics/types";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* KPI definitions                                                     */
/* ------------------------------------------------------------------ */

interface KpiDef {
  title: string;
  icon: LucideIcon;
  value: (s: OrganizerStats) => number;
  hint?: string;
}

const KPI_DEFS: KpiDef[] = [
  { title: "Total Tasks", icon: ClipboardList, value: (s) => s.total_tasks },
  { title: "Available", icon: PackageOpen, value: (s) => s.available },
  { title: "Claimed", icon: Hand, value: (s) => s.claimed },
  { title: "Assigned", icon: UserCheck, value: (s) => s.assigned },
  { title: "In Progress", icon: Wrench, value: (s) => s.in_progress },
  {
    title: "Awaiting Lead Review",
    icon: FileSearch,
    value: (s) => s.awaiting_lead_review,
    hint: "Submitted designs",
  },
  {
    title: "Awaiting Organizer Review",
    icon: ClipboardCheck,
    value: (s) => s.awaiting_organizer_review,
    hint: "Lead-approved designs",
  },
  { title: "Revision Required", icon: RotateCcw, value: (s) => s.revision_required },
  { title: "Ready to Publish", icon: Rocket, value: (s) => s.ready_to_publish },
  { title: "Scheduled", icon: CalendarClock, value: (s) => s.scheduled },
  { title: "Published", icon: Globe, value: (s) => s.published },
  { title: "Overdue", icon: AlertOctagon, value: (s) => s.overdue },
  { title: "Cancelled", icon: Ban, value: (s) => s.cancelled },
  { title: "Pending Approvals", icon: BellRing, value: (s) => s.pending_approvals },
  {
    title: "Publishing Overdue",
    icon: TimerOff,
    value: (s) => s.publishing_overdue,
    hint: "Approved but not live",
  },
];

/* ------------------------------------------------------------------ */
/* bar chart (divs only, no chart library)                             */
/* ------------------------------------------------------------------ */

interface BarItem {
  label: string;
  value: number;
}

function BarChart({ items, valueLabel }: { items: BarItem[]; valueLabel: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-(--fg-muted)">{item.label}</p>
            <p className="font-display text-sm font-bold tabular-nums text-(--fg)">
              {item.value}
              <span className="ml-1 font-sans text-xs font-normal text-(--fg-subtle)">
                {valueLabel}
              </span>
            </p>
          </div>
          <div
            className="h-3 overflow-hidden rounded-full bg-(--surface-2)"
            role="img"
            aria-label={`${item.label}: ${item.value}`}
          >
            <div
              className="h-full rounded-full bg-(--primary) transition-[width] duration-500"
              style={{ width: `${Math.min(100, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CommandCenter() {
  useTaskRealtime();

  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState(toDateOnly(subDays(new Date(), 29)));
  const [customEnd, setCustomEnd] = useState(toDateOnly(new Date()));

  const range = useMemo(() => {
    const now = new Date();
    if (preset === "custom") {
      const s = parseISO(customStart);
      const e = parseISO(customEnd);
      if (!isValid(s) || !isValid(e) || s > e) return null;
      return {
        start: startOfDay(s).toISOString(),
        end: endOfDay(e).toISOString(),
      };
    }
    switch (preset) {
      case "today":
        return { start: startOfDay(now).toISOString(), end: now.toISOString() };
      case "7d":
        return { start: subDays(now, 7).toISOString(), end: now.toISOString() };
      case "30d":
        return { start: subDays(now, 30).toISOString(), end: now.toISOString() };
      case "month":
        return { start: startOfMonth(now).toISOString(), end: now.toISOString() };
    }
  }, [preset, customStart, customEnd]);

  const stats = useOrganizerStats(range);
  const bottlenecks = useBottlenecks();

  const applyCustom = () => {
    if (!range) {
      toast.error("Pick a valid date range (start on or before end).");
    }
  };

  const pipeline: BarItem[] = stats.data
    ? [
        { label: "Created", value: stats.data.total_tasks },
        {
          label: "Assigned / Claimed",
          value: stats.data.assigned + stats.data.claimed,
        },
        { label: "In Progress", value: stats.data.in_progress },
        {
          label: "Submitted",
          value: stats.data.awaiting_lead_review + stats.data.awaiting_organizer_review,
        },
        { label: "Lead Approved", value: stats.data.awaiting_organizer_review },
        { label: "Organizer Approved", value: stats.data.ready_to_publish },
        { label: "Ready to Publish", value: stats.data.ready_to_publish },
        { label: "Published", value: stats.data.published },
      ]
    : [];

  const periodActivity: BarItem[] = stats.data
    ? [
        { label: "Tasks created", value: stats.data.tasks_created_range },
        { label: "Published", value: stats.data.published_range },
      ]
    : [];

  const publishingFunnel: BarItem[] = stats.data
    ? [
        { label: "Ready to publish", value: stats.data.ready_to_publish },
        { label: "Scheduled", value: stats.data.scheduled },
        { label: "Published", value: stats.data.published },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Executive overview of every task, queue and bottleneck."
      />

      {/* date-range filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="size-4 text-(--fg-subtle)" aria-hidden="true" />
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant={preset === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => setPreset(p.key)}
              className={cn(preset !== p.key && "text-(--fg-muted)")}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-start">Start date</Label>
              <Input
                id="cc-start"
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-end">End date</Label>
              <Input
                id="cc-end"
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-44"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={applyCustom}>
              Apply
            </Button>
          </div>
        )}
      </div>

      {/* KPI grid */}
      {stats.error ? (
        <EmptyState
          icon={AlertOctagon}
          title="Command-center statistics unavailable"
          description={
            stats.error instanceof Error
              ? stats.error.message
              : "We could not load the statistics right now."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPI_DEFS.map((kpi) => (
            <StatCard
              key={kpi.title}
              title={kpi.title}
              icon={kpi.icon}
              hint={kpi.hint}
              loading={stats.isLoading || !stats.data}
              value={
                stats.data ? (
                  <span className="tabular-nums">{kpi.value(stats.data)}</span>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {/* pipeline stepper */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>
            Workflow-stage progress (counts, not completion %)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.isLoading || !stats.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pipeline.map((node, i) => (
                <li
                  key={node.label}
                  className="relative rounded-xl border border-(--border) bg-(--surface) p-4"
                >
                  <span className="absolute left-3 top-3 flex size-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ring)_15%,transparent)] font-display text-[11px] font-bold tabular-nums text-(--ring)">
                    {i + 1}
                  </span>
                  <p className="mt-8 font-display text-2xl font-bold tabular-nums text-(--fg)">
                    {node.value}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-(--fg-subtle)">
                    {node.label}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* bottleneck alerts */}
      <section aria-label="Bottleneck alerts">
        <h2 className="mb-3 font-display text-lg font-semibold text-(--fg)">
          Bottleneck alerts
        </h2>
        <BottleneckList
          data={bottlenecks.data}
          isLoading={bottlenecks.isLoading}
          error={bottlenecks.error instanceof Error ? bottlenecks.error : null}
        />
      </section>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Period activity</CardTitle>
            <CardDescription>
              Tasks created vs published in the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.isLoading || !stats.data ? (
              <div className="space-y-4">
                <Skeleton className="h-8 rounded-lg" />
                <Skeleton className="h-8 rounded-lg" />
              </div>
            ) : (
              <BarChart items={periodActivity} valueLabel="tasks" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Publishing funnel</CardTitle>
            <CardDescription>
              Approved designs moving toward publish
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.isLoading || !stats.data ? (
              <div className="space-y-4">
                <Skeleton className="h-8 rounded-lg" />
                <Skeleton className="h-8 rounded-lg" />
                <Skeleton className="h-8 rounded-lg" />
              </div>
            ) : (
              <BarChart items={publishingFunnel} valueLabel="tasks" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
