/**
 * Shared "Request changes" dialog used by every reviewer surface
 * (ReviewCard, TaskDetail). Collects instructions (required), priority,
 * optional deadline and reference URLs; the parent performs the actual
 * mutation so routing semantics stay in one place.
 */
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
import type { RequestRevisionInput } from "../types";

interface RevisionRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskCode: string | null;
  version: number | null;
  /** Explains who the instructions route through (shown in the dialog). */
  routingNote: string;
  /** True while the parent mutation is in flight. */
  submitting: boolean;
  /** Server-side error to display, if any. */
  error: string | null;
  onSubmit: (input: RequestRevisionInput) => void;
}

export function RevisionRequestModal({
  open,
  onOpenChange,
  taskCode,
  version,
  routingNote,
  submitting,
  error,
  onSubmit,
}: RevisionRequestModalProps) {
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [refInput, setRefInput] = useState("");
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInstructions("");
      setPriority("normal");
      setDeadline("");
      setRefInput("");
      setRefUrls([]);
      setFormError(null);
    }
  }, [open ]);

  const addRef = () => {
    const v = refInput.trim();
    if (!v) return;
    if (!/^https:\/\//i.test(v)) {
      setFormError("Reference URLs must start with https://.");
      return;
    }
    setFormError(null);
    setRefUrls((p) => [...p, v]);
    setRefInput("");
  };

  const submit = () => {
    if (!instructions.trim()) {
      setFormError("Written instructions are required.");
      return;
    }
    setFormError(null);
    onSubmit({
      instructions: instructions.trim(),
      priority: priority.trim() || undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      reference_urls: refUrls.map((url) => ({ label: url, url })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            {taskCode ?? "Task"}
            {version != null ? ` · version ${version}` : ""}. {routingNote}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rr-instructions">
              Instructions for the designer{" "}
              <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="rr-instructions"
              rows={5}
              placeholder="Be specific: what must change, what is wrong, what good looks like…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rr-priority">Priority</Label>
              <Input
                id="rr-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="normal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-deadline">Deadline (optional)</Label>
              <Input
                id="rr-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rr-ref">Reference URLs (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="rr-ref"
                type="url"
                placeholder="https://…"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRef();
                  }
                }}
              />
              <Button type="button" variant="secondary" onClick={addRef}>
                Add
              </Button>
            </div>
            {refUrls.length > 0 && (
              <ul className="mt-2 space-y-1">
                {refUrls.map((u, i) => (
                  <li
                    key={`${u}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2 py-1 text-xs"
                  >
                    <span className="truncate text-volt">{u}</span>
                    <button
                      type="button"
                      className="shrink-0 text-subtle hover:text-muted"
                      onClick={() =>
                        setRefUrls((p) => p.filter((_, j) => j !== i))
                      }
                      aria-label={`Remove ${u}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(formError || error) && (
            <p role="alert" className="text-sm text-red-400">
              {formError ?? error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {submitting ? "Sending…" : "Send revision request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
