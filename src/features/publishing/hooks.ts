/**
 * DesignFlow OS Phase 4 — TanStack Query hooks for the Publishing Studio.
 *
 * Query key root: ["social", "publishing", ...]. Mutations invalidate
 * ["social"] and ["workflow"] and toast on success/error.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../components/ui/toaster";
import {
  getPublishingMetrics,
  getPublishingRecord,
  listPublishingEvents,
  listPublishingRecords,
  markPublished,
  requestPublishingChanges,
  schedulePublishing,
  transitionPublishingStatus,
} from "./services/publishing";
import type {
  MarkPublishedInput,
  PublishingStatus,
  PublishingTab,
  RequestPublishingChangesInput,
} from "./types";

const ROOT = "social";

function invalidateSocial(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: [ROOT] });
  // Publishing actions can change handoff / queue state for other roles.
  void client.invalidateQueries({ queryKey: ["workflow"] });
}

/* ------------------------------------------------------------------ */
/* queries                                                             */
/* ------------------------------------------------------------------ */

export function usePublishingMetrics(enabled = true) {
  return useQuery({
    queryKey: [ROOT, "publishing", "metrics"],
    queryFn: getPublishingMetrics,
    enabled,
  });
}

export function usePublishingRecords(status: PublishingTab, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "publishing", "records", status],
    queryFn: () => listPublishingRecords(status),
    enabled,
  });
}

export function usePublishingRecord(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "publishing", "record", id],
    queryFn: () => getPublishingRecord(id as string),
    enabled: enabled && !!id,
  });
}

export function usePublishingEvents(recordId: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "publishing", "events", recordId],
    queryFn: () => listPublishingEvents(recordId as string),
    enabled: enabled && !!recordId,
  });
}

/* ------------------------------------------------------------------ */
/* mutations                                                           */
/* ------------------------------------------------------------------ */

export function useTransitionPublishing() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      newStatus,
      note,
    }: {
      recordId: string;
      newStatus: PublishingStatus;
      note?: string | null;
    }) => transitionPublishingStatus(recordId, newStatus, note),
    onSuccess: () => {
      invalidateSocial(client);
      toast.success("Record status updated.");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not update status.");
    },
  });
}

export function useSchedulePublishing() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      scheduledAt,
      note,
    }: {
      recordId: string;
      scheduledAt: string;
      note?: string | null;
    }) => schedulePublishing(recordId, scheduledAt, note),
    onSuccess: () => {
      invalidateSocial(client);
      toast.success("Post scheduled.");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not schedule the post.");
    },
  });
}

export function useMarkPublished() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      input,
    }: {
      recordId: string;
      input: MarkPublishedInput;
    }) => markPublished(recordId, input),
    onSuccess: () => {
      invalidateSocial(client);
      toast.success("Marked as published.");
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error ? e.message : "Could not mark as published.",
      );
    },
  });
}

export function useRequestPublishingChanges() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      recordId,
      input,
    }: {
      recordId: string;
      input: RequestPublishingChangesInput;
    }) => requestPublishingChanges(recordId, input),
    onSuccess: (revisionId) => {
      invalidateSocial(client);
      toast.success(`Changes requested. Revision ID: ${revisionId}`);
    },
    onError: (e: unknown) => {
      toast.error(
        e instanceof Error ? e.message : "Could not request changes.",
      );
    },
  });
}
