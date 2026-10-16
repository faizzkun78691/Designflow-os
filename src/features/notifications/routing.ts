/**
 * Maps a notification to the app route it should open.
 *
 * Phase 3 backend notifications (migration 005) all carry
 * entity_type='task' + entity_id=<task_id>; the title identifies the
 * workflow event. Titles are matched case-insensitively by prefix.
 */
import type { AppRole } from "../../types";
import type { AppNotification } from "../dashboard/types";

function roleBase(role: AppRole | null): string {
  switch (role) {
    case "organizer":
      return "/organizer";
    case "team_lead":
      return "/lead";
    case "designer":
      return "/designer";
    case "social_media_manager":
      return "/social";
    default:
      return "";
  }
}

export function notificationRoute(
  n: AppNotification,
  role: AppRole | null,
): string {
  const title = (n.title ?? "").toLowerCase();
  const taskId = n.entity_type === "task" ? n.entity_id : null;
  const publishingId = n.entity_type === "publishing" ? n.entity_id : null;

  // Phase 4 publishing events → the publishing detail / tracker surface.
  if (publishingId) {
    if (role === "social_media_manager")
      return `/social/studio/${publishingId}`;
    if (role === "organizer") return "/organizer/publishing";
    if (role === "team_lead") return "/lead/performance";
    if (role === "designer") return "/designer/submissions";
  }
  if (title.startsWith("published:")) {
    if (role === "social_media_manager") return "/social/published";
    if (role === "organizer") return "/organizer/publishing";
  }
  if (title.startsWith("overdue post:")) {
    if (role === "social_media_manager") return "/social/calendar";
    if (role === "organizer") return "/organizer/publishing";
  }
  if (title.startsWith("publishing ")) {
    if (role === "social_media_manager") return "/social/studio";
    if (role === "organizer") return "/organizer/publishing";
  }

  // Phase 3 workflow events → the responsible review surface.
  if (title.startsWith("content ready for publishing"))
    return "/social/ready";
  if (title.startsWith("design submitted for review")) return "/lead/reviews";
  if (
    title.startsWith("submission awaiting organizer review") ||
    title.startsWith("design submitted (no lead assigned)")
  )
    return "/organizer/approvals";
  if (title.startsWith("revision requested by social media"))
    return "/organizer/approvals";
  if (title.startsWith("revision requested")) return "/designer/revisions";
  if (title.startsWith("revision forwarded to you")) {
    switch (role) {
      case "organizer":
        return "/organizer/approvals";
      case "team_lead":
        return "/lead/reviews";
      case "designer":
        return "/designer/revisions";
      case "social_media_manager":
        return "/social/revisions";
      default:
        break;
    }
  }
  if (title.startsWith("design approved")) return "/designer/submissions";

  // Fallback: the task detail page for the viewer's role.
  const base = roleBase(role);
  if (taskId && base && role !== "social_media_manager")
    return `${base}/tasks/${taskId}`;
  if (taskId && role === "social_media_manager") return "/social/ready";
  if (base) return `${base}/dashboard`;
  return "/";
}
