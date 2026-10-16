-- ============================================================================
-- DESIGNFLOW OS — PHASE 4 (007): Publishing Studio, Analytics, Leaderboard
--
-- Extends the existing app (no rebuild). Builds on migrations 001–006.
--
-- 1.  tasks.production_status gains 'published' (all required platforms done).
-- 2.  publishing_records becomes multi-platform: one current row per
--     (task_id, platform); status engine with explicit transitions.
-- 3.  New tables: publishing_events (audit), performance_snapshots,
--     leaderboard_periods, task_complexity_weights, notification_events
--     (dedupe for scheduled alerts).
-- 4.  Secure RPCs: transition_publishing_status, mark_published,
--     schedule_publishing, get_organizer_stats, get_lead_stats,
--     get_designer_stats, calculate_designer_score, get_leaderboard,
--     detect_bottlenecks, check_deadlines.
-- 5.  RLS: deny by default; scoped SELECT; writes via RPC only.
-- 6.  pg_cron deadline monitoring (best-effort; migration never fails
--     if the extension is unavailable).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. Task lifecycle: add 'published'.
-- ============================================================================
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'tasks_production_status_check'
       and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks drop constraint tasks_production_status_check;
  end if;
  alter table public.tasks
    add constraint tasks_production_status_check
    check (production_status in (
      'draft', 'available', 'assigned', 'accepted', 'in_progress', 'cancelled',
      'submitted_lead_review', 'submitted_organizer_review', 'ready_for_publishing',
      'revision_awaiting_organizer', 'revision_awaiting_lead', 'revision_required_designer',
      'published'
    ));
end
$$;

-- ============================================================================
-- 2. publishing_records — multi-platform publishing studio.
-- ============================================================================

-- Backfill NULL platforms from the task's target platform (or 'other'),
-- then enforce NOT NULL so the (task_id, platform) uniqueness is sound.
do $$
begin
  update public.publishing_records pr
     set platform = coalesce(nullif(btrim(t.target_platform), ''), 'other')
    from public.tasks t
   where pr.task_id = t.id and pr.platform is null;

  update public.publishing_records
     set platform = 'other'
   where platform is null;
end
$$;

alter table public.publishing_records
  alter column platform set not null,
  alter column platform set default 'other';

alter table public.publishing_records
  add column if not exists published_at       timestamptz,
  add column if not exists published_by       uuid references public.profiles(id),
  add column if not exists scheduled_by       uuid references public.profiles(id),
  add column if not exists platform_post_id   text,
  add column if not exists publishing_notes   text,
  add column if not exists extra_urls          jsonb not null default '[]'::jsonb,
  add column if not exists reschedule_count   integer not null default 0,
  add column if not exists status_changed_at  timestamptz not null default now(),
  add column if not exists status_changed_by  uuid references public.profiles(id);

-- One current row per (task, platform). Superseded rows keep history.
drop index if exists public.publishing_records_one_current_idx;
create unique index publishing_records_one_current_idx
  on public.publishing_records (task_id, platform) where is_current;

-- Status engine values.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'publishing_records_status_check') then
    alter table public.publishing_records drop constraint publishing_records_status_check;
  end if;
  alter table public.publishing_records
    add constraint publishing_records_status_check
    check (status in (
      'ready', 'pending', 'scheduled', 'changes_requested', 'published',
      'cancelled', 'superseded'
    ));
end
$$;

create index if not exists idx_publishing_records_status_current
  on public.publishing_records (status) where is_current;
create index if not exists idx_publishing_records_scheduled_at
  on public.publishing_records (scheduled_at) where is_current and status = 'scheduled';

comment on table public.publishing_records is
'Phase 4 publishing studio: one current row per (task, platform). Statuses: ready, pending, scheduled, changes_requested, published, cancelled, superseded.';

-- ---------------------------------------------------------------------------
-- 3. New tables.
-- ---------------------------------------------------------------------------

