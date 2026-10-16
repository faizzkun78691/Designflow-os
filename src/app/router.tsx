import { Suspense, lazy, type ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { ProtectedRoute, RoleGuard } from "./guards";
import type { AppRole } from "../types";
import { PageLoader } from "../components/ui/page-loader";

// Eager: auth + shell (needed for first paint)
import RoleHome from "../pages/RoleHome";
import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import Unauthorized from "../pages/auth/Unauthorized";
import ConfigErrorPage from "../pages/auth/ConfigError";
import NotFound from "../pages/NotFound";

import OrganizerLayout from "../layouts/OrganizerLayout";
import TeamLeadLayout from "../layouts/TeamLeadLayout";
import DesignerLayout from "../layouts/DesignerLayout";
import SocialManagerLayout from "../layouts/SocialManagerLayout";

// Lazy: role pages (code-split per route for smaller initial bundle)
const OrganizerDashboard = lazy(() => import("../pages/organizer/Dashboard"));
const TeamManagement = lazy(() => import("../pages/organizer/TeamManagement"));
const AllTasks = lazy(() => import("../pages/organizer/AllTasks"));
const Approvals = lazy(() => import("../pages/organizer/Approvals"));
const PublishingTracker = lazy(() => import("../pages/organizer/PublishingTracker"));
const CommandCenter = lazy(() => import("../pages/organizer/CommandCenter"));
const OrganizerLeaderboard = lazy(() => import("../pages/organizer/Leaderboard"));
const RoleSettings = lazy(() => import("../pages/settings/RoleSettings"));

const LeadDashboard = lazy(() => import("../pages/lead/Dashboard"));
const CreatedTasks = lazy(() => import("../pages/lead/CreatedTasks"));
const Assignments = lazy(() => import("../pages/lead/Assignments"));
const Reviews = lazy(() => import("../pages/lead/Reviews"));
const LeadPerformance = lazy(() => import("../pages/lead/Performance"));

const DesignerDashboard = lazy(() => import("../pages/designer/Dashboard"));
const MyTasks = lazy(() => import("../pages/designer/MyTasks"));
const AvailableTasks = lazy(() => import("../pages/designer/AvailableTasks"));
const Revisions = lazy(() => import("../pages/designer/Revisions"));
const Submissions = lazy(() => import("../pages/designer/Submissions"));
const DesignerPerformance = lazy(() => import("../pages/designer/Performance"));
const DesignerLeaderboard = lazy(() => import("../pages/designer/Leaderboard"));

const SocialDashboard = lazy(() => import("../pages/social/Dashboard"));
const ReadyToPost = lazy(() => import("../pages/social/ReadyToPost"));
const Scheduled = lazy(() => import("../pages/social/Scheduled"));
const RevisionRequests = lazy(() => import("../pages/social/RevisionRequests"));
const PublishedArchive = lazy(() => import("../pages/social/PublishedArchive"));
const SocialCalendar = lazy(() => import("../pages/social/Calendar"));
const Studio = lazy(() => import("../pages/social/Studio"));
const PublishDetail = lazy(() => import("../pages/social/PublishDetail"));

const TaskNew = lazy(() => import("../pages/tasks/TaskNew"));
const TaskDetail = lazy(() => import("../pages/tasks/TaskDetail"));

function lazyPage(element: ReactElement) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

function withRole(allowed: AppRole[], layout: ReactElement) {
  return (
    <ProtectedRoute>
      <RoleGuard allowed={allowed}>{layout}</RoleGuard>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <RoleHome />
      </ProtectedRoute>
    ),
  },
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/unauthorized", element: <Unauthorized /> },
  { path: "/config-error", element: <ConfigErrorPage /> },
  {
    path: "/organizer",
    element: withRole(["organizer"], <OrganizerLayout />),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: lazyPage(<OrganizerDashboard />) },
      { path: "team", element: lazyPage(<TeamManagement />) },
      { path: "all-tasks", element: lazyPage(<AllTasks />) },
      { path: "tasks/new", element: lazyPage(<TaskNew />) },
      { path: "tasks/:taskId", element: lazyPage(<TaskDetail />) },
      { path: "approvals", element: lazyPage(<Approvals />) },
      { path: "publishing", element: lazyPage(<PublishingTracker />) },
      { path: "analytics", element: lazyPage(<CommandCenter />) },
      { path: "leaderboard", element: lazyPage(<OrganizerLeaderboard />) },
      { path: "settings", element: lazyPage(<RoleSettings />) },
    ],
  },
  {
    path: "/lead",
    element: withRole(["team_lead"], <TeamLeadLayout />),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: lazyPage(<LeadDashboard />) },
      { path: "created", element: lazyPage(<CreatedTasks />) },
      { path: "assignments", element: lazyPage(<Assignments />) },
      { path: "tasks/new", element: lazyPage(<TaskNew />) },
      { path: "tasks/:taskId", element: lazyPage(<TaskDetail />) },
      { path: "reviews", element: lazyPage(<Reviews />) },
      { path: "performance", element: lazyPage(<LeadPerformance />) },
      { path: "settings", element: lazyPage(<RoleSettings />) },
    ],
  },
  {
    path: "/designer",
    element: withRole(["designer"], <DesignerLayout />),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: lazyPage(<DesignerDashboard />) },
      { path: "my-tasks", element: lazyPage(<MyTasks />) },
      { path: "available", element: lazyPage(<AvailableTasks />) },
      { path: "tasks/:taskId", element: lazyPage(<TaskDetail />) },
      { path: "revisions", element: lazyPage(<Revisions />) },
      { path: "submissions", element: lazyPage(<Submissions />) },
      { path: "performance", element: lazyPage(<DesignerPerformance />) },
      { path: "leaderboard", element: lazyPage(<DesignerLeaderboard />) },
      { path: "settings", element: lazyPage(<RoleSettings />) },
    ],
  },
  {
    path: "/social",
    element: withRole(["social_media_manager"], <SocialManagerLayout />),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard", element: lazyPage(<SocialDashboard />) },
      { path: "studio", element: lazyPage(<Studio />) },
      { path: "studio/:recordId", element: lazyPage(<PublishDetail />) },
      { path: "ready", element: lazyPage(<ReadyToPost />) },
      { path: "scheduled", element: lazyPage(<Scheduled />) },
      { path: "revisions", element: lazyPage(<RevisionRequests />) },
      { path: "published", element: lazyPage(<PublishedArchive />) },
      { path: "calendar", element: lazyPage(<SocialCalendar />) },
      { path: "settings", element: lazyPage(<RoleSettings />) },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
