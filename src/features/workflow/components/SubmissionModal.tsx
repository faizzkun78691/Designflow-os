/**
 * Designer submission modal — creates an immutable submission version via
 * the submit_design RPC. All validation errors are shown inline; the
 * server re-validates everything (URLs, role, task state).
 */
import { useMemo, useState } from "react";
import { Link2, Loader2, Plus, Trash2, Upload } from "lucide-react";
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
import { toast } from "../../../components/ui/toaster";
import { useSubmitDesign } from "../hooks";
import {
  APPROVED_DESIGN_HOSTS,
  isApprovedDesignUrl,
  type RefLink,
} from "../types";

interface SubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskCode: string | null;
  /** Next version number (for display only; the server assigns it). */
  nextVersion: number;
  /** Task checklist completion, when the task has checklist items. */
  checklistTotal?: number;
  checklistDone?: number;
  onSubmitted?: () => void;
}

function httpsOk(raw: string): boolean {
  return raw.trim().toLowerCase().startsWith("https://");
}

export function SubmissionModal({
  open,
  onOpenChange,
  taskId,
  taskCode,
  nextVersion,
  checklistTotal = 0,
  checklistDone = 0,
  onSubmitted,
}: SubmissionModalProps) {
  const submit = useSubmitDesign();
  const [driveLink, setDriveLink] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [links, setLinks] = useState<RefLink[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const checklistRequired = checklistTotal > 0;
  const checklistComplete = checklistDone >= checklistTotal;

  const reset = () => {
    setDriveLink("");
    setSourceUrl("");
    setPreviewUrl("");
    setNotes("");
    setLinks([]);
    setLinkLabel("");
    setLinkUrl("");
    setConfirmed(false);
    setErrors({});
  };

  const validation = useMemo(() => {
    const e: Record<string, string> = {};
    const dl = driveLink.trim();
    if (!dl) e.driveLink = "A design URL is required.";
    else if (!isApprovedDesignUrl(dl))
      e.driveLink = `Must be an https link from an approved host: ${APPROVED_DESIGN_HOSTS.join(", ")}.`;
    const su = sourceUrl.trim();
    if (su && !isApprovedDesignUrl(su))
      e.sourceUrl = "Source URL must be an approved https host.";
    const pu = previewUrl.trim();
    if (pu && !httpsOk(pu)) e.previewUrl = "Preview URL must start with https://.";
    if (checklistRequired && !checklistComplete)
      e.checklist = `Checklist is ${checklistDone}/${checklistTotal} — finish all items first.`;
    if (!confirmed) e.confirmed = "Please confirm the checklist before submitting.";
    return e;
  }, [
    driveLink,
    sourceUrl,
    previewUrl,
    confirmed,
    checklistRequired,
    checklistComplete,
    checklistDone,
    checklistTotal,
  ]);

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!httpsOk(url)) {
      setErrors((p) => ({ ...p, newLink: "Reference URL must start with https://." }));
      return;
    }
    setLinks((p) => [...p, { label: linkLabel.trim() || url, url }]);
    setLinkLabel("");
    setLinkUrl("");
    setErrors((p) => {
      const n = { ...p };
      delete n.newLink;
      return n;
    });
  };

  const handleSubmit = () => {
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    submit.mutate(
      {
        taskId,
        input: {
          drive_link: driveLink.trim(),
          source_url: sourceUrl.trim() || null,
          preview_url: previewUrl.trim() || null,
          notes: notes.trim() || null,
          checklist_confirmed: confirmed,
          reference_links: links,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Version ${nextVersion} submitted for Team Lead review.`);
          reset();
          onOpenChange(false);
          onSubmitted?.();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5 text-volt" aria-hidden="true" />
            Submit design {taskCode ? `· ${taskCode}` : ""}
          </DialogTitle>
          <DialogDescription>
            This creates immutable version {nextVersion}. Once submitted it
            cannot be edited — a new version is required for any change.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="drive-link">
              Design URL <span className="text-red-400">*</span>
            </Label>
            <Input
              id="drive-link"
              placeholder="https://drive.google.com/…"
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              aria-invalid={!!errors.driveLink}
            />
            {errors.driveLink && (
              <p className="text-xs text-red-400">{errors.driveLink}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="source-url">Source file URL (optional)</Label>
              <Input
                id="source-url"
                placeholder="https://figma.com/…"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                aria-invalid={!!errors.sourceUrl}
              />
              {errors.sourceUrl && (
                <p className="text-xs text-red-400">{errors.sourceUrl}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preview-url">Preview URL (optional)</Label>
              <Input
                id="preview-url"
                placeholder="https://…"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                aria-invalid={!!errors.previewUrl}
              />
              {errors.previewUrl && (
                <p className="text-xs text-red-400">{errors.previewUrl}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-notes">Submission notes</Label>
            <Textarea
              id="sub-notes"
              placeholder="What changed in this version? Anything the reviewer should know…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Additional reference links</Label>
            {links.map((l, i) => (
              <div
                key={`${l.url}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-token bg-surface px-3 py-2"
              >
                <Link2 className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">{l.label}</p>
                  <p className="truncate text-xs text-subtle">{l.url}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}
                  aria-label={`Remove ${l.label}`}
                >
                  <Trash2 className="size-4 text-subtle" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="w-1/3"
              />
              <Input
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="secondary" onClick={addLink}>
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>
            {errors.newLink && <p className="text-xs text-red-400">{errors.newLink}</p>}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-token bg-surface p-3.5">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 accent-[#8B35FF]"
            />
            <span className="text-sm text-muted">
              I confirm the task checklist is complete
              {checklistRequired && (
                <span className="text-subtle">
                  {" "}
                  ({checklistDone}/{checklistTotal} done)
                </span>
              )}
              .
            </span>
          </label>
          {(errors.confirmed || errors.checklist) && (
            <p className="text-xs text-red-400">
              {errors.confirmed ?? errors.checklist}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submit.isPending}
            aria-busy={submit.isPending}
          >
            {submit.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {submit.isPending ? "Submitting…" : `Submit version ${nextVersion}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