-- Append-only audit of every publishing transition.
create table if not exists public.publishing_events (
  id           uuid        primary key default gen_random_uuid(),
  record_id    uuid        not null references public.publishing_records(id) on delete cascade,
  task_id      uuid        not null references public.tasks(id) on delete cascade,
  actor_id     uuid        references public.profiles(id),
  from_status  text,
  to_status    text        not null,
  note         text,
  metadata     jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_publishing_events_record_id on public.publishing_events (record_id);
create index if not exists idx_publishing_events_task_id   on public.publishing_events (task_id);

-- Periodic leaderboard snapshots (point-in-time, auditable).
create table if not exists public.performance_snapshots (
  id            uuid        primary key default gen_random_uuid(),
  designer_id   uuid        not null references public.profiles(id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null,
  quality       numeric     not null,
  on_time       numeric     not null,
  output        numeric     not null,
  reliability   numeric     not null,
  responsiveness numeric    not null,
  total_score   numeric     not null,
  sample_tasks  integer     not null default 0,
  eligible      boolean     not null default false,
  computed_at   timestamptz not null default now(),
  constraint performance_snapshots_designer_period_unique
    unique (designer_id, period_start, period_end)
);
create index if not exists idx_performance_snapshots_period
  on public.performance_snapshots (period_start, period_end);

-- Named leaderboard periods (e.g. "2026-10", "Q4 2026").
create table if not exists public.leaderboard_periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  period_start date not null,
  period_end   date not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint leaderboard_periods_range_check check (period_end >= period_start)
);

-- Configurable complexity weights for the leaderboard output component.
create table if not exists public.task_complexity_weights (
  difficulty    text primary key,
  weight        numeric not null,
  constraint task_complexity_weights_weight_check check (weight > 0)
);
insert into public.task_complexity_weights (difficulty, weight) values
  ('easy', 1.0), ('medium', 1.5), ('hard', 2.0), ('complex', 3.0)
on conflict (difficulty) do update set weight = excluded.weight;

-- Dedupe keys for scheduled deadline alerts (one alert per condition).
create table if not exists public.notification_events (
  id          uuid        primary key default gen_random_uuid(),
  dedupe_key  text        not null unique,
  user_id     uuid        references public.profiles(id) on delete cascade,
  title       text,
  body        text,
  entity_type text,
  entity_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notification_events_created_at
  on public.notification_events (created_at);

-- ============================================================================
-- 4. Helpers.
-- ============================================================================

-- Publishing status transition map (server-side state machine).
create or replace function public._publishing_allowed(from_status text, to_status text)
returns boolean
language sql immutable as $$
  select case
    when from_status = to_status then false
    when from_status = 'ready'     then to_status in ('pending','scheduled','published','changes_requested','cancelled')
    when from_status = 'pending'   then to_status in ('scheduled','published','changes_requested','cancelled')
    when from_status = 'scheduled' then to_status in ('pending','published','changes_requested','cancelled')
    when from_status = 'changes_requested' then to_status in ('ready','cancelled')
    when from_status = 'cancelled' then false
    when from_status = 'published' then false  -- corrections via admin action only
    when from_status = 'superseded' then false
    else false
  end
$$;

-- Role of the caller (single-role model via user_roles).
create or replace function public._caller_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select r.role from public.user_roles r where r.user_id = auth.uid() limit 1
$$;

-- ============================================================================
-- 5. Publishing RPCs (SMM writes go through these; RLS denies direct writes).
-- ============================================================================

-- Generic status transition with audit + notifications.
create or replace function public.transition_publishing_status(
  p_record_id uuid,
  p_new_status text,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_role  public.app_role;
  rec     public.publishing_records%rowtype;
begin
  v_role := public._caller_role();
  if v_role is null then raise exception 'Not authenticated.'; end if;
  if v_role not in ('social_media_manager', 'organizer') then
    raise exception 'Only Social Media Managers or Organizers may transition publishing status.';
  end if;

  select * into rec from public.publishing_records where id = p_record_id for update;
  if rec.id is null then raise exception 'Publishing record not found.'; end if;
  if not rec.is_current then raise exception 'Only the current publishing record can be transitioned.'; end if;
  if not public._publishing_allowed(rec.status, p_new_status) then
    raise exception 'Transition % → % is not allowed.', rec.status, p_new_status;
  end if;

  -- SMM may not touch published/cancelled/superseded records.
  if v_role = 'social_media_manager' and rec.status in ('published','cancelled','superseded') then
    raise exception 'This record is locked.';
  end if;

  update public.publishing_records
     set status = p_new_status,
         status_changed_at = now(),
         status_changed_by = v_uid,
         updated_at = now()
   where id = p_record_id;

  insert into public.publishing_events (record_id, task_id, actor_id, from_status, to_status, note)
  values (p_record_id, rec.task_id, v_uid, rec.status, p_new_status, p_note);

  perform public._log_task_event(rec.task_id, 'publishing_status_changed',
    jsonb_build_object('record_id', p_record_id, 'from', rec.status, 'to', p_new_status, 'platform', rec.platform));

  -- Notify organizer on every transition.
  insert into public.notifications (user_id, title, body, entity_type, entity_id)
  select r.user_id,
         'Publishing ' || p_new_status || ': ' || t.task_code,
         'Platform ' || rec.platform || ' moved from ' || rec.status || ' to ' || p_new_status || '.',
         'publishing', p_record_id::text
    from public.user_roles r
    join public.tasks t on t.id = rec.task_id
   where r.role = 'organizer';
end
$$;

-- Schedule (or reschedule) a publishing record.
create or replace function public.schedule_publishing(
  p_record_id uuid,
  p_scheduled_at timestamptz,
  p_note text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.app_role;
  rec    public.publishing_records%rowtype;
begin
  v_role := public._caller_role();
  if v_role not in ('social_media_manager', 'organizer') then
    raise exception 'Only Social Media Managers or Organizers may schedule publishing.';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Scheduled time must be in the future.';
  end if;

  select * into rec from public.publishing_records where id = p_record_id for update;
  if rec.id is null then raise exception 'Publishing record not found.'; end if;
  if not rec.is_current then raise exception 'Only the current publishing record can be scheduled.'; end if;
  if not public._publishing_allowed(rec.status, 'scheduled') then
    raise exception 'Record in status % cannot be scheduled.', rec.status;
  end if;

  update public.publishing_records
     set status = 'scheduled',
         scheduled_at = p_scheduled_at,
         scheduled_by = v_uid,
         reschedule_count = case when rec.status = 'scheduled' then rec.reschedule_count + 1 else rec.reschedule_count end,
         status_changed_at = now(),
         status_changed_by = v_uid,
         updated_at = now()
   where id = p_record_id;

  insert into public.publishing_events (record_id, task_id, actor_id, from_status, to_status, note,
         metadata)
  values (p_record_id, rec.task_id, v_uid, rec.status, 'scheduled', p_note,
          jsonb_build_object('scheduled_at', p_scheduled_at));

  perform public._log_task_event(rec.task_id, 'publishing_scheduled',
    jsonb_build_object('record_id', p_record_id, 'platform', rec.platform, 'scheduled_at', p_scheduled_at));
end
$$;

-- Mark published: full transactional checklist (12 steps from the spec).
create or replace function public.mark_published(
  p_record_id uuid,
  p_published_url text default null,
  p_platform_post_id text default null,
  p_publishing_notes text default null,
  p_extra_urls jsonb default '[]'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_role  public.app_role;
  rec     public.publishing_records%rowtype;
  t       public.tasks%rowtype;
  v_open_revisions integer;
  v_remaining integer;
begin
  -- 1. Validate permissions.
  v_role := public._caller_role();
  if v_role not in ('social_media_manager', 'organizer') then
    raise exception 'Only Social Media Managers or Organizers may mark content published.';
  end if;

  select * into rec from public.publishing_records where id = p_record_id for update;
  if rec.id is null then raise exception 'Publishing record not found.'; end if;
  if not rec.is_current then raise exception 'Only the current publishing record can be published.'; end if;
  if not public._publishing_allowed(rec.status, 'published') then
    raise exception 'Record in status % cannot be marked published.', rec.status;
  end if;

  select * into t from public.tasks where id = rec.task_id for update;
  if t.id is null then raise exception 'Task not found.'; end if;

  -- 2. Verify the submission version is still the approved current one.
  if rec.submission_id is not null then
    perform 1 from public.task_submissions s
     where s.id = rec.submission_id and s.is_current and s.status = 'approved';
    if not found then
      raise exception 'The approved submission version is no longer current. Cannot publish a stale version.';
    end if;
  end if;

  -- 3. Verify no unresolved revision blocks publication.
  select count(*) into v_open_revisions
    from public.revision_requests
   where task_id = rec.task_id and status = 'open';
  if v_open_revisions > 0 then
    raise exception 'There are open revision requests blocking publication.';
  end if;

  -- 4–6. Save the publishing record.
  update public.publishing_records
     set status = 'published',
         published_at = now(),
         published_by = v_uid,
         published_url = coalesce(nullif(btrim(p_published_url), ''), published_url),
         platform_post_id = coalesce(nullif(btrim(p_platform_post_id), ''), platform_post_id),
         publishing_notes = coalesce(p_publishing_notes, publishing_notes),
         extra_urls = case when p_extra_urls is not null then p_extra_urls else extra_urls end,
         status_changed_at = now(),
         status_changed_by = v_uid,
         updated_at = now()
   where id = p_record_id;

  insert into public.publishing_events (record_id, task_id, actor_id, from_status, to_status,
         metadata)
  values (p_record_id, rec.task_id, v_uid, rec.status, 'published',
          jsonb_build_object('published_url', p_published_url, 'platform', rec.platform));

  -- 7. Update task lifecycle: published only when EVERY current platform record is published.
  select count(*) into v_remaining
    from public.publishing_records
   where task_id = rec.task_id and is_current and status <> 'published' and status <> 'cancelled';
  if v_remaining = 0 then
    update public.tasks set production_status = 'published', updated_at = now()
     where id = rec.task_id;
  end if;

  -- 8. Audit event.
  perform public._log_task_event(rec.task_id, 'content_published',
    jsonb_build_object('record_id', p_record_id, 'platform', rec.platform,
                       'published_url', p_published_url));

  -- 9–11. Notify organizer, team lead, designer.
  insert into public.notifications (user_id, title, body, entity_type, entity_id)
  select r.user_id,
         'Published: ' || t.task_code || ' (' || rec.platform || ')',
         'Version ' || coalesce(rec.submission_version::text, '?') || ' was published'
         || case when p_published_url is not null then '. ' || p_published_url else '.' end,
         'publishing', p_record_id::text
    from public.user_roles r
   where r.role = 'organizer'
      or (r.role = 'team_lead' and r.user_id = t.assigned_lead_id)
      or (r.role = 'designer' and r.user_id = t.assigned_designer_id);
end
$$;

-- SMM requests changes on a publishing record → enters Phase 3 revision workflow.
create or replace function public.request_publishing_changes(
  p_record_id uuid,
  p_instructions text,
  p_priority text default 'normal',
  p_deadline timestamptz default null,
  p_reference_urls jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_role public.app_role;
  rec    public.publishing_records%rowtype;
begin
  v_role := public._caller_role();
  if v_role not in ('social_media_manager', 'organizer') then
    raise exception 'Only Social Media Managers or Organizers may request publishing changes.';
  end if;
  if p_instructions is null or btrim(p_instructions) = '' then
    raise exception 'Revision instructions are required.';
  end if;

  select * into rec from public.publishing_records where id = p_record_id;
  if rec.id is null then raise exception 'Publishing record not found.'; end if;
  if not rec.is_current then raise exception 'Only the current publishing record can be changed.'; end if;
  if not public._publishing_allowed(rec.status, 'changes_requested') then
    raise exception 'Record in status % cannot be sent back for changes.', rec.status;
  end if;
  if rec.submission_id is null then
    raise exception 'No approved submission linked to this publishing record.';
  end if;

  -- Delegate to the Phase 3 revision workflow, which validates the handoff,
  -- creates the revision (SMM → organizer → lead → designer), invalidates
  -- the handoff, and moves the task to revision_awaiting_organizer.
  -- It requires status 'ready'; _publishing_allowed already gates this.
  return public.request_social_media_revision(
    p_record_id, p_instructions, p_priority, p_deadline, p_reference_urls);
end
$$;

-- ============================================================================
-- 6. Analytics RPCs.
-- ============================================================================

-- Organizer executive stats (full oversight).
create or replace function public.get_organizer_stats(
  p_start timestamptz default now() - interval '30 days',
  p_end   timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
  out    jsonb;
begin
  if public._caller_role() <> 'organizer' then raise exception 'Organizers only.'; end if;

  select jsonb_build_object(
    'total_tasks',            (select count(*) from public.tasks),
    'available',              (select count(*) from public.tasks where production_status = 'available'),
    'claimed',                (select count(*) from public.tasks where claimed_by is not null and production_status not in ('published','cancelled')),
    'assigned',               (select count(*) from public.tasks where production_status = 'assigned'),
    'in_progress',            (select count(*) from public.tasks where production_status in ('accepted','in_progress')),
    'awaiting_lead_review',   (select count(*) from public.tasks where production_status = 'submitted_lead_review'),
    'awaiting_organizer_review', (select count(*) from public.tasks where production_status = 'submitted_organizer_review'),
    'revision_required',      (select count(*) from public.tasks where production_status like 'revision%'),
    'ready_to_publish',       (select count(*) from public.tasks where production_status = 'ready_for_publishing'),
    'scheduled',              (select count(*) from public.publishing_records where is_current and status = 'scheduled'),
    'published',              (select count(*) from public.tasks where production_status = 'published'),
    'overdue',                (select count(*) from public.tasks where due_date < now() and production_status not in ('published','cancelled')),
    'cancelled',              (select count(*) from public.tasks where production_status = 'cancelled'),
    'pending_approvals',      (select count(*) from public.task_submissions s join public.tasks t on t.id = s.task_id
                                where s.is_current and s.status = 'submitted' and t.production_status in ('submitted_lead_review','submitted_organizer_review')),
    'publishing_overdue',     (select count(*) from public.publishing_records where is_current and status = 'scheduled' and scheduled_at < now()),
    'tasks_created_range',    (select count(*) from public.tasks where created_at between p_start and p_end),
    'published_range',        (select count(*) from public.publishing_records where is_current and status = 'published' and published_at between p_start and p_end)
  ) into out;
  return out;
end
$$;

-- Team Lead stats (scoped to own created + organizer-assigned tasks).
create or replace function public.get_lead_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  out   jsonb;
begin
  if public._caller_role() <> 'team_lead' then raise exception 'Team leads only.'; end if;

  select jsonb_build_object(
    'my_created_tasks',   (select count(*) from public.tasks where created_by = v_uid),
    'organizer_assignments', (select count(*) from public.tasks where assigned_lead_id = v_uid and created_by <> v_uid),
    'active_designs',     (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and production_status in ('assigned','accepted','in_progress')),
    'awaiting_my_review', (select count(*) from public.get_lead_review_queue()),
    'organizer_review_pending', (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and production_status = 'submitted_organizer_review'),
    'revision_required',  (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and production_status like 'revision%'),
    'approved_designs',   (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and production_status in ('ready_for_publishing','published')),
    'published_designs',  (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and production_status = 'published'),
    'overdue_tasks',      (select count(*) from public.tasks where (created_by = v_uid or assigned_lead_id = v_uid) and due_date < now() and production_status not in ('published','cancelled'))
  ) into out;
  return out;
end
$$;

-- Designer personal stats (own tasks only).
create or replace function public.get_designer_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  out   jsonb;
begin
  if public._caller_role() <> 'designer' then raise exception 'Designers only.'; end if;

  select jsonb_build_object(
    'my_active_tasks',  (select count(*) from public.tasks where (assigned_designer_id = v_uid or claimed_by = v_uid) and production_status not in ('published','cancelled')),
    'completed_designs',(select count(*) from public.task_submissions where designer_id = v_uid),
    'approved_designs', (select count(*) from public.task_submissions where designer_id = v_uid and status = 'approved'),
    'published_designs',(select count(*) from public.publishing_records pr join public.task_submissions s on s.id = pr.submission_id
                          where s.designer_id = v_uid and pr.is_current and pr.status = 'published'),
    'revision_requests',(select count(*) from public.revision_requests rr join public.task_submissions s on s.id = rr.submission_id
                          where s.designer_id = v_uid),
    'on_time_rate',     (select round(avg(case when s.submitted_at <= t.due_date then 1.0 else 0.0 end), 3)
                           from public.task_submissions s join public.tasks t on t.id = s.task_id
                          where s.designer_id = v_uid and t.due_date is not null),
    'avg_revisions',    (select round(avg(rc.cnt), 2) from (
                           select s.id, count(rr.id) as cnt from public.task_submissions s
                           left join public.revision_requests rr on rr.submission_id = s.id
                          where s.designer_id = v_uid group by s.id) rc)
  ) into out;
  return out;
end
$$;

-- Publishing metrics for the SMM studio.
create or replace function public.get_publishing_metrics()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
  out    jsonb;
begin
  v_role := public._caller_role();
  if v_role not in ('social_media_manager', 'organizer') then
    raise exception 'Social Media Managers or Organizers only.';
  end if;

  select jsonb_build_object(
    'ready',            (select count(*) from public.publishing_records where is_current and status = 'ready'),
    'scheduled',        (select count(*) from public.publishing_records where is_current and status = 'scheduled'),
    'pending',          (select count(*) from public.publishing_records where is_current and status = 'pending'),
    'overdue',          (select count(*) from public.publishing_records where is_current and status = 'scheduled' and scheduled_at < now()),
    'changes_requested',(select count(*) from public.publishing_records where status = 'changes_requested' and created_at > now() - interval '30 days'),
    'published_today',  (select count(*) from public.publishing_records where is_current and status = 'published' and published_at >= date_trunc('day', now())),
    'published_week',   (select count(*) from public.publishing_records where is_current and status = 'published' and published_at >= date_trunc('week', now())),
    'published_month',  (select count(*) from public.publishing_records where is_current and status = 'published' and published_at >= date_trunc('month', now())),
    'total_published',  (select count(*) from public.publishing_records where status = 'published'),
    'upcoming',         (select jsonb_agg(jsonb_build_object('id', id, 'task_id', task_id, 'platform', platform, 'scheduled_at', scheduled_at) order by scheduled_at)
                          from public.publishing_records where is_current and status = 'scheduled' and scheduled_at >= now())
  ) into out;
  return out;
end
$$;

-- ============================================================================
-- 7. Leaderboard: deterministic weighted scoring (documented below).
-- ============================================================================
--
-- Performance Score (0–100) =
--   0.30 × Quality + 0.25 × OnTime + 0.20 × Output + 0.15 × Reliability + 0.10 × Responsiveness
--
-- Quality (0–100):        first-pass approval rate adjusted by revision cycles.
--   base = approved_submissions / total_submissions * 100
--   penalty = avg_revisions_per_submission * 10 (capped at 40)
--   quality = greatest(base - penalty, 0)
-- OnTime (0–100):         % of submissions made on/before task due date.
-- Output (0–100):         complexity-weighted approved output, normalized:
--   raw = sum(weight(difficulty)) over approved submissions in period
--   output = least(raw / 10 * 100, 100)   (10 weighted units = full marks)
-- Reliability (0–100):    accepted-tasks completion rate:
--   completed = tasks reaching published/cancelled-terminal via designer's work
--   reliability = completed / accepted * 100
-- Responsiveness (0–100): assignment acknowledgment within 24h:
--   acked = assignments accepted within 24h of creation / total assignments * 100
-- Eligibility: >= 3 completed submissions in the period, else "Insufficient Data".

create or replace function public.calculate_designer_score(
  p_designer_id uuid,
  p_start date,
  p_end   date
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role      public.app_role;
  v_total_sub integer;
  v_approved  integer;
  v_avg_rev   numeric;
  v_on_time   numeric;
  v_output_raw numeric;
  v_accepted  integer;
  v_completed integer;
  v_ack_total integer;
  v_ack_fast  integer;
  v_quality   numeric;
  v_ontime    numeric;
  v_output    numeric;
  v_reliab    numeric;
  v_respons   numeric;
  v_total     numeric;
  v_eligible  boolean;
begin
  v_role := public._caller_role();
  -- Designers may only score themselves; leads see their scope; organizers all.
  if v_role = 'designer' and p_designer_id <> auth.uid() then
    raise exception 'Designers may only view their own score.';
  end if;
  if v_role = 'team_lead' then
    perform 1 from public.tasks t
     where (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
       and (t.assigned_designer_id = p_designer_id or t.claimed_by = p_designer_id)
     limit 1;
    if not found then raise exception 'Designer is outside your authorized scope.'; end if;
  end if;
  if v_role not in ('designer','team_lead','organizer','social_media_manager') then
    raise exception 'Not authorized.';
  end if;

  select count(*), count(*) filter (where status = 'approved')
    into v_total_sub, v_approved
    from public.task_submissions
   where designer_id = p_designer_id
     and submitted_at::date between p_start and p_end;

  select coalesce(avg(c.cnt), 0) into v_avg_rev from (
    select s.id, count(rr.id) as cnt
      from public.task_submissions s
      left join public.revision_requests rr on rr.submission_id = s.id
     where s.designer_id = p_designer_id
       and s.submitted_at::date between p_start and p_end
     group by s.id) c;

  select coalesce(avg(case when s.submitted_at <= t.due_date then 1.0 else 0.0 end), 0) * 100
    into v_on_time
    from public.task_submissions s join public.tasks t on t.id = s.task_id
   where s.designer_id = p_designer_id
     and s.submitted_at::date between p_start and p_end
     and t.due_date is not null;

  select coalesce(sum(w.weight), 0) into v_output_raw
    from public.task_submissions s
    join public.tasks t on t.id = s.task_id
    left join public.task_complexity_weights w
      on lower(w.difficulty) = lower(coalesce(t.difficulty, 'medium'))
   where s.designer_id = p_designer_id and s.status = 'approved'
     and s.submitted_at::date between p_start and p_end;

  select count(*) into v_accepted
    from public.tasks
   where (assigned_designer_id = p_designer_id or claimed_by = p_designer_id)
     and created_at::date between p_start and p_end;

  select count(*) into v_completed
    from public.tasks
   where (assigned_designer_id = p_designer_id or claimed_by = p_designer_id)
     and production_status = 'published'
     and created_at::date between p_start and p_end;

  select count(*), count(*) filter (where accepted_at is not null and accepted_at <= created_at + interval '24 hours')
    into v_ack_total, v_ack_fast
    from public.task_assignments
   where assignee_id = p_designer_id
     and created_at::date between p_start and p_end;

  v_eligible := v_total_sub >= 3;

  v_quality := greatest(coalesce(v_approved::numeric / nullif(v_total_sub, 0), 0) * 100 - least(v_avg_rev * 10, 40), 0);
  v_ontime  := coalesce(v_on_time, 0);
  v_output  := least(coalesce(v_output_raw, 0) / 10 * 100, 100);
  v_reliab  := coalesce(v_completed::numeric / nullif(v_accepted, 0), 0) * 100;
  v_respons := coalesce(v_ack_fast::numeric / nullif(v_ack_total, 0), 0) * 100;
  v_total   := round(0.30 * v_quality + 0.25 * v_ontime + 0.20 * v_output
                   + 0.15 * v_reliab + 0.10 * v_respons, 1);

  return jsonb_build_object(
    'designer_id', p_designer_id,
    'period_start', p_start, 'period_end', p_end,
    'eligible', v_eligible,
    'quality', round(v_quality, 1), 'on_time', round(v_ontime, 1),
    'output', round(v_output, 1), 'reliability', round(v_reliab, 1),
    'responsiveness', round(v_respons, 1),
    'total_score', case when v_eligible then v_total else null end,
    'sample_tasks', v_total_sub
  );
end
$$;

-- Ranked leaderboard for a period (organizer: all; lead: scoped; designer: self + board).
create or replace function public.get_leaderboard(
  p_start date,
  p_end   date,
  p_limit integer default 20
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public._caller_role();
  v_uid  uuid := auth.uid();
  out    jsonb;
begin
  if v_role is null then raise exception 'Not authenticated.'; end if;

  with designers as (
    select distinct s.designer_id as id
      from public.task_submissions s
     where s.submitted_at::date between p_start and p_end
       and (v_role = 'organizer'
            or (v_role = 'team_lead' and exists (
                  select 1 from public.tasks t
                   where t.id = s.task_id
                     and (t.created_by = v_uid or t.assigned_lead_id = v_uid)))
            or (v_role in ('designer','social_media_manager')))
  ),
  scores as (
    select d.id, public.calculate_designer_score(d.id, p_start, p_end) as sc
      from designers d
  )
  select jsonb_agg(row order by (row->>'rank')::int) into out from (
    select jsonb_build_object(
             'rank', row_number() over (order by (sc->>'total_score')::numeric desc nulls last),
             'designer_id', s.id,
             'designer_name', p.full_name,
             'score', sc
           ) as row
      from scores s join public.profiles p on p.id = s.id
     where (sc->>'eligible')::boolean
     order by (sc->>'total_score')::numeric desc nulls last
     limit p_limit
  ) ranked;

  return coalesce(out, '[]'::jsonb);
end
$$;

-- ============================================================================
-- 8. Bottleneck detection (deterministic rules, no AI).
-- ============================================================================
create or replace function public.detect_bottlenecks()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := public._caller_role();
  out    jsonb;
begin
  if v_role not in ('organizer','team_lead') then
    raise exception 'Organizers or Team Leads only.';
  end if;

  with scope as (
    select t.* from public.tasks t
     where v_role = 'organizer'
        or t.created_by = auth.uid() or t.assigned_lead_id = auth.uid()
  )
  select jsonb_build_object(
    'stale_reviews', (select jsonb_agg(jsonb_build_object('task_id', id, 'task_code', task_code, 'status', production_status, 'days_waiting', round(extract(epoch from (now() - updated_at))/86400, 1)))
                        from scope where production_status in ('submitted_lead_review','submitted_organizer_review') and updated_at < now() - interval '48 hours'),
    'overdue_submissions', (select jsonb_agg(jsonb_build_object('task_id', id, 'task_code', task_code, 'due_date', due_date))
                        from scope where due_date < now() and production_status not in ('published','cancelled')),
    'revision_loops', (select jsonb_agg(jsonb_build_object('task_id', task_id, 'task_code', (select task_code from public.tasks where id = rr.task_id), 'revision_count', cnt))
                        from (select task_id, count(*) as cnt from public.revision_requests group by task_id having count(*) >= 3) rr),
    'unpublished_approved', (select jsonb_agg(jsonb_build_object('task_id', task_id, 'platform', platform, 'days_waiting', round(extract(epoch from (now() - organizer_approved_at))/86400, 1)))
                        from public.publishing_records where is_current and status = 'ready' and organizer_approved_at < now() - interval '72 hours'),
    'unclaimed_urgent', (select jsonb_agg(jsonb_build_object('task_id', id, 'task_code', task_code))
                        from scope where production_status = 'available' and priority in ('urgent','critical') and claimed_by is null)
  ) into out;
  return out;
end
$$;

-- ============================================================================
-- 9. Deadline monitoring (called by pg_cron; deduped via notification_events).
-- ============================================================================
create or replace function public.check_deadlines()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
  v_key text;
begin
  -- Overdue scheduled posts.
  for r in
    select pr.id, pr.task_id, pr.platform, pr.scheduled_at, t.task_code
      from public.publishing_records pr join public.tasks t on t.id = pr.task_id
     where pr.is_current and pr.status = 'scheduled' and pr.scheduled_at < now()
  loop
    v_key := 'overdue_post:' || r.id::text || ':' || date_trunc('day', now())::text;
    if not exists (select 1 from public.notification_events where dedupe_key = v_key) then
      insert into public.notification_events (dedupe_key, title, body, entity_type, entity_id)
      values (v_key, 'Overdue post: ' || r.task_code, 'Platform ' || r.platform || ' was scheduled for ' || r.scheduled_at || ' and is overdue.', 'publishing', r.id::text);
      insert into public.notifications (user_id, title, body, entity_type, entity_id)
      select ur.user_id, 'Overdue post: ' || r.task_code,
             'Platform ' || r.platform || ' scheduled for ' || r.scheduled_at || ' is overdue.',
             'publishing', r.id::text
        from public.user_roles ur where ur.role in ('social_media_manager','organizer');
      v_count := v_count + 1;
    end if;
  end loop;

  -- Overdue design tasks.
  for r in
    select id, task_code, due_date, assigned_designer_id from public.tasks
     where due_date < now() and production_status not in ('published','cancelled')
  loop
    v_key := 'overdue_task:' || r.id::text || ':' || date_trunc('day', now())::text;
    if not exists (select 1 from public.notification_events where dedupe_key = v_key) then
      insert into public.notification_events (dedupe_key, user_id, title, body, entity_type, entity_id)
      values (v_key, r.assigned_designer_id, 'Overdue task: ' || r.task_code,
              'Due ' || r.due_date || ' has passed.', 'task', r.id::text);
      if r.assigned_designer_id is not null then
        insert into public.notifications (user_id, title, body, entity_type, entity_id)
        values (r.assigned_designer_id, 'Overdue task: ' || r.task_code,
                'Due ' || r.due_date || ' has passed.', 'task', r.id::text);
      end if;
      v_count := v_count + 1;
    end if;
  end loop;

  -- Stale reviews (>48h).
  for r in
    select id, task_code, production_status from public.tasks
     where production_status in ('submitted_lead_review','submitted_organizer_review')
       and updated_at < now() - interval '48 hours'
  loop
    v_key := 'stale_review:' || r.id::text || ':' || date_trunc('day', now())::text;
    if not exists (select 1 from public.notification_events where dedupe_key = v_key) then
      insert into public.notification_events (dedupe_key, title, body, entity_type, entity_id)
      values (v_key, 'Stale review: ' || r.task_code,
              'Awaiting review for over 48 hours (' || r.production_status || ').', 'task', r.id::text);
      insert into public.notifications (user_id, title, body, entity_type, entity_id)
      select ur.user_id, 'Stale review: ' || r.task_code,
             'Awaiting review for over 48 hours.', 'task', r.id::text
        from public.user_roles ur where ur.role in ('organizer','team_lead');
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end
$$;

-- Best-effort pg_cron scheduling (never fails the migration).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available; skipping scheduled deadline checks.';
    return;
  end;
  begin
    perform cron.unschedule('designflow-deadline-check');
  exception when others then null; end;
  begin
    perform cron.schedule('designflow-deadline-check', '0 * * * *', 'select public.check_deadlines();');
  exception when others then
    raise notice 'Could not schedule pg_cron job; deadline checks remain manual via check_deadlines().';
  end;
end
$$;

-- ============================================================================
-- 10. RLS for new tables (deny by default; scoped SELECT; RPC-only writes).
-- ============================================================================
alter table public.publishing_events      enable row level security;
alter table public.performance_snapshots  enable row level security;
alter table public.leaderboard_periods    enable row level security;
alter table public.task_complexity_weights enable row level security;
alter table public.notification_events   enable row level security;

-- publishing_events: visible to organizers, involved lead/designer/SMM.
drop policy if exists "publishing_events_scoped" on public.publishing_events;
create policy "publishing_events_scoped" on public.publishing_events
  for select to authenticated using (
    public.is_organizer()
    or exists (select 1 from public.tasks t where t.id = publishing_events.task_id
                 and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid()
                      or t.assigned_designer_id = auth.uid() or t.claimed_by = auth.uid()))
    or public._caller_role() = 'social_media_manager'
  );

-- performance_snapshots: organizer all; designer own; lead scoped via function.
drop policy if exists "performance_snapshots_scoped" on public.performance_snapshots;
create policy "performance_snapshots_scoped" on public.performance_snapshots
  for select to authenticated using (
    public.is_organizer()
    or designer_id = auth.uid()
  );

-- leaderboard_periods: everyone can read active periods.
drop policy if exists "leaderboard_periods_read" on public.leaderboard_periods;
create policy "leaderboard_periods_read" on public.leaderboard_periods
  for select to authenticated using (true);

-- task_complexity_weights: read for all authenticated; writes organizer-only via RPC.
drop policy if exists "task_complexity_weights_read" on public.task_complexity_weights;
create policy "task_complexity_weights_read" on public.task_complexity_weights
  for select to authenticated using (true);

-- notification_events: organizer + owner.
drop policy if exists "notification_events_scoped" on public.notification_events;
create policy "notification_events_scoped" on public.notification_events
  for select to authenticated using (
    public.is_organizer() or user_id = auth.uid() or user_id is null
  );

-- publishing_records: tighten SMM to own managed records + ready queue.
-- (Existing 005 policies remain; add SMM scoped update guard via RPC-only writes.)
-- Direct writes stay denied: no insert/update/delete policies for non-organizers.

-- ============================================================================
-- 11. Grants + realtime.
-- ============================================================================
grant execute on function public._publishing_allowed(text, text) to authenticated;
grant execute on function public._caller_role() to authenticated;
grant execute on function public.transition_publishing_status(uuid, text, text) to authenticated;
grant execute on function public.schedule_publishing(uuid, timestamptz, text) to authenticated;
grant execute on function public.mark_published(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.request_publishing_changes(uuid, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.get_organizer_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_lead_stats() to authenticated;
grant execute on function public.get_designer_stats() to authenticated;
grant execute on function public.get_publishing_metrics() to authenticated;
grant execute on function public.calculate_designer_score(uuid, date, date) to authenticated;
grant execute on function public.get_leaderboard(date, date, integer) to authenticated;
grant execute on function public.detect_bottlenecks() to authenticated;
grant execute on function public.check_deadlines() to authenticated;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication missing; skipping.';
    return;
  end if;
  foreach t in array array['publishing_records','publishing_events','performance_snapshots','notification_events']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end
$$;
