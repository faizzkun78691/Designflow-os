/**
 * DesignFlow OS Phase 3 — TanStack Query hooks for the workflow engine.
 *
 * Query key root: ["workflow", ...] (invalidated by realtime + mutations).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import {
  acknowledgeRevision,
  approveAsOrganizer,
  approveAsTeamLead,
  forwardRevision,
  getLeadReviewQueue,
  getOrganizerReviewQueue,
  getSmmReadyQueue,
  listApprovals,
  listHandoffs,
  listMySubmissions,
  listOpenRevisions,
  listRoutingEvents,
  listSubmissions,
  listTaskRevisions,
  requestOrganizerRevision,
  requestSocialMediaRevision,
  requestTeamLeadRevision,
  resolveNames,
  submitDesign,
} from "./services/workflow";
import type {
  RequestRevisionInput,
  RevisionStage,
  SubmitDesignInput,
} from "./types";

const ROOT = "workflow";

function invalidateWorkflow(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: [ROOT] });
  // Task status changes ride along with workflow actions.
  void client.invalidateQueries({ queryKey: ["tasks"] });
}

/* ------------------------------------------------------------------ */
/* queues                                                              */
/* ------------------------------------------------------------------ */

export function useLeadQueue(enabled = true) {
  return useQuery({
    queryKey: [ROOT, "leadQueue"],
    queryFn: getLeadReviewQueue,
    enabled,
  });
}

export function useOrganizerQueue(enabled = true) {
  return useQuery({
    queryKey: [ROOT, "organizerQueue"],
    queryFn: getOrganizerReviewQueue,
    enabled,
  });
}

export function useSmmQueue(enabled = true) {
  return useQuery({
    queryKey: [ROOT, "smmQueue"],
    queryFn: getSmmReadyQueue,
    enabled,
  });
}

/* ------------------------------------------------------------------ */
/* submissions / approvals / revisions / handoffs                      */
/* ------------------------------------------------------------------ */

export function useSubmissions(taskId: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "submissions", taskId],
    queryFn: () => listSubmissions(taskId as string),
    enabled: enabled && !!taskId,
  });
}

export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [ROOT, "mySubmissions", user?.id],
    queryFn: () => listMySubmissions(user?.id as string),
    enabled: !!user?.id,
  });
}

export function useApprovals(submissionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "approvals", submissionId],
    queryFn: () => listApprovals(submissionId as string),
    enabled: enabled && !!submissionId,
  });
}

export function useOpenRevisions(taskId?: string, withTaskMeta = true) {
  return useQuery({
    queryKey: [ROOT, "openRevisions", taskId ?? "all", withTaskMeta],
    queryFn: () => listOpenRevisions(taskId, { withTaskMeta }),
  });
}

/** Open revisions sitting at one routing stage (RLS-scoped to the caller). */
export function useOpenRevisionsByStage(stage: RevisionStage) {
  return useQuery({
    queryKey: [ROOT, "openRevisionsByStage", stage],
    queryFn: () => listOpenRevisions(undefined, { stage }),
  });
}

export function useTaskRevisions(taskId: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "taskRevisions", taskId],
    queryFn: () => listTaskRevisions(taskId as string),
    enabled: enabled && !!taskId,
  });
}

export function useRoutingEvents(revisionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [ROOT, "routingEvents", revisionId],
    queryFn: () => listRoutingEvents(revisionId as string),
    enabled: enabled && !!revisionId,
  });
}

export function useHandoffs() {
  return useQuery({
    queryKey: [ROOT, "handoffs"],
    queryFn: listHandoffs,
    // Publishing handoffs change via organizer approval; always refetch on
    // mount so the tracker never shows a stale empty list after navigation.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/* ------------------------------------------------------------------ */
/* mutations                                                           */
/* ------------------------------------------------------------------ */

export function useSubmitDesign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: SubmitDesignInput;
    }) => submitDesign(taskId, input),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useApproveAsTeamLead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      comment,
    }: {
      submissionId: string;
      comment?: string | null;
    }) => approveAsTeamLead(submissionId, comment),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useRequestTeamLeadRevision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      input,
    }: {
      submissionId: string;
      input: RequestRevisionInput;
    }) => requestTeamLeadRevision(submissionId, input),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useApproveAsOrganizer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      comment,
    }: {
      submissionId: string;
      comment?: string | null;
    }) => approveAsOrganizer(submissionId, comment),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useRequestOrganizerRevision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      input,
    }: {
      submissionId: string;
      input: RequestRevisionInput;
    }) => requestOrganizerRevision(submissionId, input),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useRequestSocialMediaRevision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      handoffId,
      input,
    }: {
      handoffId: string;
      input: RequestRevisionInput;
    }) => requestSocialMediaRevision(handoffId, input),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useAcknowledgeRevision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) => acknowledgeRevision(revisionId),
    onSuccess: () => invalidateWorkflow(client),
  });
}

export function useForwardRevision() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      revisionId,
      clarification,
    }: {
      revisionId: string;
      clarification?: string | null;
    }) => forwardRevision(revisionId, clarification),
    onSuccess: () => invalidateWorkflow(client),
  });
}

/**
 * Resolve display names for a batch of user ids (designers, leads).
 * The key is derived from the sorted ids so the query is stable.
 */
export function useNames(ids: string[], enabled = true) {
  const sortedKey = [...ids].sort().join(",");
  return useQuery({
    queryKey: [ROOT, "names", sortedKey],
    queryFn: () =>
      resolveNames(sortedKey ? sortedKey.split(",") : []),
    enabled: enabled && sortedKey.length > 0,
  });
}
