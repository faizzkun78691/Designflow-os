import type { LucideIcon } from "lucide-react";
import { StatCard } from "../../../components/ui/stat-card";

interface MetricCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
}

/** Thin wrapper over StatCard for publishing metrics. */
export function MetricCard({
  title,
  value,
  icon,
  hint,
  loading = false,
}: MetricCardProps) {
  return (
    <StatCard
      title={title}
      value={value.toLocaleString()}
      icon={icon}
      hint={hint}
      loading={loading}
    />
  );
}
