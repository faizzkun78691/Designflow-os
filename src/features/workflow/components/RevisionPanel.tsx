/**
 * Revision instruction panel — the full chain for one revision request:
 * original instructions (immutable), clarifications, reference URLs,
 * routing trail, and acknowledge/forward actions for the current owner.
 */
import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCheck,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
} from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Textarea } from "../../../components/ui/textarea";
import { Label } from "../../../components/ui/label";
import { toast } from "../../../components/ui/toaster";
import { useAuth } from "../../../contexts/AuthContext";
import {
  useAcknowledgeRevision,
  useForwardRevision,
  useRoutingEvents,
} from "../hooks";
import {
  REVISION_STAGE_META,
  type RevisionRow,
} from "../types";

const ROLE_LABEL: Record<string, string> = {
  designer: "Designer",
  team_lead: "Team Lead",
  organizer: "Organizer",
  social_media_manager: "Social Media Manager",
};

function roleLabel(role: string | null): string {
  return (role && ROLE_LABEL[role]) || "—";
}

export function RevisionPanel({ revision }: { revision: RevisionRow }) {
  const { user } = useAuth();
  const [clarification, setClarification] = useState("");
  const [forwarding, setForwarding] = useState(false);

  const acknowledge = useAcknowledgeRevision();
  const forward = useForwardRevision();
  const events = useRoutingEvents(revision.id);

  const isOwner = !!user && revision.current_owner_id === user.id;
  const canForward =
    isOwner &&
    (revision.current_stage === "awaiting_organizer" ||
      revision.current_stage === "awaiting_lead");
  const meta = REVISION_STAGE_META[revision.current_stage];

  const doForward = () => {
    setForwarding(true);
    forward.mutate(
      { revisionId: revision.id, clarification },
      {
        onSuccess: () => {
          toast.success("Revision forwarded.");
          setClarification("");
          setForwarding(false);
        },
        onError: (err) => {
          toast.error(err.message);
          setForwarding(false);
        },
      },
    );
  };

  return (
    <Card className="border-amber-400/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <MessageSquareWarning
            className="size-4 text-(--warning)"
            aria-hidden="true"
          />
          <CardTitle className="text-sm">
            Revision requested · v{revision.submission_version ?? "—"}
          </CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {revision.acknowledged_at && (
            <Badge variant="outline">Acknowledged</Badge>
          )}
        </div>
        <p className="text-xs text-(--fg-subtle)">
          From {roleLabel(revision.source_role)}
          {revision.requester_name ? ` (${revision.requester_name})` : ""} ·{" "}
          {revision.created_at
            ? format(new Date(revision.created_at), "MMM d, yyyy h:mm a")
            : "—"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-(--border) bg-(--surface) p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
            Original instructions
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-(--fg)">
            {revision.original_instructions ?? revision.request_text}
          </p>
        </div>

        {revision.clarification && (
          <div className="rounded-lg border border-(--ring)/20 bg-(--ring)/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
              Clarifications added while routing
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-(--fg)">
              {revision.clarification}
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs">
          {revision.priority && (
            <div>
              <dt className="text-(--fg-subtle)">Priority</dt>
              <dd className="font-medium capitalize text-(--fg)">
                {revision.priority}
              </dd>
            </div>
          )}
          {revision.suggested_deadline && (
            <div>
              <dt className="text-(--fg-subtle)">Suggested deadline</dt>
              <dd className="font-medium text-(--fg)">
                {format(new Date(revision.suggested_deadline), "MMM d, yyyy h:mm a")}
              </dd>
            </div>
          )}
        </dl>

        {revision.reference_urls.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
              Reference URLs
            </p>
            {revision.reference_urls.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-(--fg-muted) hover:text-(--ring)"
              >
                <ExternalLink className="size-3" aria-hidden="true" />
                <span className="truncate">{l.label}</span>
              </a>
            ))}
          </div>
        )}

        {events.data && events.data.length > 0 && (
          <div className="space-y-1 border-t border-(--border) pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)">
              Routing trail
            </p>
            {events.data.map((e) => (
              <p key={e.id} className="flex items-center gap-1.5 text-xs text-(--fg-subtle)">
                <ArrowRight className="size-3" aria-hidden="true" />
                {e.action}
                {e.from_stage && e.to_stage && e.from_stage !== e.to_stage
                  ? ` · ${e.from_stage} → ${e.to_stage}`
                  : ""}
                {" · "}
                {e.created_at
                  ? format(new Date(e.created_at), "MMM d, h:mm a")
                  : "—"}
                {e.note ? ` — ${e.note}` : ""}
              </p>
            ))}
          </div>
        )}

        {isOwner && (
          <div className="flex flex-wrap gap-2 border-t border-(--border) pt-3">
            {!revision.acknowledged_at && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={acknowledge.isPending}
                onClick={() =>
                  acknowledge.mutate(revision.id, {
                    onSuccess: () => toast.success("Revision acknowledged."),
                    onError: (err) => toast.error(err.message),
                  })
                }
              >
                {acknowledge.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-4" aria-hidden="true" />
                )}
                Acknowledge
              </Button>
            )}
            {canForward && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setForwarding((v) => !v)}
              >
                Forward
              </Button>
            )}
          </div>
        )}

        {isOwner && canForward && forwarding && (
          <div className="space-y-2 rounded-lg border border-(--border) bg-(--surface) p-3">
            <Label htmlFor={`fwd-${revision.id}`}>
              Clarification for the next stage (optional — original
              instructions are preserved)
            </Label>
            <Textarea
              id={`fwd-${revision.id}`}
              rows={3}
              value={clarification}
              onChange={(e) => setClarification(e.target.value)}
              placeholder="Add context for the designer…"
            />
            <Button
              type="button"
              size="sm"
              disabled={forward.isPending}
              onClick={doForward}
              aria-busy={forward.isPending}
            >
              {forward.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {forward.isPending
                ? "Forwarding…"
                : `Forward to ${
                    revision.current_stage === "awaiting_organizer"
                      ? "Team Lead"
                      : "Designer"
                  }`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
