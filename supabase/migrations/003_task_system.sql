-- ============================================================================
-- DesignFlow OS — Migration 003: Task System (Phase 2)
-- Extends 001 (foundation) and 002 (future workflow schema) without
-- destroying data. Postgres 15 / Supabase compatible.
-- Idempotent: safe to re-run (IF NOT EXISTS / DROP IF EXISTS guards,
-- conditional backfills, existence-checked constraints).
--
-- Security model summary:
--   * All task tables are deny-by-default under RLS.
--   * Authenticated clients get SELECT-only policies; there are NO
--     insert/update/delete policies for authenticated on the task tables.
--   * Every mutation goes through a SECURITY DEFINER function (fixed
--     search_path = public) that validates auth.uid(), the caller's
--     application role, and profiles.is_active FIRST, then performs the
--     write while bypassing RLS, and finally writes a task_events audit
--     row (+ notifications where specified).
--   * Internal helpers (prefixed _) are SECURITY DEFINER but have EXECUTE
--     revoked from PUBLIC so they cannot be abused directly; only the
--     public API functions are granted to `authenticated`.
-- ============================================================================

-- ============================================================================
-- 1. Extend public.tasks
-- ============================================================================

alter table public.tasks
  add column if not exists task_code         text,
  add column if not exists visibility        text        not null default 'private',
  add column if not exists production_status text        not null default 'draft',
  add column if not exists claimed_at        timestamptz,
  add column if not exists timezone          text,
  add column if not exists difficulty        text,
  add column if not exists est_hours         numeric,
  add column if not exists campaign_name     text,
  add column if not exists design_category   text,
  add column if not exists target_platform   text;

comment on column public.tasks.task_code is 'Human-friendly unique code, e.g. DF-0001, minted by next_task_code().';
comment on column public.tasks.visibility is 'public = claimable from the task board; private = visible only to involved parties.';
comment on column public.tasks.production_status is 'Phase 2 lifecycle: draft, available, assigned, accepted, in_progress, cancelled. Reserved for Phase 3/4 (not yet in the check constraint): submitted_for_review, team_lead_review, organizer_review, revision_required, approved_for_publishing, scheduled, published.';
comment on column public.tasks.claimed_at is 'When the task was claimed from the public board.';
comment on column public.tasks.timezone is 'Requester timezone label for due-date interpretation.';
comment on column public.tasks.difficulty is 'Free-text difficulty hint (e.g. easy/medium/hard).';
comment on column public.tasks.est_hours is 'Estimated effort in hours.';
comment on column public.tasks.campaign_name is 'Campaign grouping, used by duplicate detection.';
comment on column public.tasks.design_category is 'Design category grouping, used by duplicate detection.';
comment on column public.tasks.target_platform is 'Target platform grouping, used by duplicate detection.';

-- Backfill visibility from 002's task_type (promote-only: never demotes a row
-- that already moved to public via the new API).
update public.tasks
   set visibility = 'public'
 where task_type = 'public'
   and visibility is distinct from 'public';

-- Backfill production_status from 002's status (only touches rows still on
-- the legacy default, so explicit Phase 2 states are never clobbered).
update public.tasks
   set production_status = 'available'
 where status = 'unclaimed'
   and production_status = 'draft';

-- Check constraints (added only if missing; existing rows were backfilled above).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_visibility_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_production_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_production_status_check
      check (production_status in (
        'draft', 'available', 'assigned', 'accepted', 'in_progress', 'cancelled'
      ));
    -- Phase 3/4 states are intentionally NOT in this list yet:
    -- submitted_for_review, team_lead_review, organizer_review,
    -- revision_required, approved_for_publishing, scheduled, published.
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent', 'critical'));
  end if;
end
$$;

-- Task code sequence + minter.
create sequence if not exists public.task_code_seq;
comment on sequence public.task_code_seq is 'Backs next_task_code(); yields DF-0001, DF-0002, ...';

create or replace function public.next_task_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'DF-' || lpad(nextval('public.task_code_seq')::text, 4, '0');
$$;
comment on function public.next_task_code() is 'Mints the next human-friendly task code (DF-0001, ...). Called by create_task(); SECURITY DEFINER so the sequence is usable through the API.';

-- Backfill codes for rows that predate the column (fills nulls only).
update public.tasks
   set task_code = public.next_task_code()
 where task_code is null;

-- Unique constraint on task_code (added only if missing).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_task_code_unique'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_task_code_unique unique (task_code);
  end if;
end
$$;

