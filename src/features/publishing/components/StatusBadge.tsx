import { Badge } from "../../../components/ui/badge";
import { STATUS_META } from "../types";
import type { PublishingStatus } from "../types";

export function StatusBadge({ status }: { status: PublishingStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
