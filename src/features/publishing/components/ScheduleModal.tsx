import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useSchedulePublishing } from "../hooks";

interface ScheduleModalProps {
  recordId: string | null;
  currentScheduledAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleModal({
  recordId,
  currentScheduledAt,
  open,
  onOpenChange,
  title,
}: ScheduleModalProps) {
  const schedule = useSchedulePublishing();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(null);
      const base =
        currentScheduledAt && new Date(currentScheduledAt).getTime() > Date.now()
          ? new Date(currentScheduledAt)
          : new Date(Date.now() + 60 * 60 * 1000);
      setWhen(toLocalInputValue(base));
    }
  }, [open, currentScheduledAt]);

  const submit = () => {
    if (!recordId) return;
    const parsed = new Date(when);
    if (Number.isNaN(parsed.getTime())) {
      setError("Choose a valid date and time.");
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setError("The scheduled time must be in the future.");
      return;
    }
    setError(null);
    schedule.mutate(
      {
        recordId,
        scheduledAt: parsed.toISOString(),
        note: note.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const minValue = toLocalInputValue(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick a future date and time to publish. The record moves to
            "Scheduled".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pub-schedule-when">
              Date &amp; time <span className="text-red-400">*</span>
            </Label>
            <Input
              id="pub-schedule-when"
              type="datetime-local"
              min={minValue}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-schedule-note">Note (optional)</Label>
            <Textarea
              id="pub-schedule-note"
              rows={2}
              placeholder="Any scheduling note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={schedule.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={schedule.isPending || !when}>
            {schedule.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Confirm schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
