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
import { useMarkPublished } from "../hooks";
import { platformLabel } from "../types";
import type { RefLink } from "../types";

interface PublishConfirmModalProps {
  recordId: string | null;
  platform: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HTTPS_URL_RE = /^https:\/\/[^\s/$.?#].[^\s]*$/i;

export function PublishConfirmModal({
  recordId,
  platform,
  open,
  onOpenChange,
}: PublishConfirmModalProps) {
  const mark = useMarkPublished();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [postId, setPostId] = useState("");
  const [notes, setNotes] = useState("");
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const now = new Date();
      setDate(now.toISOString().slice(0, 10));
      setTime(now.toTimeString().slice(0, 5));
      setPublishedUrl("");
      setPostId("");
      setNotes("");
      setExtraUrls([]);
      setErrors({});
    }
  }, [open ]);

  const setExtra = (idx: number, value: string) =>
    setExtraUrls((prev) => prev.map((u, i) => (i === idx ? value : u)));

  const submit = () => {
    if (!recordId) return;
    const next: Record<string, string> = {};

    if (publishedUrl.trim() && !HTTPS_URL_RE.test(publishedUrl.trim())) {
      next.publishedUrl = "URL must start with https://";
    }
    extraUrls.forEach((u, i) => {
      if (u.trim() && !HTTPS_URL_RE.test(u.trim())) {
        next[`extra_${i}`] = "URL must start with https://";
      }
    });
    if (!date || !time) {
      next.datetime = "Published date and time are required.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const links: RefLink[] = extraUrls
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .map((u) => ({ url: u, label: u }));

    // The RPC has no published_at param; the server stamps it. Keep the
    // user-entered date/time in the notes so it is not lost.
    const noteLines = [notes.trim()];
    noteLines.push(`Published at: ${date} ${time}`);
    const notesText = noteLines.filter(Boolean).join("\n");

    mark.mutate(
      {
        recordId,
        input: {
          publishedUrl: publishedUrl.trim() || null,
          platformPostId: postId.trim() || null,
          publishingNotes: notesText || null,
          extraUrls: links,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as published</DialogTitle>
          <DialogDescription>
            Confirm this post went live. Platform:{" "}
            <span className="font-medium text-[var(--fg)]">
              {platformLabel(platform)}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pub-conf-date">
                Published date <span className="text-red-400">*</span>
              </Label>
              <Input
                id="pub-conf-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pub-conf-time">
                Published time <span className="text-red-400">*</span>
              </Label>
              <Input
                id="pub-conf-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {errors.datetime && (
            <p className="text-sm text-red-400">{errors.datetime}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pub-conf-url">Published URL (optional)</Label>
            <Input
              id="pub-conf-url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={publishedUrl}
              onChange={(e) => setPublishedUrl(e.target.value)}
            />
            {errors.publishedUrl && (
              <p className="text-sm text-red-400">{errors.publishedUrl}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-conf-postid">Platform post ID (optional)</Label>
            <Input
              id="pub-conf-postid"
              placeholder="e.g. instagram reel/post id"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-conf-notes">Notes (optional)</Label>
            <Textarea
              id="pub-conf-notes"
              rows={2}
              placeholder="Anything worth remembering about this publish…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Extra URLs (optional)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExtraUrls((p) => [...p, ""])}
              >
                <Plus className="size-3.5" aria-hidden="true" /> Add URL
              </Button>
            </div>
            {extraUrls.map((u, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    value={u}
                    onChange={(e) => setExtra(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExtraUrls((p) => p.filter((_, j) => j !== i))
                    }
                    aria-label="Remove URL"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {errors[`extra_${i}`] && (
                  <p className="text-sm text-red-400">{errors[`extra_${i}`]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mark.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mark.isPending}>
            {mark.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Confirm published
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
