import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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
import { Select } from "../../../components/ui/select";
import { useRequestPublishingChanges } from "../hooks";
import type { RefLink, RevisionPriority } from "../types";

interface ChangesRequestModalProps {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HTTPS_URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i;

const PRIORITIES: { id: RevisionPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

export function ChangesRequestModal({
  recordId,
  open,
  onOpenChange,
}: ChangesRequestModalProps) {
  const request = useRequestPublishingChanges();
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState<RevisionPriority>("normal");
  const [deadline, setDeadline] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setInstructions("");
      setPriority("normal");
      setDeadline("");
      setRefs([]);
      setErrors({});
    }
  }, [open ]);

  const setRef = (idx: number, value: string) =>
    setRefs((prev) => prev.map((u, i) => (i === idx ? value : u)));

  const submit = () => {
    if (!recordId) return;
    const next: Record<string, string> = {};

    const trimmed = instructions.trim();
    if (trimmed.length < 10) {
      next.instructions = "Instructions must be at least 10 characters.";
    }
    if (deadline) {
      const parsed = new Date(deadline);
      if (Number.isNaN(parsed.getTime())) {
        next.deadline = "Choose a valid deadline.";
      } else if (parsed.getTime() <= Date.now()) {
        next.deadline = "The deadline must be in the future.";
      }
    }
    refs.forEach((u, i) => {
      if (u.trim() && !HTTPS_URL_RE.test(u.trim())) {
        next[`ref_${i}`] = "URL must start with https://";
      }
    });

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const referenceUrls: RefLink[] = refs
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => ({ url: u, label: u }));

    request.mutate(
      {
        recordId,
        input: {
          instructions: trimmed,
          priority,
          deadline: deadline || null,
          referenceUrls,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            The record moves to "Changes requested" and routes back through
            the approval chain for a revised version.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="pub-chg-instructions">
              Required changes <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="pub-chg-instructions"
              rows={4}
              placeholder="Describe exactly what needs to change…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            {errors.instructions ? (
              <p className="text-sm text-red-400">{errors.instructions}</p>
            ) : (
              <p className="text-xs text-[var(--fg-subtle)]">
                Minimum 10 characters so the designer knows what to do.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pub-chg-priority">Priority</Label>
              <Select
                id="pub-chg-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as RevisionPriority)
                }
              >
                {PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pub-chg-deadline">Deadline (optional)</Label>
              <Input
                id="pub-chg-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              {errors.deadline && (
                <p className="text-sm text-red-400">{errors.deadline}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Reference URLs (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRefs((p) => [...p, ""])}
              >
                <Plus className="size-3.5" aria-hidden="true" /> Add URL
              </Button>
            </div>
            {refs.map((u, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={u}
                    onChange={(e) => setRef(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRefs((p) => p.filter((_, j) => j !== i))}
                    aria-label="Remove URL"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {errors[`ref_${i}`] && (
                  <p className="text-sm text-red-400">{errors[`ref_${i}`]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={request.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={request.isPending}>
            {request.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