-- Indexes (002's indexes are kept; these are additive).
create index if not exists idx_tasks_task_code
  on public.tasks (task_code);
create index if not exists idx_tasks_visibility_production_status
  on public.tasks (visibility, production_status);

-- ============================================================================
-- 2. Extend public.task_briefs
-- ============================================================================

alter table public.task_briefs
  add column if not exists spec_json   jsonb not null default '{}',
  add column if not exists brief_json  jsonb not null default '{}',
  add column if not exists social_json jsonb not null default '{}';

comment on column public.task_briefs.spec_json is 'Structured design specification payload.';
comment on column public.task_briefs.brief_json is 'Structured creative brief payload.';
comment on column public.task_briefs.social_json is 'Social/publishing metadata payload (consumed in later phases).';

-- ============================================================================
-- 3. New tables: task_references, task_checklist_items, task_assignments
-- ============================================================================

create table if not exists public.task_references (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks(id) on delete cascade,
  label      text        not null,
  url        text        not null,
  kind       text,
  created_at timestamptz not null default now()
);
comment on table public.task_references is 'Reference links attached to a task brief. Readable by anyone who can view the task; writable only via create_task() (SECURITY DEFINER). No direct writes for authenticated clients.';

create table if not exists public.task_checklist_items (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks(id) on delete cascade,
  label      text        not null,
  sort_order integer     not null default 0,
  is_done    boolean     not null default false,
  created_at timestamptz not null default now()
);
comment on table public.task_checklist_items is 'Per-task checklist. Readable by anyone who can view the task; toggled only via toggle_checklist_item() (SECURITY DEFINER). No direct writes for authenticated clients.';

create table if not exists public.task_assignments (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        not null references public.tasks(id) on delete cascade,
  assignee_id  uuid        references public.profiles(id),
  assigned_by  uuid        references public.profiles(id),
  status       text        not null default 'assigned'
               check (status in ('assigned', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
comment on table public.task_assignments is 'Assignment offers for a task (designer or delegated team lead). One row per offer; superseded offers are marked declined. Readable by task viewers and the assignee; written only via create_task()/reassign_task()/accept_assignment()/decline_assignment() (SECURITY DEFINER). No direct writes for authenticated clients.';

create index if not exists idx_task_references_task_id
  on public.task_references (task_id);
create index if not exists idx_task_checklist_items_task_id
  on public.task_checklist_items (task_id);
create index if not exists idx_task_assignments_task_id
  on public.task_assignments (task_id);
create index if not exists idx_task_assignments_assignee_id
  on public.task_assignments (assignee_id);
create index if not exists idx_task_assignments_task_status
  on public.task_assignments (task_id, status);

alter table public.task_references     enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_assignments    enable row level security;

-- ============================================================================
-- 4. Internal helpers (SECURITY DEFINER, fixed search_path).
-- EXECUTE is revoked from PUBLIC below: they must only run inside the
-- public API functions defined later in this migration.
-- ============================================================================

-- Gate: caller must be authenticated, have an active profile, hold a role,
-- and (optionally) hold one of the allowed roles. Raises on failure.
create or replace function public._require_task_caller(p_allowed app_role[] default null)
returns app_role
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid    uuid := auth.uid();
  v_active boolean;
  v_role   app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select p.is_active into v_active
    from public.profiles p
   where p.id = v_uid;
  if v_active is null or not v_active then
    raise exception 'An active profile is required.' using errcode = '28000';
  end if;

  v_role := public.current_user_role();
  if v_role is null then
    raise exception 'No application role assigned.' using errcode = '42501';
  end if;

  if p_allowed is not null and not (v_role = any (p_allowed)) then
    raise exception 'Role % is not permitted for this operation.', v_role
      using errcode = '42501';
  end if;

  return v_role;
end;
$$;
comment on function public._require_task_caller(app_role[]) is 'Internal gate for task API functions: validates auth.uid(), active profile, role, and optional role allow-list. Raises on failure. Not granted to clients.';

-- Internal notification insert (there is no direct-insert RLS policy for
-- authenticated on notifications; API functions reach this via definer).
create or replace function public._insert_notification(
  p_user_id     uuid,
  p_title       text,
  p_body        text,
  p_entity_type text default null,
  p_entity_id   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, title, body, entity_type, entity_id)
  values (p_user_id, p_title, p_body, p_entity_type, p_entity_id);
end;
$$;
comment on function public._insert_notification(uuid, text, text, text, text) is 'Internal: inserts a notification row. No-op for null recipients. Not granted to clients; called only from SECURITY DEFINER API functions.';

-- Internal audit writer (no direct-insert RLS policy for authenticated on
-- task_events; API functions reach this via definer).
create or replace function public._log_task_event(
  p_task_id    uuid,
  p_event_type text,
  p_metadata   jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_events (task_id, actor_id, event_type, metadata)
  values (p_task_id, auth.uid(), p_event_type, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
comment on function public._log_task_event(uuid, text, jsonb) is 'Internal: appends a task_events audit row with actor_id = auth.uid(). Not granted to clients; called only from SECURITY DEFINER API functions.';

-- Normalizes a possibly-missing / JSON-null payload member to '{}'.
create or replace function public._jsonb_or_empty(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then '{}'::jsonb
    else p_value
  end;
$$;
comment on function public._jsonb_or_empty(jsonb) is 'Internal: maps SQL NULL and JSON null to an empty object. Pure function, no table access.';

-- Lock down the internal helpers: no direct execution by clients.
revoke all on function public._require_task_caller(app_role[]) from public;
revoke all on function public._insert_notification(uuid, text, text, text, text) from public;
revoke all on function public._log_task_event(uuid, text, jsonb) from public;
revoke all on function public._jsonb_or_empty(jsonb) from public;

-- ============================================================================
-- 5. Visibility helper: public.can_view_task
-- SECURITY DEFINER so it can read tasks/user_roles while bypassing RLS;
-- this is what makes it safe to call from RLS policies without recursion
-- (it only SELECTs from tasks and user_roles, never from a table whose
-- policy invokes it, other than tasks itself — and that inner SELECT runs
-- as the definer, outside RLS).
-- ============================================================================

create or replace function public.can_view_task(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.tasks t
     where t.id = p_task_id
       and (
         public.is_organizer()
         or t.created_by           = auth.uid()
         or t.assigned_lead_id     = auth.uid()
         or t.assigned_designer_id = auth.uid()
         or t.claimed_by           = auth.uid()
         or (t.visibility = 'public' and t.production_status = 'available')
       )
  );
$$;
comment on function public.can_view_task(uuid) is 'True when the caller may see a task: organizer, creator, assigned lead, assigned designer, claimant, or anyone for public+available tasks. SECURITY DEFINER with fixed search_path; safe to call from RLS policies (no policy recursion: inner SELECTs bypass RLS as the definer).';

revoke all on function public.can_view_task(uuid) from public;
grant execute on function public.can_view_task(uuid) to authenticated;

-- ============================================================================
-- 6. RLS policies — deny by default.
-- First drop the 002 organizer-select policy on tasks (superseded below).
-- 002's future_*_organizer_select policies on the other workflow tables are
-- left untouched; the new policies below are additive for organizers.
-- ============================================================================

drop policy if exists "future_tasks_organizer_select" on public.tasks;

-- tasks: organizer full access; scoped SELECT for leads/designers; no
-- insert/update/delete policies for authenticated (mutations via functions).
drop policy if exists "tasks_organizer_all" on public.tasks;
create policy "tasks_organizer_all" on public.tasks
  for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

drop policy if exists "tasks_select_lead" on public.tasks;
create policy "tasks_select_lead" on public.tasks
  for select to authenticated
  using (
    public.current_user_role() = 'team_lead'
    and (created_by = auth.uid() or assigned_lead_id = auth.uid())
  );

drop policy if exists "tasks_select_designer" on public.tasks;
create policy "tasks_select_designer" on public.tasks
  for select to authenticated
  using (
    public.current_user_role() = 'designer'
    and (
      assigned_designer_id = auth.uid()
      or claimed_by = auth.uid()
      or (visibility = 'public' and production_status = 'available')
    )
  );
-- Note: no INSERT/UPDATE/DELETE policies for authenticated on tasks.

-- task_briefs / references / checklist: SELECT where the task is viewable.
drop policy if exists "task_briefs_select_viewer" on public.task_briefs;
create policy "task_briefs_select_viewer" on public.task_briefs
  for select to authenticated
  using (public.can_view_task(task_id));

drop policy if exists "task_references_select_viewer" on public.task_references;
create policy "task_references_select_viewer" on public.task_references
  for select to authenticated
  using (public.can_view_task(task_id));

drop policy if exists "task_checklist_items_select_viewer" on public.task_checklist_items;
create policy "task_checklist_items_select_viewer" on public.task_checklist_items
  for select to authenticated
  using (public.can_view_task(task_id));
-- Note: no direct writes for authenticated on these tables.

-- task_assignments: SELECT where the task is viewable, or the assignee.
drop policy if exists "task_assignments_select" on public.task_assignments;
create policy "task_assignments_select" on public.task_assignments
  for select to authenticated
  using (public.can_view_task(task_id) or assignee_id = auth.uid());
-- Note: no direct writes for authenticated on task_assignments.

-- task_events: SELECT where the task is viewable. NO direct insert policy;
-- API functions insert via SECURITY DEFINER (bypasses RLS).
drop policy if exists "task_events_select_viewer" on public.task_events;
create policy "task_events_select_viewer" on public.task_events
  for select to authenticated
  using (public.can_view_task(task_id));

-- notifications: SELECT own; UPDATE own but is_read only (enforced by the
-- trigger below); NO direct insert (API functions insert via definer).
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own_read" on public.notifications;
create policy "notifications_update_own_read" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.protect_notification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Non-service-role callers may only flip is_read on their own rows.
  if auth.role() is distinct from 'service_role' then
    if new.id          is distinct from old.id
    or new.user_id     is distinct from old.user_id
    or new.title       is distinct from old.title
    or new.body        is distinct from old.body
    or new.entity_type is distinct from old.entity_type
    or new.entity_id   is distinct from old.entity_id
    or new.created_at  is distinct from old.created_at then
      raise exception 'Only is_read may be updated on notifications.';
    end if;
  end if;
  return new;
end;
$$;
comment on function public.protect_notification_columns() is 'Trigger guard: non-service-role callers may only change is_read on notifications (prevents forging title/body/recipient).';

drop trigger if exists trg_notifications_protect_columns on public.notifications;
create trigger trg_notifications_protect_columns
before update on public.notifications
for each row execute function public.protect_notification_columns();

-- social_media_manager: intentionally no task-table policies in Phase 2.

-- ============================================================================
-- 7. public.get_task_board()
-- How designers see claimable/claimed public tasks without touching
-- private briefs. SECURITY DEFINER so claimant names resolve despite the
-- restrictive profiles RLS; returns only public tasks.
-- ============================================================================

create or replace function public.get_task_board()
returns table (
  id               uuid,
  task_code        text,
  title            text,
  production_status text,
  priority         text,
  due_date         timestamptz,
  claimed_by       uuid,
  claimant_name    text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid    uuid := auth.uid();
  v_active boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  select p.is_active into v_active
    from public.profiles p
   where p.id = v_uid;
  if v_active is null or not v_active then
    raise exception 'An active profile is required.' using errcode = '28000';
  end if;

  return query
    select t.id,
           t.task_code,
           t.title,
           t.production_status,
           t.priority,
           t.due_date,
           t.claimed_by,
           p.full_name
      from public.tasks t
      left join public.profiles p on p.id = t.claimed_by
     where t.visibility = 'public'
       and t.production_status in ('available', 'in_progress')
     order by t.created_at desc;
end;
$$;
comment on function public.get_task_board() is 'Task board feed: public tasks that are available or in_progress, with claimant names. Caller must be authenticated with an active profile. SECURITY DEFINER so it works for designers despite restrictive RLS on tasks/profiles; exposes no private brief data.';

revoke all on function public.get_task_board() from public;
grant execute on function public.get_task_board() to authenticated;

-- ============================================================================
-- 8. Secure API functions — ALL security definer, fixed search_path.
-- Each validates auth.uid() + role + active profile FIRST (via
-- _require_task_caller), raises on failure, writes a task_events audit row,
-- and notifies only authorized parties (never leaks private titles to
-- unauthorized recipients).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_task(p_payload jsonb) -> {ok, task_id, task_code, duplicate_warning}
-- Roles: organizer (visibility forced to 'private' — organizers can NEVER
-- create public tasks) and team_lead (public|private). Designers and
-- social_media_manager cannot call this.
-- ---------------------------------------------------------------------------
create or replace function public.create_task(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_role           app_role;
  v_title          text;
  v_desc           text;
  v_visibility     text;
  v_priority       text;
  v_due            timestamptz;
  v_timezone       text;
  v_difficulty     text;
  v_est            numeric;
  v_campaign       text;
  v_category       text;
  v_platform       text;
  v_publish        boolean;
  v_assignee_id    uuid;
  v_lead_id        uuid;
  v_target_id      uuid;
  v_target_is_lead boolean := false;
  v_target_role    app_role;
  v_target_active  boolean;
  v_task_id        uuid;
  v_task_code      text;
  v_prod_status    text;
  v_dupe_warn      text := null;
  v_ref            jsonb;
  v_el             jsonb;
  v_label          text;
  v_idx            integer := 0;
begin
  -- (1) Caller validation FIRST.
  v_role := public._require_task_caller(array['organizer','team_lead']::app_role[]);

  -- (2) Title: required, 2-200 chars.
  v_title := nullif(trim(coalesce(p_payload->>'title','')), '');
  if v_title is null or char_length(v_title) < 2 or char_length(v_title) > 200 then
    raise exception 'Title is required and must be between 2 and 200 characters.';
  end if;

  -- (3) Visibility. Organizers can NEVER create public tasks.
  v_visibility := coalesce(nullif(p_payload->>'visibility',''), 'private');
  if v_visibility not in ('public','private') then
    raise exception 'visibility must be ''public'' or ''private''.';
  end if;
  if v_role = 'organizer' and v_visibility <> 'private' then
    raise exception 'Organizers can never create public tasks.';
  end if;

  -- (4) Priority.
  v_priority := coalesce(nullif(p_payload->>'priority',''), 'normal');
  if v_priority not in ('low','normal','high','urgent','critical') then
    raise exception 'Invalid priority: %', v_priority;
  end if;

  -- (5) Optional scalars.
  v_desc       := nullif(p_payload->>'description','');
  v_timezone   := nullif(p_payload->>'timezone','');
  v_difficulty := nullif(p_payload->>'difficulty','');
  v_campaign   := nullif(p_payload->>'campaign_name','');
  v_category   := nullif(p_payload->>'design_category','');
  v_platform   := nullif(p_payload->>'target_platform','');
  begin
    v_due := nullif(p_payload->>'due_date','')::timestamptz;
  exception when invalid_datetime_format then
    raise exception 'Invalid due_date; expected an ISO-8601 timestamp.';
  end;
  begin
    v_est := nullif(p_payload->>'est_hours','')::numeric;
  exception when invalid_text_representation then
    raise exception 'Invalid est_hours; expected a number.';
  end;
  begin
    v_publish := coalesce((p_payload->>'publish')::boolean, false);
  exception when invalid_text_representation then
    raise exception 'publish must be true or false.';
  end;

  -- (6) Assignee (designer) or delegation target (team_lead via assign_lead_id).
  begin
    v_assignee_id := nullif(p_payload->>'assignee_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid assignee_id.';
  end;
  begin
    v_lead_id := nullif(p_payload->>'assign_lead_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid assign_lead_id.';
  end;
  if v_assignee_id is not null and v_lead_id is not null then
    raise exception 'Provide either assignee_id or assign_lead_id, not both.';
  end if;
  v_target_id      := coalesce(v_assignee_id, v_lead_id);
  v_target_is_lead := (v_lead_id is not null);

  if v_target_id is not null then
    select r.role, p.is_active
      into v_target_role, v_target_active
      from public.profiles p
      join public.user_roles r on r.user_id = p.id
     where p.id = v_target_id;
    if v_target_role is null or not coalesce(v_target_active, false) then
      raise exception 'Assignee must be an active user with an application role.';
    end if;
    if v_target_is_lead and v_target_role <> 'team_lead' then
      raise exception 'assign_lead_id must reference a team_lead.';
    end if;
    if not v_target_is_lead and v_target_role <> 'designer' then
      raise exception 'assignee_id must reference a designer.';
    end if;
  end if;

  -- (7) Duplicate detection: deterministic and non-blocking (warning only).
  if v_campaign is not null and v_category is not null and v_platform is not null then
    if exists (
      select 1
        from public.tasks t
       where t.production_status <> 'cancelled'
         and t.campaign_name   = v_campaign
         and t.design_category = v_category
         and t.target_platform = v_platform
         and ( strpos(lower(t.title), lower(v_title)) > 0
            or strpos(lower(v_title), lower(t.title)) > 0 )
    ) then
      v_dupe_warn := 'A similar non-cancelled task already exists for this campaign, category and platform.';
    end if;
  end if;

  -- (8) Insert the task.
  v_task_code   := public.next_task_code();
  v_prod_status := case
                     when v_target_id is not null then 'assigned'
                     when v_publish then 'available'
                     else 'draft'
                   end;

  insert into public.tasks (
    task_code, title, description, visibility, production_status,
    priority, due_date, timezone, difficulty, est_hours,
    campaign_name, design_category, target_platform,
    created_by, assigned_designer_id, assigned_lead_id
  ) values (
    v_task_code, v_title, v_desc, v_visibility, v_prod_status,
    v_priority, v_due, v_timezone, v_difficulty, v_est,
    v_campaign, v_category, v_platform,
    v_uid,
    case when not v_target_is_lead then v_target_id end,
    case when v_target_is_lead then v_target_id end
  )
  returning id into v_task_id;

  -- (9) Brief row (spec/brief/social payloads).
  insert into public.task_briefs (task_id, brief_text, created_by, spec_json, brief_json, social_json)
  values (
    v_task_id, v_desc, v_uid,
    public._jsonb_or_empty(p_payload->'spec'),
    public._jsonb_or_empty(p_payload->'brief'),
    public._jsonb_or_empty(p_payload->'social')
  );

  -- (10) Reference links.
  if p_payload ? 'references' and jsonb_typeof(p_payload->'references') = 'array' then
    for v_ref in select * from jsonb_array_elements(p_payload->'references') loop
      if nullif(v_ref->>'label','') is not null
         and nullif(v_ref->>'url','') is not null then
        insert into public.task_references (task_id, label, url, kind)
        values (v_task_id, v_ref->>'label', v_ref->>'url', nullif(v_ref->>'kind',''));
      end if;
    end loop;
  end if;

  -- (11) Checklist items.
  if p_payload ? 'checklist' and jsonb_typeof(p_payload->'checklist') = 'array' then
    for v_el in select * from jsonb_array_elements(p_payload->'checklist') loop
      if jsonb_typeof(v_el) = 'string' then
        v_label := trim(v_el #>> '{}');
        if v_label <> '' then
          insert into public.task_checklist_items (task_id, label, sort_order)
          values (v_task_id, v_label, v_idx);
          v_idx := v_idx + 1;
        end if;
      end if;
    end loop;
  end if;

  -- (12) Assignment row + notification to the assignee (authorized party).
  if v_target_id is not null then
    insert into public.task_assignments (task_id, assignee_id, assigned_by, status)
    values (v_task_id, v_target_id, v_uid, 'assigned');

    perform public._insert_notification(
      v_target_id,
      'New task assigned: ' || v_task_code,
      v_title,
      'task', v_task_id::text
    );
  end if;

  -- (13) Audit event.
  perform public._log_task_event(v_task_id, 'task_created', jsonb_build_object(
    'task_code', v_task_code,
    'visibility', v_visibility,
    'production_status', v_prod_status,
    'priority', v_priority,
    'assignee_id', v_target_id,
    'duplicate_warning', v_dupe_warn
  ));

  return jsonb_build_object(
    'ok', true,
    'task_id', v_task_id,
    'task_code', v_task_code,
    'duplicate_warning', v_dupe_warn
  );
end;
$$;
comment on function public.create_task(jsonb) is 'Creates a task + brief + references + checklist (+ optional assignment) in one transaction. Roles: organizer (visibility forced private) and team_lead only. Validates title, enums, assignee role/active. Non-blocking duplicate warning. Writes task_events and notifies the assignee. SECURITY DEFINER; mutations bypass RLS by design.';

-- ---------------------------------------------------------------------------
-- publish_task: draft -> available. Caller must be the creator or organizer.
-- ---------------------------------------------------------------------------
create or replace function public.publish_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
  t      public.tasks%rowtype;
begin
  v_role := public._require_task_caller();

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Task not found.';
  end if;
  if not (v_role = 'organizer' or t.created_by = v_uid) then
    raise exception 'Only the creator or an organizer can publish this task.';
  end if;
  if t.production_status <> 'draft' then
    raise exception 'Only draft tasks can be published (current: %).', t.production_status;
  end if;

  update public.tasks
     set production_status = 'available'
   where id = p_task_id;

  perform public._log_task_event(p_task_id, 'task_published', jsonb_build_object(
    'old_status', 'draft',
    'new_status', 'available'
  ));
end;
$$;
comment on function public.publish_task(uuid) is 'Moves a draft task to available (public board). Only the creator or an organizer. Writes a task_events audit row. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- claim_task: atomic public-board claim.
-- Threat model: the eligibility check and the state change MUST happen in a
-- single UPDATE ... WHERE ... RETURNING statement. Concurrent claimants
-- serialize on the row lock, so exactly one UPDATE matches and wins; every
-- other caller gets {ok:false, reason:'already_claimed'} with no TOCTOU gap.
-- The same 'already_claimed' result covers cancelled/expired/invisible tasks
-- (no information leak about why the claim failed).
-- ---------------------------------------------------------------------------
create or replace function public.claim_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    app_role;
  v_uid     uuid := auth.uid();
  v_claimed uuid;
  t         public.tasks%rowtype;
begin
  -- Designer role with active profile, verified BEFORE touching the task.
  v_role := public._require_task_caller(array['designer']::app_role[]);

  update public.tasks
     set claimed_by        = v_uid,
         claimed_at        = now(),
         production_status = 'in_progress',
         updated_at        = now()
   where id = p_task_id
     and visibility = 'public'
     and production_status = 'available'
     and claimed_by is null
     and (due_date is null or due_date > now())
  returning id into v_claimed;

  if v_claimed is null then
    return jsonb_build_object('ok', false, 'reason', 'already_claimed');
  end if;

  select * into t from public.tasks where id = p_task_id;

  perform public._log_task_event(p_task_id, 'task_claimed', jsonb_build_object(
    'task_code', t.task_code,
    'claimed_by', v_uid
  ));

  -- Notify the creator (and the assigned lead, if any): authorized parties.
  perform public._insert_notification(t.created_by,
    'Task claimed: ' || t.task_code, t.title, 'task', p_task_id::text);
  if t.assigned_lead_id is not null
     and t.assigned_lead_id is distinct from t.created_by then
    perform public._insert_notification(t.assigned_lead_id,
      'Task claimed: ' || t.task_code, t.title, 'task', p_task_id::text);
  end if;

  return jsonb_build_object('ok', true, 'task_id', p_task_id);
end;
$$;
comment on function public.claim_task(uuid) is 'Atomic claim of a public+available task by a designer: single UPDATE...WHERE...RETURNING guarantees exactly one winner under concurrency (no TOCTOU). Returns ok:false/already_claimed otherwise. Notifies creator (and lead). Writes task_events. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- accept_assignment / decline_assignment: only the assignee may respond.
-- ---------------------------------------------------------------------------
create or replace function public.accept_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a     public.task_assignments%rowtype;
  t     public.tasks%rowtype;
begin
  perform public._require_task_caller();

  select * into a from public.task_assignments where id = p_assignment_id;
  if a.id is null then
    raise exception 'Assignment not found.';
  end if;
  if a.assignee_id is distinct from v_uid then
    raise exception 'Only the assignee can respond to this assignment.';
  end if;
  if a.status <> 'assigned' then
    raise exception 'Assignment is already %.', a.status;
  end if;

  select * into t from public.tasks where id = a.task_id;
  if t.production_status = 'cancelled' then
    raise exception 'Task is cancelled.';
  end if;
  if t.production_status <> 'assigned' then
    raise exception 'Task must be in assigned state to accept (current: %).', t.production_status;
  end if;

  update public.task_assignments
     set status = 'accepted', responded_at = now()
   where id = p_assignment_id;

  update public.tasks
     set production_status = 'accepted'
   where id = a.task_id;

  perform public._log_task_event(a.task_id, 'assignment_accepted', jsonb_build_object(
    'assignment_id', p_assignment_id,
    'assignee_id', v_uid,
    'old_status', 'assigned',
    'new_status', 'accepted'
  ));

  perform public._insert_notification(a.assigned_by,
    'Assignment accepted: ' || t.task_code, t.title, 'task', a.task_id::text);
end;
$$;
comment on function public.accept_assignment(uuid) is 'Assignee-only accept: assignment -> accepted, task -> accepted, notifies the assigner, writes task_events. SECURITY DEFINER.';

create or replace function public.decline_assignment(p_assignment_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  a      public.task_assignments%rowtype;
  t      public.tasks%rowtype;
  v_body text;
begin
  perform public._require_task_caller();

  select * into a from public.task_assignments where id = p_assignment_id;
  if a.id is null then
    raise exception 'Assignment not found.';
  end if;
  if a.assignee_id is distinct from v_uid then
    raise exception 'Only the assignee can respond to this assignment.';
  end if;
  if a.status <> 'assigned' then
    raise exception 'Assignment is already %.', a.status;
  end if;

  select * into t from public.tasks where id = a.task_id;
  if t.production_status = 'cancelled' then
    raise exception 'Task is cancelled.';
  end if;
  if t.production_status <> 'assigned' then
    raise exception 'Task must be in assigned state to decline (current: %).', t.production_status;
  end if;

  update public.task_assignments
     set status = 'declined', responded_at = now()
   where id = p_assignment_id;

  -- Free the slot for reassignment. Only clears the column that still points
  -- at the declining assignee, so a newer assignee is never clobbered.
  update public.tasks
     set production_status = 'assigned',
         assigned_designer_id = case
           when assigned_designer_id is not distinct from v_uid then null
           else assigned_designer_id end,
         assigned_lead_id = case
           when assigned_lead_id is not distinct from v_uid then null
           else assigned_lead_id end
   where id = a.task_id;

  perform public._log_task_event(a.task_id, 'assignment_declined', jsonb_build_object(
    'assignment_id', p_assignment_id,
    'assignee_id', v_uid,
    'old_status', 'assigned',
    'new_status', 'declined',
    'reason', p_reason
  ));

  v_body := t.title;
  if nullif(trim(coalesce(p_reason,'')), '') is not null then
    v_body := v_body || ' — Reason: ' || trim(p_reason);
  end if;

  -- Notify assigner and creator (deduplicated): authorized parties.
  perform public._insert_notification(a.assigned_by,
    'Assignment declined: ' || t.task_code, v_body, 'task', a.task_id::text);
  if t.created_by is distinct from a.assigned_by then
    perform public._insert_notification(t.created_by,
      'Assignment declined: ' || t.task_code, v_body, 'task', a.task_id::text);
  end if;
end;
$$;
comment on function public.decline_assignment(uuid, text) is 'Assignee-only decline: assignment -> declined, task stays assigned with the slot freed (columns cleared only if they still point at the decliner), notifies assigner and creator, writes task_events. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- reassign_task: organizer, or team_lead on tasks they created or lead.
-- Designers have no path here (role gate), so a designer can never
-- transfer a task to another employee.
-- ---------------------------------------------------------------------------
create or replace function public.reassign_task(p_task_id uuid, p_new_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role       app_role;
  v_uid        uuid := auth.uid();
  t            public.tasks%rowtype;
  v_new_role   app_role;
  v_new_active boolean;
  v_is_lead    boolean;
begin
  v_role := public._require_task_caller(array['organizer','team_lead']::app_role[]);

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Task not found.';
  end if;
  if t.production_status = 'cancelled' then
    raise exception 'Cannot reassign a cancelled task.';
  end if;
  if v_role = 'team_lead'
     and not (t.created_by = v_uid or t.assigned_lead_id = v_uid) then
    raise exception 'Team leads may only reassign tasks they created or lead.';
  end if;

  select r.role, p.is_active
    into v_new_role, v_new_active
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
   where p.id = p_new_assignee_id;
  if v_new_role is null or not coalesce(v_new_active, false) then
    raise exception 'New assignee must be an active user with an application role.';
  end if;
  if v_new_role not in ('designer', 'team_lead') then
    raise exception 'New assignee must be a designer or a team_lead.';
  end if;
  v_is_lead := (v_new_role = 'team_lead');

  -- Supersede any still-open offers so there is exactly one live assignee.
  update public.task_assignments
     set status = 'declined', responded_at = now()
   where task_id = p_task_id
     and status = 'assigned'
     and assignee_id is distinct from p_new_assignee_id;

  update public.tasks
     set assigned_designer_id = case when v_is_lead then null else p_new_assignee_id end,
         assigned_lead_id     = case when v_is_lead then p_new_assignee_id else null end,
         production_status    = 'assigned'
   where id = p_task_id;

  insert into public.task_assignments (task_id, assignee_id, assigned_by, status)
  values (p_task_id, p_new_assignee_id, v_uid, 'assigned');

  perform public._log_task_event(p_task_id, 'task_reassigned', jsonb_build_object(
    'new_assignee_id', p_new_assignee_id,
    'new_assignee_role', v_new_role,
    'old_designer_id', t.assigned_designer_id,
    'old_lead_id', t.assigned_lead_id
  ));

  perform public._insert_notification(p_new_assignee_id,
    'Task reassigned to you: ' || t.task_code, t.title, 'task', p_task_id::text);
end;
$$;
comment on function public.reassign_task(uuid, uuid) is 'Reassigns a task to an active designer (or team_lead for delegation). Organizer, or team_lead on tasks they created/lead; designers have no path. Supersedes open offers, writes task_events, notifies the new assignee. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- update_task_status: server-side transition map with role gating.
--   draft       -> available, cancelled
--   available   -> assigned, cancelled
--   assigned    -> accepted, in_progress, cancelled
--   accepted    -> in_progress, cancelled
--   in_progress -> cancelled
-- Roles: organizer any allowed transition; team_lead on tasks they created
-- or lead; designers only accepted->in_progress on their own tasks.
-- ---------------------------------------------------------------------------
create or replace function public.update_task_status(
  p_task_id    uuid,
  p_new_status text,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    app_role;
  v_uid     uuid := auth.uid();
  t         public.tasks%rowtype;
  v_allowed text[];
  v_pid     uuid;
begin
  v_role := public._require_task_caller();

  if p_new_status not in ('draft','available','assigned','accepted','in_progress','cancelled') then
    raise exception 'Invalid status: %', p_new_status;
  end if;

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Task not found.';
  end if;

  v_allowed := case t.production_status
    when 'draft'       then array['available','cancelled']
    when 'available'   then array['assigned','cancelled']
    when 'assigned'    then array['accepted','in_progress','cancelled']
    when 'accepted'    then array['in_progress','cancelled']
    when 'in_progress' then array['cancelled']
    else array[]::text[]
  end;
  if not (p_new_status = any (v_allowed)) then
    raise exception 'Transition % -> % is not allowed.', t.production_status, p_new_status;
  end if;

  if v_role = 'organizer' then
    null; -- organizers may apply any allowed transition
  elsif v_role = 'team_lead' then
    if not (t.created_by = v_uid or t.assigned_lead_id = v_uid) then
      raise exception 'Team leads may only change status on tasks they created or lead.';
    end if;
  elsif v_role = 'designer' then
    if not (t.production_status = 'accepted'
            and p_new_status = 'in_progress'
            and (t.assigned_designer_id = v_uid or t.claimed_by = v_uid)) then
      raise exception 'Designers may only move their own tasks from accepted to in_progress.';
    end if;
  else
    raise exception 'Role % cannot change task status.', v_role;
  end if;

  update public.tasks
     set production_status = p_new_status
   where id = p_task_id;

  perform public._log_task_event(p_task_id, 'status_changed', jsonb_build_object(
    'old_status', t.production_status,
    'new_status', p_new_status,
    'actor_id', v_uid,
    'actor_role', v_role,
    'reason', p_reason
  ));

  -- Notify every involved party except the actor (all authorized).
  for v_pid in
    select distinct pid
      from unnest(array[t.created_by, t.assigned_designer_id, t.claimed_by, t.assigned_lead_id]) as pid
     where pid is not null
       and pid <> v_uid
  loop
    perform public._insert_notification(v_pid,
      'Task ' || p_new_status || ': ' || t.task_code,
      t.title, 'task', p_task_id::text);
  end loop;
end;
$$;
comment on function public.update_task_status(uuid, text, text) is 'Server-side status machine (draft/available/assigned/accepted/in_progress/cancelled). Role-gated: organizer any, team_lead on own/led tasks, designers only accepted->in_progress on their own. Writes task_events with old/new/actor/reason and notifies involved parties. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- update_task: audit-logged field edits. Creator or organizer only.
-- Allowed keys: title, description, due_date, priority, timezone, difficulty,
-- est_hours, campaign_name, design_category, target_platform,
-- spec_json, brief_json, social_json. Unknown keys are ignored.
-- ---------------------------------------------------------------------------
create or replace function public.update_task(p_task_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     app_role;
  v_uid      uuid := auth.uid();
  t          public.tasks%rowtype;
  b          public.task_briefs%rowtype;
  v_changes  jsonb := '{}'::jsonb;
  v_title    text;
  v_priority text;
  -- working copies, seeded from the current row
  n_title    text;
  n_desc     text;
  n_due      timestamptz;
  n_priority text;
  n_tz       text;
  n_diff     text;
  n_est      numeric;
  n_camp     text;
  n_cat      text;
  n_plat     text;
  v_bspec    jsonb;
  v_bbrief   jsonb;
  v_bsocial  jsonb;
begin
  v_role := public._require_task_caller();

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Task not found.';
  end if;
  if not (v_role = 'organizer' or t.created_by = v_uid) then
    raise exception 'Only the creator or an organizer can edit this task.';
  end if;

  n_title := t.title;         n_desc := t.description;   n_due := t.due_date;
  n_priority := t.priority;   n_tz := t.timezone;        n_diff := t.difficulty;
  n_est := t.est_hours;      n_camp := t.campaign_name;  n_cat := t.design_category;
  n_plat := t.target_platform;

  if p_patch ? 'title' then
    v_title := nullif(trim(coalesce(p_patch->>'title','')), '');
    if v_title is null or char_length(v_title) < 2 or char_length(v_title) > 200 then
      raise exception 'Title must be between 2 and 200 characters.';
    end if;
    n_title := v_title;
  end if;
  if p_patch ? 'description' then
    n_desc := nullif(p_patch->>'description','');
  end if;
  if p_patch ? 'due_date' then
    begin
      n_due := nullif(p_patch->>'due_date','')::timestamptz;
    exception when invalid_datetime_format then
      raise exception 'Invalid due_date; expected an ISO-8601 timestamp.';
    end;
  end if;
  if p_patch ? 'priority' then
    v_priority := nullif(p_patch->>'priority','');
    if v_priority is not null
       and v_priority not in ('low','normal','high','urgent','critical') then
      raise exception 'Invalid priority: %', v_priority;
    end if;
    if v_priority is not null then
      n_priority := v_priority;
    end if;
  end if;
  if p_patch ? 'timezone' then
    n_tz := nullif(p_patch->>'timezone','');
  end if;
  if p_patch ? 'difficulty' then
    n_diff := nullif(p_patch->>'difficulty','');
  end if;
  if p_patch ? 'est_hours' then
    begin
      n_est := nullif(p_patch->>'est_hours','')::numeric;
    exception when invalid_text_representation then
      raise exception 'Invalid est_hours; expected a number.';
    end;
  end if;
  if p_patch ? 'campaign_name' then
    n_camp := nullif(p_patch->>'campaign_name','');
  end if;
  if p_patch ? 'design_category' then
    n_cat := nullif(p_patch->>'design_category','');
  end if;
  if p_patch ? 'target_platform' then
    n_plat := nullif(p_patch->>'target_platform','');
  end if;

  -- changed-field ledger (old/new per field)
  if n_title    is distinct from t.title           then v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', t.title, 'new', n_title)); end if;
  if n_desc     is distinct from t.description    then v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', t.description, 'new', n_desc)); end if;
  if n_due      is distinct from t.due_date       then v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_object('old', t.due_date, 'new', n_due)); end if;
  if n_priority is distinct from t.priority       then v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('old', t.priority, 'new', n_priority)); end if;
  if n_tz       is distinct from t.timezone       then v_changes := v_changes || jsonb_build_object('timezone', jsonb_build_object('old', t.timezone, 'new', n_tz)); end if;
  if n_diff     is distinct from t.difficulty     then v_changes := v_changes || jsonb_build_object('difficulty', jsonb_build_object('old', t.difficulty, 'new', n_diff)); end if;
  if n_est      is distinct from t.est_hours      then v_changes := v_changes || jsonb_build_object('est_hours', jsonb_build_object('old', t.est_hours, 'new', n_est)); end if;
  if n_camp     is distinct from t.campaign_name   then v_changes := v_changes || jsonb_build_object('campaign_name', jsonb_build_object('old', t.campaign_name, 'new', n_camp)); end if;
  if n_cat      is distinct from t.design_category then v_changes := v_changes || jsonb_build_object('design_category', jsonb_build_object('old', t.design_category, 'new', n_cat)); end if;
  if n_plat     is distinct from t.target_platform then v_changes := v_changes || jsonb_build_object('target_platform', jsonb_build_object('old', t.target_platform, 'new', n_plat)); end if;

  update public.tasks
     set title           = n_title,
         description     = n_desc,
         due_date        = n_due,
         priority        = n_priority,
         timezone        = n_tz,
         difficulty      = n_diff,
         est_hours       = n_est,
         campaign_name   = n_camp,
         design_category = n_cat,
         target_platform = n_plat
   where id = p_task_id;

  -- Structured brief payloads (upsert; 002-era tasks may lack a brief row).
  if (p_patch ? 'spec_json') or (p_patch ? 'brief_json') or (p_patch ? 'social_json') then
    select * into b from public.task_briefs where task_id = p_task_id;
    v_bspec   := public._jsonb_or_empty(p_patch->'spec_json');
    v_bbrief  := public._jsonb_or_empty(p_patch->'brief_json');
    v_bsocial := public._jsonb_or_empty(p_patch->'social_json');

    insert into public.task_briefs as tb
      (task_id, created_by, spec_json, brief_json, social_json)
    values
      (p_task_id, v_uid, v_bspec, v_bbrief, v_bsocial)
    on conflict (task_id) do update set
      spec_json   = case when p_patch ? 'spec_json'   then excluded.spec_json   else tb.spec_json end,
      brief_json  = case when p_patch ? 'brief_json'  then excluded.brief_json  else tb.brief_json end,
      social_json = case when p_patch ? 'social_json' then excluded.social_json else tb.social_json end;

    if (p_patch ? 'spec_json') and v_bspec is distinct from coalesce(b.spec_json,'{}'::jsonb) then
      v_changes := v_changes || jsonb_build_object('spec_json', jsonb_build_object('old', coalesce(b.spec_json,'{}'::jsonb), 'new', v_bspec));
    end if;
    if (p_patch ? 'brief_json') and v_bbrief is distinct from coalesce(b.brief_json,'{}'::jsonb) then
      v_changes := v_changes || jsonb_build_object('brief_json', jsonb_build_object('old', coalesce(b.brief_json,'{}'::jsonb), 'new', v_bbrief));
    end if;
    if (p_patch ? 'social_json') and v_bsocial is distinct from coalesce(b.social_json,'{}'::jsonb) then
      v_changes := v_changes || jsonb_build_object('social_json', jsonb_build_object('old', coalesce(b.social_json,'{}'::jsonb), 'new', v_bsocial));
    end if;
  end if;

  perform public._log_task_event(p_task_id, 'task_updated', jsonb_build_object(
    'changed_fields', v_changes,
    'actor_id', v_uid,
    'actor_role', v_role
  ));
end;
$$;
comment on function public.update_task(uuid, jsonb) is 'Audit-logged edits to whitelisted task/brief fields. Creator or organizer only. Writes task_events with per-field old/new values. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- toggle_checklist_item: flips is_done. Caller must view the task AND be
-- the assignee/claimant, the creator, or an organizer.
-- ---------------------------------------------------------------------------
create or replace function public.toggle_checklist_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
  v_item public.task_checklist_items%rowtype;
  t      public.tasks%rowtype;
  v_new  boolean;
begin
  v_role := public._require_task_caller();

  select * into v_item from public.task_checklist_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'Checklist item not found.';
  end if;
  if not public.can_view_task(v_item.task_id) then
    raise exception 'Not authorized to view this task.';
  end if;

  select * into t from public.tasks where id = v_item.task_id;
  if not (v_role = 'organizer'
          or t.created_by = v_uid
          or t.assigned_designer_id = v_uid
          or t.claimed_by = v_uid) then
    raise exception 'Only the assignee/claimant, creator, or organizer can toggle checklist items.';
  end if;

  update public.task_checklist_items
     set is_done = not is_done
   where id = p_item_id
  returning is_done into v_new;

  perform public._log_task_event(v_item.task_id, 'checklist_toggled', jsonb_build_object(
    'item_id', p_item_id,
    'label', v_item.label,
    'old_is_done', v_item.is_done,
    'new_is_done', v_new
  ));
end;
$$;
comment on function public.toggle_checklist_item(uuid) is 'Flips a checklist item is_done flag. Caller must view the task and be assignee/claimant, creator, or organizer. Writes task_events. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- cancel_task: creator or organizer only. Notifies assignee/claimant.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_task(p_task_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
  t      public.tasks%rowtype;
  v_pid  uuid;
  v_body text;
begin
  v_role := public._require_task_caller();

  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'Task not found.';
  end if;
  if not (v_role = 'organizer' or t.created_by = v_uid) then
    raise exception 'Only the creator or an organizer can cancel this task.';
  end if;
  if t.production_status = 'cancelled' then
    raise exception 'Task is already cancelled.';
  end if;

  update public.tasks
     set production_status = 'cancelled'
   where id = p_task_id;

  perform public._log_task_event(p_task_id, 'task_cancelled', jsonb_build_object(
    'old_status', t.production_status,
    'new_status', 'cancelled',
    'actor_id', v_uid,
    'actor_role', v_role,
    'reason', p_reason
  ));

  v_body := t.title;
  if nullif(trim(coalesce(p_reason,'')), '') is not null then
    v_body := v_body || ' — Reason: ' || trim(p_reason);
  end if;

  for v_pid in
    select distinct pid
      from unnest(array[t.assigned_designer_id, t.claimed_by]) as pid
     where pid is not null
  loop
    perform public._insert_notification(v_pid,
      'Task cancelled: ' || t.task_code, v_body, 'task', p_task_id::text);
  end loop;
end;
$$;
comment on function public.cancel_task(uuid, text) is 'Cancels a task. Creator or organizer only. Notifies assignee/claimant, writes task_events. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- get_designer_workload: real workload computed from tasks.
-- Caller must be organizer or team_lead.
-- ---------------------------------------------------------------------------
create or replace function public.get_designer_workload(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role     app_role;
  v_active   integer;
  v_overdue  integer;
  v_upcoming jsonb;
begin
  v_role := public._require_task_caller(array['organizer','team_lead']::app_role[]);

  select count(*)
    into v_active
    from public.tasks t
   where (t.assigned_designer_id = p_user_id or t.claimed_by = p_user_id)
     and t.production_status in ('assigned','accepted','in_progress');

  select count(*)
    into v_overdue
    from public.tasks t
   where (t.assigned_designer_id = p_user_id or t.claimed_by = p_user_id)
     and t.production_status in ('assigned','accepted','in_progress')
     and t.due_date is not null
     and t.due_date < now();

  select coalesce(jsonb_agg(s.item), '[]'::jsonb)
    into v_upcoming
    from (
      select jsonb_build_object(
               'task_id', t.id,
               'task_code', t.task_code,
               'title', t.title,
               'due_date', t.due_date
             ) as item
        from public.tasks t
       where (t.assigned_designer_id = p_user_id or t.claimed_by = p_user_id)
         and t.production_status in ('assigned','accepted','in_progress')
         and (t.due_date is null or t.due_date >= now())
       order by t.due_date asc nulls last
       limit 50
    ) s;

  return jsonb_build_object(
    'active_count', v_active,
    'overdue_count', v_overdue,
    'upcoming', v_upcoming
  );
end;
$$;
comment on function public.get_designer_workload(uuid) is 'Workload snapshot for a designer: active/overdue counts and up to 50 upcoming tasks, computed from real task rows. Organizer or team_lead only. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- Grants: public API functions executable by authenticated; internal
-- helpers stay locked down (revoked above).
-- ---------------------------------------------------------------------------
revoke all on function public.next_task_code() from public;
grant execute on function public.next_task_code() to authenticated;

revoke all on function public.create_task(jsonb) from public;
grant execute on function public.create_task(jsonb) to authenticated;

revoke all on function public.publish_task(uuid) from public;
grant execute on function public.publish_task(uuid) to authenticated;

revoke all on function public.claim_task(uuid) from public;
grant execute on function public.claim_task(uuid) to authenticated;

revoke all on function public.accept_assignment(uuid) from public;
grant execute on function public.accept_assignment(uuid) to authenticated;

revoke all on function public.decline_assignment(uuid, text) from public;
grant execute on function public.decline_assignment(uuid, text) to authenticated;

revoke all on function public.reassign_task(uuid, uuid) from public;
grant execute on function public.reassign_task(uuid, uuid) to authenticated;

revoke all on function public.update_task_status(uuid, text, text) from public;
grant execute on function public.update_task_status(uuid, text, text) to authenticated;

revoke all on function public.update_task(uuid, jsonb) from public;
grant execute on function public.update_task(uuid, jsonb) to authenticated;

revoke all on function public.toggle_checklist_item(uuid) from public;
grant execute on function public.toggle_checklist_item(uuid) to authenticated;

revoke all on function public.cancel_task(uuid, text) from public;
grant execute on function public.cancel_task(uuid, text) to authenticated;

revoke all on function public.get_designer_workload(uuid) from public;
grant execute on function public.get_designer_workload(uuid) to authenticated;

-- ============================================================================
-- 9. Realtime: defensively add task tables to the supabase_realtime
-- publication (skips tables already present; no-ops if the publication
-- does not exist, e.g. plain Postgres without Supabase realtime).
-- ============================================================================
do $$
declare
  v_missing text[];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  select array_agg(v.tbl)
    into v_missing
    from (values ('tasks'), ('task_events'), ('notifications')) as v(tbl)
   where not exists (
           select 1
             from pg_publication_tables
            where pubname    = 'supabase_realtime'
              and schemaname = 'public'
              and tablename  = v.tbl
         );

  if v_missing is not null then
    execute 'alter publication supabase_realtime add table '
         || (select string_agg('public.' || quote_ident(x), ', ')
               from unnest(v_missing) as x);
  end if;
end
$$;
