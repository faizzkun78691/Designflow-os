/**
 * Social Media "Request changes" dialog. SMM requests always route
 * SMM → Organizer → Team Lead → Designer, never skipping a reviewer.
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

interface SmmRevisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskCode: string | null;
  version: number | null;
  submitting: boolean;
  onSubmit: (instructions: string, priority: string) => void;
}

export function SmmRevisionModal({
  open,
  onOpenChange,
  taskCode,
  version,
  submitting,
  onSubmit,
}: SmmRevisionModalProps) {
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInstructions("");
      setPriority("normal");
      setError(null);
    }
  }, [open ]);

  const submit = () => {
    if (!instructions.trim()) {
      setError("Written instructions are required.");
      return;
    }
    setError(null);
    onSubmit(instructions.trim(), priority.trim() || "normal");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            {taskCode ?? "Task"}
            {version != null ? ` · version ${version}` : ""}. Your request
            goes to the Organizer first, then the Team Lead, then the
            designer — it never skips a reviewer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="smm-rev-instructions">
              Required changes <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="smm-rev-instructions"
              rows={4}
              placeholder="e.g. Make the headline larger and change the background…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smm-rev-priority">Priority</Label>
            <Input
              id="smm-rev-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="normal"
            />
          </div>
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
