-- ============================================================================
-- DesignFlow OS — Migration 004: Phase 2 security hardening
-- Idempotent. Applies on top of 003.
--
-- 1. public.is_active_team_member(uuid): helper — true when the user holds
--    at least one active team_members row and an active profile.
-- 2. claim_task: additionally requires an ACTIVE TEAM MEMBERSHIP
--    (designer role alone is not enough).
-- 3. get_task_board: restricted to the designer role (organizers/leads use
--    their own list views; social_media_manager must never see unfinished
--    public tasks).
-- 4. reassign_task: assigning a designer PRESERVES assigned_lead_id, so the
--    organizer -> team_lead -> designer accountability chain stays visible.
--    Assigning a team_lead transfers lead accountability.
-- 5. publish_task: when a PUBLIC task becomes available, every eligible
--    active designer team member gets a privacy-safe notification
--    (task code + title only, never brief/spec content).
-- 6. Seeds the default "DesignFlow" team and adds the organizer as an
--    active member (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) Active team membership helper (internal; not granted to clients).
-- ---------------------------------------------------------------------------
create or replace function public.is_active_team_member(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1
      from public.team_members tm
      join public.profiles p on p.id = tm.user_id
     where tm.user_id = p_user_id
       and tm.is_active
       and p.is_active
  );
$$;
comment on function public.is_active_team_member(uuid) is 'True when the user holds at least one active team membership and an active profile. Internal helper for task API functions.';
revoke all on function public.is_active_team_member(uuid) from public;

-- ---------------------------------------------------------------------------
-- (2) claim_task: designer role + active team membership + atomic claim.
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

  -- Active team membership is required to claim: an active profile alone
  -- is not enough (prevents orphaned or not-yet-onboarded accounts from
  -- taking work off the public board).
  if not public.is_active_team_member(v_uid) then
    raise exception 'Only active team members can claim public tasks.';
  end if;

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
comment on function public.claim_task(uuid) is 'Atomic claim of a public+available task: caller must be a designer with an active profile AND an active team membership. Single UPDATE...WHERE...RETURNING guarantees exactly one winner under concurrency (no TOCTOU). Returns ok:false/already_claimed otherwise. Notifies creator (and lead). Writes task_events. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- (3) get_task_board: designer role only.
-- ---------------------------------------------------------------------------
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
  v_role   app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  select p.is_active, r.role into v_active, v_role
    from public.profiles p
    left join public.user_roles r on r.user_id = p.id
   where p.id = v_uid;
  if v_active is null or not v_active then
    raise exception 'An active profile is required.' using errcode = '28000';
  end if;
  -- Only designers may read the public board. Organizers and team leads
  -- have their own list views; social_media_manager must never see
  -- unfinished tasks.
  if v_role is distinct from 'designer' then
    raise exception 'Only designers can access the task board.' using errcode = '42501';
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
comment on function public.get_task_board() is 'Task board feed: public tasks that are available or in_progress, with claimant names. Caller must be an active designer (role-enforced). SECURITY DEFINER so it works for designers despite restrictive RLS on tasks/profiles; exposes no private brief data.';

-- ---------------------------------------------------------------------------
-- (4) reassign_task: preserve the accountable team lead on designer
-- delegation (organizer -> team_lead -> designer chain stays visible).
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

  -- Delegating to a designer PRESERVES the accountable lead
  -- (t.assigned_lead_id); assigning a team_lead transfers lead
  -- accountability to the new lead and clears the designer slot.
  update public.tasks
     set assigned_designer_id = case when v_is_lead then null else p_new_assignee_id end,
         assigned_lead_id     = case when v_is_lead then p_new_assignee_id else t.assigned_lead_id end,
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
comment on function public.reassign_task(uuid, uuid) is 'Reassigns a task to an active designer (or team_lead for delegation). Delegating to a designer preserves assigned_lead_id so the organizer -> lead -> designer chain stays visible; assigning a team_lead transfers lead accountability. Organizer, or team_lead on tasks they created/lead. Supersedes open offers, writes task_events, notifies the new assignee. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- (5) publish_task: notify eligible designers when a PUBLIC task goes live.
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
  v_pid  uuid;
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

  -- Fan out to eligible designers when a PUBLIC task becomes claimable.
  -- Privacy-safe: task code + title only, never brief/spec content.
  if t.visibility = 'public' then
    for v_pid in
      select p.id
        from public.profiles p
        join public.user_roles r on r.user_id = p.id
       where r.role = 'designer'
         and p.is_active
         and p.id <> v_uid
         and public.is_active_team_member(p.id)
    loop
      perform public._insert_notification(v_pid,
        'New public task: ' || t.task_code, t.title, 'task', p_task_id::text);
    end loop;
  end if;
end;
$$;
comment on function public.publish_task(uuid) is 'Moves a draft task to available (public board). Only the creator or an organizer. Publishing a PUBLIC task notifies every eligible active designer team member (code + title only). Writes a task_events audit row. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- (6) Seed the default team and the organizer membership (idempotent).
-- ---------------------------------------------------------------------------
do $$
declare
  v_team_id uuid;
  v_org_id  uuid;
begin
  select id into v_team_id from public.teams where name = 'DesignFlow' limit 1;
  if v_team_id is null then
    insert into public.teams (name, description)
    values ('DesignFlow', 'Default DesignFlow team')
    returning id into v_team_id;
  end if;

  select id into v_org_id
    from public.profiles
   where email = 'faizankhan.work@proton.me'
   limit 1;
  if v_org_id is not null then
    insert into public.team_members (team_id, user_id, is_active)
    values (v_team_id, v_org_id, true)
    on conflict (team_id, user_id) do update set is_active = true;
  end if;
end
$$;
