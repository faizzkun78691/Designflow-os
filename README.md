# DesignFlow OS — Phase 1

A premium, secure, mobile-responsive **Design Team Production and Approval Management System** — Phase 1: production-ready foundation, authentication, role-based dashboards, and Supabase architecture.

**Stack:** React 19 + TypeScript (strict) + Vite · Tailwind CSS v4 (CSS-first theme) · react-router-dom · TanStack Query · react-hook-form + Zod · Supabase (Auth, PostgreSQL, RLS, Storage, Edge Functions) · Framer Motion · Lucide icons · date-fns.

---

## 1. Prerequisites

- Node.js 20+
- A Supabase project (create one at [supabase.com](https://supabase.com) → **New project**)
- Supabase CLI (only needed to deploy the Edge Function): `npm i -g supabase`

## 2. Installation

```bash
cd designflow-os
npm install
cp .env.example .env
```

Edit `.env` with your project's values (Supabase Dashboard → **Project Settings → API**):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

> Only the **anon public key** is used in the browser. The **service-role key** is never committed and never shipped to the frontend — it lives only as a secret on the `team-admin` Edge Function.

If either variable is missing, the app renders a configuration screen naming the missing variable names (never their values).

```bash
npm run dev      # local dev server
npm run build    # tsc -b && vite build (must pass with zero errors)
npm run preview  # preview the production build
```

## 3. Supabase setup

### 3.1 Apply the migrations

Supabase Dashboard → **SQL Editor** → **New query**, then run in order:

1. Paste the contents of `supabase/migrations/001_foundation.sql` → **Run**
2. Paste the contents of `supabase/migrations/002_future_workflow_schema.sql` → **Run**
3. Paste the contents of `supabase/migrations/003_task_system.sql` → **Run**
4. Paste the contents of `supabase/migrations/004_phase2_hardening.sql` → **Run**

`003` builds the Phase 2 task system on top of `001`/`002` without touching existing data:

- Extends `tasks` (`task_code` via `task_code_seq` → `DF-0001…`, `visibility`, `production_status`, `claimed_at`, campaign/category/platform fields, priority check)
- Extends `task_briefs` (`spec_json`, `brief_json`, `social_json`)
- New tables: `task_references`, `task_checklist_items`, `task_assignments`
- `can_view_task()` helper + deny-by-default RLS (organizer full; team lead scoped; designer scoped; **no direct writes for authenticated clients — all mutations go through SECURITY DEFINER functions**)
- 11 secure functions: `create_task`, `publish_task`, `claim_task` (**atomic** conditional `UPDATE … RETURNING` — exactly one winner on simultaneous claims), `accept_assignment`, `decline_assignment`, `reassign_task`, `update_task_status` (server-side transition map), `update_task`, `toggle_checklist_item`, `cancel_task`, plus `get_task_board()` (privacy-safe claim board) and `get_designer_workload()`
- Adds `tasks`, `task_events`, `notifications` to the `supabase_realtime` publication

What `001` creates:

- `app_role` enum (`organizer`, `team_lead`, `designer`, `social_media_manager`)
- `profiles`, `user_roles`, `teams`, `team_members`, `system_audit_logs`
- `updated_at` trigger + a **BEFORE UPDATE trigger that rejects changes to `email`, `is_active`, `designation` by any non-service-role caller**
- SECURITY DEFINER helpers (`current_user_role()`, `is_organizer()`, `is_team_member()`, `get_employee_directory()`) with fixed `search_path`
- Deny-by-default RLS on every table (see §6)
- The public `avatars` storage bucket with per-user folder isolation (`<auth.uid()>/*`)

`002` creates the Phase 2+ workflow tables (`tasks`, `task_briefs`, `task_submissions`, `task_approvals`, `revision_requests`, `task_events`, `publishing_records`, `notifications`, `performance_metrics`) — DDL only, deny-by-default, organizer-readable so dashboards show truthful zero-states.

### 3.2 Deploy the Edge Function

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase functions deploy team-admin
```

See `supabase/functions/team-admin/README.md` for full details.

### 3.3 Auth configuration (Dashboard → Authentication)

- **URL Configuration → Site URL:** your app URL (e.g. `https://your-app.netlify.app`; locally `http://localhost:5173`)
- **Redirect URLs:** add `https://your-app.netlify.app/reset-password` (and the localhost equivalent) — required for password-reset links
- **Email Templates → Invite user:** enable/customize — the organizer invitation flow sends this email

### 3.4 Seed the first Organizer

There is **no public signup** — accounts are created by the Organizer. To bootstrap:

1. Dashboard → **Authentication → Users → Add user** → enter the organizer's email + password, check **Auto Confirm user**, copy the generated **UUID**
2. Open `supabase/seed_first_organizer.sql`, replace the `<PASTE_UUID>`, `<FULL_NAME>`, `<EMAIL>` placeholders, and run it in the SQL Editor

The organizer can then sign in at `/login` and invite the rest of the team from **Team Management**.

## 4. Netlify deployment

The repo ships with `netlify.toml`:

- Build command `npm run build`, publish directory `dist`
- SPA fallback: `/* → /index.html` (status 200) so deep links work
- Immutable caching for `/assets/*`, basic security headers

In Netlify: **Add new site → Import from Git** (or drag the `dist/` folder into [Netlify Drop](https://app.netlify.com/drop)), then set the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Site settings → Environment variables**, and redeploy.

## 5. Roles & routes

| Role | Home | Sections |
|---|---|---|
| Organizer | `/organizer/dashboard` | Command Center, All Tasks, **New Task** (`/organizer/tasks/new`), Task detail (`/organizer/tasks/:taskId`), Approvals, Publishing Tracker, Team Management, Analytics, Settings |
| Team Lead | `/lead/dashboard` | Design Operations, My Created Tasks, **New Task** (`/lead/tasks/new`), Task detail (`/lead/tasks/:taskId`), Organizer Assignments, Reviews, Team Performance, Settings |
| Designer | `/designer/dashboard` | Design Studio, My Tasks, Available Tasks, Task detail (`/designer/tasks/:taskId`), Revisions, Submissions, My Performance, Settings |
| Social Media Manager | `/social/dashboard` | Publishing Studio, Ready to Post, Scheduled, Revision Requests, Published Archive, Calendar, Settings |

**Phase 2 task workflows:** task creation wizard (8 sections: basic, assignment, spec, brief, references, social, checklist, review), list + Kanban workspace (native drag-and-drop gated by authorized transitions), task detail tabs (Overview, Brief, References, Social, Checklist, Activity), atomic public claiming, accept/decline assignments, reassign, server-validated status engine (`draft → available → assigned → accepted → in_progress → cancelled`), duplicate-warning on create, workload-aware assignment picker, in-app notifications bell with realtime updates. See `PHASE2_NOTES.md`.

After login each role is redirected to its own dashboard. `ProtectedRoute` + `RoleGuard` enforce this on the client, and **Row Level Security enforces it in the database** — typing another role's URL never grants access.

## 6. Security model (summary)

- **Deny-by-default RLS** on all 14 tables; policies grant only the minimum (own row, own team, organizer scope).
- Roles live in `user_roles` in the database and are fetched server-side on every session — never trusted from `localStorage` or frontend state.
- `user_roles` has **no direct insert/update/delete policies** for clients and its policies never call helper functions (no recursion); organizers read roles via the `get_employee_directory()` SECURITY DEFINER function.
- A database trigger blocks non-service-role changes to `profiles.email`, `profiles.is_active`, `profiles.designation`.
- Audit logs are **append-only** for clients (insert own actions, organizer reads all).
- Employee invitation/activation runs in the `team-admin` Edge Function with the service-role key: server-side organizer check, input validation, duplicate handling, rollback on partial failure, self-deactivation and last-organizer guards.
- Avatar uploads go to the `avatars` bucket under the user's own folder only.
- No privileged keys, no credentials, and no sensitive row data in frontend logs.

## 7. Project structure

```
src/
  app/            router, ProtectedRoute, RoleGuard
  components/ui/  hand-rolled shadcn-style kit (button, dialog, table, toaster, …)
  contexts/       AuthProvider (session + DB role)
  features/       per-role dashboard services & hooks, organizer invite dialog
  hooks/          (shared hooks)
  integrations/supabase/  client singleton + env validation
  layouts/        AppShell + 4 role layouts (collapsible sidebar / mobile drawer)
  pages/          auth pages, per-role dashboards & sections, shared settings
  services/       typed data services (profiles, teams, teamAdmin)
  types/          domain types
  utils/          cn(), role helpers
supabase/
  migrations/     001_foundation.sql, 002_future_workflow_schema.sql, 003_task_system.sql, 004_phase2_hardening.sql
  functions/team-admin/  invite + set_active Edge Function
  seed_first_organizer.sql
```

## 8. What's intentionally deferred

Phase 2 (task claiming/assignment, Drive-link submissions), Phase 3 (approval & revision workflows), Phase 4 (publishing actions, leaderboard/analytics calculations). Sections belonging to later phases render professional empty states with a **"Coming in Phase N"** badge — never fake data. See `PHASE1_REPORT.md` for the full accounting.
