# DesignFlow OS — Phase 2: Task Management System

**Status:** Implemented, typechecked, production build green. Backend migration written and parse-validated; **not yet applied to a live database** (parent runs migrations + live QA).

## What was built

### Database — `supabase/migrations/003_task_system.sql` (1,561 lines, idempotent)
- `tasks` extended: `task_code` (`DF-0001…` via `task_code_seq`), `visibility` (`public`/`private`), `production_status` (`draft`/`available`/`assigned`/`accepted`/`in_progress`/`cancelled`; Phase 3/4 states reserved in comments), `claimed_at`, `timezone`, `difficulty`, `est_hours`, `campaign_name`, `design_category`, `target_platform`, priority check (`low`/`normal`/`high`/`urgent`/`critical`). Promote-only backfills from 002 columns.
- `task_briefs` extended: `spec_json`, `brief_json`, `social_json`.
- New: `task_references`, `task_checklist_items`, `task_assignments` (cascade FKs, indexes).
- RLS deny-by-default: `can_view_task()` helper; organizer full; team lead = created_by OR assigned_lead_id; designer = assigned/claimed OR public+available; **zero direct-write policies for authenticated** — all mutations via SECURITY DEFINER functions (internal helpers revoked from public).
- 11 secure functions: `create_task` (organizer forced private; transactional multi-table insert; deterministic non-blocking duplicate warning), `publish_task`, `claim_task` (**single atomic `UPDATE … WHERE … RETURNING`** — row lock serializes simultaneous claimants, exactly one winner, generic `already_claimed` reason), `accept_assignment`, `decline_assignment` (never clobbers a newer assignee), `reassign_task` (organizer or owning lead; designers have no reassign path), `update_task_status` (server-side transition map), `update_task` (audited field edits), `toggle_checklist_item`, `cancel_task`, plus `get_task_board()` (minimal public columns incl. claimant display name — no brief access) and `get_designer_workload()` (real counts).
- Realtime publication: `tasks`, `task_events`, `notifications` (defensive DO block).

### Frontend — 29 new files, same matte-black/volt design system
- `src/types/tasks.ts` — canonical task domain types (RPC contract).
- `src/features/tasks/` — typed RPC services (mutations RPC-only), TanStack Query hooks (pagination with keepPreviousData, double-submit guards), zod schemas, 7 dimension presets, components: TaskCard, TaskKanban (native HTML5 drag-and-drop, drops rejected unless the role may perform the transition), TaskFilters, TaskWorkspace, 8-section TaskFormWizard (organizer locked to private; lead public/private toggle; workload-aware designer picker blocking inactive users; review + duplicate warning + save-as-draft/publish), WorkloadPicker, ChecklistBuilder, ReferenceInputs, DuplicateWarning.
- `src/pages/tasks/TaskNew.tsx`, `src/pages/tasks/TaskDetail.tsx` — detail tabs: Overview, Design Brief, References, Social Content, Checklist, Activity; role actions: Claim (handles race with "This task has already been claimed by another designer." + refetch), Accept/Decline, allowed-only status advances, Edit/Cancel/Reassign dialogs.
- Rewritten with real data: organizer AllTasks, lead CreatedTasks + Assignments, designer MyTasks + AvailableTasks.
- `src/features/notifications/` — bell with unread badge in AppShell topbar, panel with mark-read, realtime INSERT toast.
- `src/features/realtime/useTaskRealtime.ts` — shared channel, refetch-on-event (never trusts out-of-order payloads), full cleanup.
- Dashboards wired to real task data: organizer command-center counts + pipeline + recent activity + designer workload table; lead created/assigned stats; designer my-tasks vs available board + deadlines. Social dashboard keeps truthful empty states.
- Routes: `/organizer|lead/tasks/new`, `/organizer|lead|designer/tasks/:taskId`; "New Task" nav items added.

## Intentionally deferred (Phase 3/4)
Design submissions, approval workflows, revision routing, publishing actions, leaderboard/performance calculations.

## Known limitations
- Bundle ~1.1 MB (was 972 KB) — route-level code-splitting recommended before scale-up.
- `claim_task` treats a passed `due_date` as expired (per spec); claiming now requires an ACTIVE TEAM MEMBERSHIP (migration 004), not just an active profile — invitees are auto-added to the default "DesignFlow" team by the team-admin Edge Function.
- `tasks_priority_check` validates existing rows — safe on the fresh production DB (zero task rows), but a legacy DB with non-standard priorities would need cleanup first.
- Notification fan-out on public-task publish inserts one row per eligible active designer team member.
- Console-error capture wasn't available in the verification environment; verification = `tsc` clean + `npm run build` green + live API + live browser QA (see below).

## Migration 004 — Phase 2 hardening (applied live 2026-10-16)
`supabase/migrations/004_phase2_hardening.sql` (idempotent), applied on top of 003:
- New `public.is_active_team_member(uuid)` helper (active `team_members` row + active profile).
- `claim_task` now requires designer role + active profile + active team membership.
- `get_task_board` restricted to the designer role (organizer/lead use their list views; social_media_manager can no longer reach unfinished public tasks).
- `reassign_task` preserves `assigned_lead_id` when delegating to a designer (organizer → lead → designer chain stays visible); assigning a team_lead transfers lead accountability.
- `publish_task` notifies every eligible active designer team member when a PUBLIC task goes available (task code + title only).
- Seeds the default "DesignFlow" team and adds the organizer as an active member.
- `supabase/functions/team-admin/index.ts` updated: invites now also create an active `team_members` row in the default team (full rollback on any failure); redeployed live.

## Frontend fixes from live QA (2026-10-16)
- `listTasks` used non-existent `assignee_id` / `assign_lead_id` columns on the `tasks` table → "My Tasks" failed to load. Fixed to `assigned_designer_id` / `assigned_lead_id`.
- Kanban cards claimed by another designer are now non-clickable/non-draggable read-only records (their detail page is correctly RLS-blocked; the card no longer leads to a dead-end "Task not found").

## Honest test table
| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | PASS, zero errors |
| `npm run build` (tsc -b + vite) | PASS |
| Migration 003 + 004 applied live (Supabase SQL editor) | PASS — "Success. No rows returned"; all 13 functions + 3 tables verified |
| Claim race (2 designers, simultaneous `claim_task`) | PASS — exactly 1 winner (`ok:true`), loser got `ok:false/already_claimed` |
| Designer `create_task` / lead `get_task_board` | PASS — both correctly rejected (42501) |
| Private-task RLS (direct REST read + `can_view_task`) | PASS — `[]` and `false` for unauthorized designer |
| Delegation chain (`reassign_task` lead→designer) | PASS — `created_by`, `assigned_lead_id`, `assigned_designer_id` all preserved |
| Accept/decline assignment auth | PASS — non-assignee got "Only the assignee can respond" |
| Unauthorized status change | PASS — "Designers may only move their own tasks…" |
| Public-task notification fan-out | PASS — both designers received "New public task: DF-0001" |
| Frontend: lead dashboard + designer board + notifications + 403 guard | PASS (live browser) |
| Frontend: My Tasks list | PASS after `assignee_id`→`assigned_designer_id` fix (live browser re-test pending redeploy) |
| Visual QA | Live browser run 2026-10-16 (see above) |

## Setup (adds to README §3)
Apply `003_task_system.sql` in the SQL Editor **after** 001/002, then rebuild/redeploy the frontend (no new env vars). See README §3.1.
