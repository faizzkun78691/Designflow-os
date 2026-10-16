-- ============================================================================
-- DesignFlow OS — Migration 005: Phase 3 submission & approval workflow
-- Idempotent. Applies on top of 004.
--
-- Extends the skeletal 002 workflow tables into a production submission /
-- multi-level approval / revision-routing engine:
--
--   Designer -> Team Lead -> Organizer -> Social Media Manager
--
-- New task states: submitted_lead_review, submitted_organizer_review,
--   ready_for_publishing, revision_awaiting_organizer, revision_awaiting_lead,
--   revision_required_designer
--
-- Tables: task_submissions (versioned, immutable), task_approvals (one per
--   stage per submission), revision_requests (staged routing), 
--   revision_routing_events (append-only trail), publishing_records extended
--   into publishing handoffs.
--
-- All mutations go through SECURITY DEFINER functions; authenticated
-- clients get SELECT-only RLS. No frontend-only security.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend the production_status check constraint with Phase 3 states.
-- ---------------------------------------------------------------------------
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
      'revision_awaiting_organizer', 'revision_awaiting_lead', 'revision_required_designer'
    ));
end
$$;

-- ---------------------------------------------------------------------------
-- 2. task_submissions — versioned, immutable submission records.
-- ---------------------------------------------------------------------------
alter table public.task_submissions
  add column if not exists source_url           text,
  add column if not exists preview_url          text,
  add column if not exists reference_links      jsonb not null default '[]'::jsonb,
  add column if not exists checklist_confirmed   boolean not null default false,
  add column if not exists status                text not null default 'submitted'
    check (status in ('submitted','lead_approved','organizer_approved','revision_requested','superseded')),
  add column if not exists is_current            boolean not null default true,
  add column if not exists submitted_at          timestamptz not null default now();

-- Backfill: existing rows (if any) are current.
update public.task_submissions set is_current = true where is_current is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_submissions_task_version_unique') then
    alter table public.task_submissions
      add constraint task_submissions_task_version_unique unique (task_id, version);
  end if;
end
$$;
-- Exactly one current version per task (partial unique index: multiple
-- non-current versions are allowed, only one current).
drop index if exists public.task_submissions_one_current_idx;
create unique index task_submissions_one_current_idx
  on public.task_submissions (task_id) where is_current;

create index if not exists idx_task_submissions_task   on public.task_submissions (task_id);
create index if not exists idx_task_submissions_designer on public.task_submissions (designer_id);

-- Immutability: once written, only is_current / status may change, and only
-- via the SECURITY DEFINER workflow functions (they run as the table owner,
-- so this trigger constrains everyone equally — including the functions —
-- to the allowed column set).
create or replace function public.protect_submission_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Submissions are immutable and cannot be deleted.';
  end if;
  if OLD.drive_link      is distinct from NEW.drive_link
     or OLD.source_url   is distinct from NEW.source_url
     or OLD.preview_url  is distinct from NEW.preview_url
     or OLD.notes        is distinct from NEW.notes
     or OLD.version      is distinct from NEW.version
     or OLD.task_id      is distinct from NEW.task_id
     or OLD.designer_id  is distinct from NEW.designer_id
     or OLD.reference_links is distinct from NEW.reference_links
     or OLD.checklist_confirmed is distinct from NEW.checklist_confirmed
     or OLD.submitted_at is distinct from NEW.submitted_at then
    raise exception 'Submitted versions are immutable; create a new version instead.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_task_submissions_immutable on public.task_submissions;
create trigger trg_task_submissions_immutable
before update or delete on public.task_submissions
for each row execute function public.protect_submission_immutable();

-- ---------------------------------------------------------------------------
-- 3. task_approvals — one decision per review stage per submission.
-- ---------------------------------------------------------------------------
alter table public.task_approvals
  add column if not exists task_id            uuid references public.tasks(id) on delete cascade,
  add column if not exists submission_version integer,
  add column if not exists stage              text
    check (stage in ('team_lead','organizer'));

-- Backfill task_id/version from the submission where missing.
update public.task_approvals a
   set task_id = s.task_id,
       submission_version = s.version
  from public.task_submissions s
 where a.submission_id = s.id
   and (a.task_id is null or a.submission_version is null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_approvals_one_per_stage') then
    alter table public.task_approvals
      add constraint task_approvals_one_per_stage unique (submission_id, stage);
  end if;
end
$$;

create index if not exists idx_task_approvals_task    on public.task_approvals (task_id);
create index if not exists idx_task_approvals_approver on public.task_approvals (approver_id);

-- Approvals are append-only.
create or replace function public.protect_approval_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Approval records are append-only.';
end;
$$;

drop trigger if exists trg_task_approvals_append_only on public.task_approvals;
create trigger trg_task_approvals_append_only
before update or delete on public.task_approvals
for each row execute function public.protect_approval_append_only();

-- ---------------------------------------------------------------------------
-- 4. revision_requests — staged routing with full instruction chain.
-- ---------------------------------------------------------------------------
alter table public.revision_requests
  add column if not exists task_id               uuid references public.tasks(id) on delete cascade,
  add column if not exists submission_version    integer,
  add column if not exists source_role           public.app_role,
  add column if not exists original_instructions text,
  add column if not exists clarification         text,
  add column if not exists reference_urls        jsonb not null default '[]'::jsonb,
  add column if not exists priority              text,
  add column if not exists suggested_deadline    timestamptz,
  add column if not exists current_stage         text not null default 'with_designer'
    check (current_stage in ('awaiting_organizer','awaiting_lead','with_designer','resolved')),
  add column if not exists current_owner_id      uuid references public.profiles(id),
  add column if not exists acknowledged_at       timestamptz,
  add column if not exists forwarded_at          timestamptz,
  add column if not exists resolved_by_submission_id uuid references public.task_submissions(id);

-- Backfill task_id from submission where missing.
update public.revision_requests r
   set task_id = s.task_id,
       submission_version = s.version
  from public.task_submissions s
 where r.submission_id = s.id
   and (r.task_id is null or r.submission_version is null);

create index if not exists idx_revision_requests_task   on public.revision_requests (task_id);
create index if not exists idx_revision_requests_owner  on public.revision_requests (current_owner_id);
create index if not exists idx_revision_requests_stage  on public.revision_requests (current_stage);

-- ---------------------------------------------------------------------------
-- 5. revision_routing_events — append-only routing trail.
-- ---------------------------------------------------------------------------
create table if not exists public.revision_routing_events (
  id          uuid        primary key default gen_random_uuid(),
  revision_id uuid        not null references public.revision_requests(id) on delete cascade,
  actor_id    uuid        references public.profiles(id),
  from_stage  text,
  to_stage    text,
  action      text        not null
    check (action in ('requested','acknowledged','forwarded','resolved')),
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_revision_routing_events_revision
  on public.revision_routing_events (revision_id);

drop trigger if exists trg_revision_routing_events_append_only on public.revision_routing_events;
create trigger trg_revision_routing_events_append_only
before update or delete on public.revision_routing_events
for each row execute function public.protect_approval_append_only();

-- ---------------------------------------------------------------------------
-- 6. publishing_records — extend into Phase 3 publishing handoffs.
-- ---------------------------------------------------------------------------
alter table public.publishing_records
  add column if not exists submission_id       uuid references public.task_submissions(id) on delete cascade,
  add column if not exists submission_version  integer,
  add column if not exists source_url          text,
  add column if not exists instructions        text,
  add column if not exists preferred_date      date,
  add column if not exists preferred_time      time,
  add column if not exists organizer_approved_at timestamptz,
  add column if not exists is_current           boolean not null default true;

-- 'ready' = Phase 3 handoff; 'pending' legacy; 'superseded' invalidated by revision.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publishing_records_status_check') then
    alter table public.publishing_records
      add constraint publishing_records_status_check
      check (status in ('pending','ready','superseded','scheduled','published'));
  end if;
end
$$;

drop index if exists public.publishing_records_one_current_idx;
create unique index publishing_records_one_current_idx
  on public.publishing_records (task_id) where is_current;

create index if not exists idx_publishing_records_managed_by on public.publishing_records (managed_by);
create index if not exists idx_publishing_records_status     on public.publishing_records (status);

comment on table public.publishing_records is 'Phase 3 publishing handoffs: organizer-approved submission versions made available to Social Media Managers. One current handoff per task; superseded on revision.';

-- ---------------------------------------------------------------------------
-- 7. RLS — deny by default; SELECT-only for authenticated.
-- ---------------------------------------------------------------------------
alter table public.task_submissions      enable row level security;
alter table public.task_approvals        enable row level security;
alter table public.revision_requests     enable row level security;
alter table public.revision_routing_events enable row level security;
alter table public.publishing_records    enable row level security;

-- task_submissions: organizer all; lead for own/led tasks; designer own.
drop policy if exists "task_submissions_organizer_all" on public.task_submissions;
create policy "task_submissions_organizer_all" on public.task_submissions
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "task_submissions_select_lead" on public.task_submissions;
create policy "task_submissions_select_lead" on public.task_submissions
  for select to authenticated using (
    public.current_user_role() = 'team_lead'
    and exists (
      select 1 from public.tasks t
       where t.id = task_submissions.task_id
         and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
    )
  );

drop policy if exists "task_submissions_select_designer" on public.task_submissions;
create policy "task_submissions_select_designer" on public.task_submissions
  for select to authenticated using (
    public.current_user_role() = 'designer'
    and task_submissions.designer_id = auth.uid()
  );
-- Note: social_media_manager has NO select on task_submissions (handoffs only).

-- task_approvals: same scoping as submissions.
drop policy if exists "task_approvals_organizer_all" on public.task_approvals;
create policy "task_approvals_organizer_all" on public.task_approvals
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "task_approvals_select_lead" on public.task_approvals;
create policy "task_approvals_select_lead" on public.task_approvals
  for select to authenticated using (
    public.current_user_role() = 'team_lead'
    and exists (
      select 1 from public.tasks t
       where t.id = task_approvals.task_id
         and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
    )
  );

drop policy if exists "task_approvals_select_designer" on public.task_approvals;
create policy "task_approvals_select_designer" on public.task_approvals
  for select to authenticated using (
    public.current_user_role() = 'designer'
    and exists (
      select 1 from public.task_submissions s
       where s.id = task_approvals.submission_id
         and s.designer_id = auth.uid()
    )
  );

-- revision_requests: organizer all; lead scoped; designer own tasks; SMM own requests.
drop policy if exists "revision_requests_organizer_all" on public.revision_requests;
create policy "revision_requests_organizer_all" on public.revision_requests
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "revision_requests_select_lead" on public.revision_requests;
create policy "revision_requests_select_lead" on public.revision_requests
  for select to authenticated using (
    public.current_user_role() = 'team_lead'
    and exists (
      select 1 from public.tasks t
       where t.id = revision_requests.task_id
         and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
    )
  );

drop policy if exists "revision_requests_select_designer" on public.revision_requests;
create policy "revision_requests_select_designer" on public.revision_requests
  for select to authenticated using (
    public.current_user_role() = 'designer'
    and exists (
      select 1 from public.tasks t
       where t.id = revision_requests.task_id
         and (t.assigned_designer_id = auth.uid() or t.claimed_by = auth.uid())
    )
  );

drop policy if exists "revision_requests_select_smm" on public.revision_requests;
create policy "revision_requests_select_smm" on public.revision_requests
  for select to authenticated using (
    public.current_user_role() = 'social_media_manager'
    and revision_requests.requested_by = auth.uid()
  );

-- revision_routing_events: visible to anyone who can see the revision.
drop policy if exists "revision_routing_events_organizer_all" on public.revision_routing_events;
create policy "revision_routing_events_organizer_all" on public.revision_routing_events
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "revision_routing_events_select_scoped" on public.revision_routing_events;
create policy "revision_routing_events_select_scoped" on public.revision_routing_events
  for select to authenticated using (
    exists (
      select 1 from public.revision_requests r
       where r.id = revision_routing_events.revision_id
         and (
           (public.current_user_role() = 'team_lead' and exists (
              select 1 from public.tasks t where t.id = r.task_id
                and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())))
           or (public.current_user_role() = 'designer' and exists (
              select 1 from public.tasks t where t.id = r.task_id
                and (t.assigned_designer_id = auth.uid() or t.claimed_by = auth.uid())))
           or (public.current_user_role() = 'social_media_manager' and r.requested_by = auth.uid())
         )
    )
  );

-- publishing_records: organizer all; lead scoped; designer own tasks (read-only
-- view of handoff); SMM sees ready handoffs (their publishing queue).
drop policy if exists "publishing_records_organizer_all" on public.publishing_records;
create policy "publishing_records_organizer_all" on public.publishing_records
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "publishing_records_select_lead" on public.publishing_records;
create policy "publishing_records_select_lead" on public.publishing_records
  for select to authenticated using (
    public.current_user_role() = 'team_lead'
    and exists (
      select 1 from public.tasks t
       where t.id = publishing_records.task_id
         and (t.created_by = auth.uid() or t.assigned_lead_id = auth.uid())
    )
  );

drop policy if exists "publishing_records_select_designer" on public.publishing_records;
create policy "publishing_records_select_designer" on public.publishing_records
  for select to authenticated using (
    public.current_user_role() = 'designer'
    and exists (
      select 1 from public.tasks t
       where t.id = publishing_records.task_id
         and (t.assigned_designer_id = auth.uid() or t.claimed_by = auth.uid())
    )
  );

drop policy if exists "publishing_records_select_smm" on public.publishing_records;
create policy "publishing_records_select_smm" on public.publishing_records
  for select to authenticated using (
    public.current_user_role() = 'social_media_manager'
    and publishing_records.status = 'ready'
    and publishing_records.is_current
  );

-- ---------------------------------------------------------------------------
-- 8. Internal helpers.
-- ---------------------------------------------------------------------------

-- Resolve the responsible team lead for a task: assigned lead, else the
-- creator if they are a lead, else null.
create or replace function public._task_lead_id(p_task_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select t.assigned_lead_id from public.tasks t where t.id = p_task_id),
    (select t.created_by from public.tasks t
      where t.id = p_task_id
        and exists (select 1 from public.user_roles r
                     where r.user_id = t.created_by and r.role = 'team_lead'))
  );
$$;
revoke all on function public._task_lead_id(uuid) from public;

-- Validate an https URL against the approved-host list.
create or replace function public._is_approved_design_url(p_url text)
returns boolean
language sql
immutable
as $$
  select p_url ~* '^https://([a-z0-9-]+\.)*(drive\.google\.com|docs\.google\.com|figma\.com|canva\.com|dropbox\.com|notion\.so|miro\.com)(/|$|:)' ;
$$;
revoke all on function public._is_approved_design_url(text) from public;

-- ---------------------------------------------------------------------------
-- 9. submit_design — designer submits (or resubmits) work.
-- Only the assigned/claimed designer; task must be in a submittable state.
-- Creates an immutable version, resolves open designer-stage revisions,
-- moves the task to Team Lead review, notifies the lead.
-- ---------------------------------------------------------------------------
create or replace function public.submit_design(
  p_task_id            uuid,
  p_drive_link         text,
  p_source_url         text default null,
  p_preview_url        text default null,
  p_notes              text default null,
  p_checklist_confirmed boolean default false,
  p_reference_links    jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     app_role;
  v_uid      uuid := auth.uid();
  t          public.tasks%rowtype;
  v_version  integer;
  v_sub_id   uuid;
  v_lead_id  uuid;
  v_rev_id   uuid;
begin
  v_role := public._require_task_caller(array['designer']::app_role[]);

  -- Lock the task row first: version numbering + state change are atomic.
  select * into t from public.tasks where id = p_task_id for update;
  if t.id is null then
    raise exception 'Task not found.';
  end if;
  if not (t.assigned_designer_id = v_uid or t.claimed_by = v_uid) then
    raise exception 'Only the assigned designer may submit work for this task.';
  end if;
  if t.production_status not in ('assigned','accepted','in_progress','revision_required_designer') then
    raise exception 'Task is not in a submittable state (current: %).', t.production_status;
  end if;

  if p_drive_link is null or btrim(p_drive_link) = '' then
    raise exception 'A design URL is required.';
  end if;
  if not public._is_approved_design_url(p_drive_link) then
    raise exception 'Design URL must be an https link from an approved host (Google Drive, Figma, Canva, Dropbox, Notion, Miro).';
  end if;
  if p_source_url is not null and btrim(p_source_url) <> ''
     and not public._is_approved_design_url(p_source_url) then
    raise exception 'Source URL must be an https link from an approved host.';
  end if;
  if p_preview_url is not null and btrim(p_preview_url) <> ''
     and left(btrim(p_preview_url), 8) <> 'https://' then
    raise exception 'Preview URL must start with https://.';
  end if;
  if p_reference_links is not null then
    if jsonb_typeof(p_reference_links) <> 'array' then
      raise exception 'reference_links must be a JSON array.';
    end if;
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.task_submissions where task_id = p_task_id;

  -- Flip previous current versions (trigger allows is_current/status flips).
  update public.task_submissions
     set is_current = false,
         status = case when status = 'submitted' then 'superseded' else status end
   where task_id = p_task_id and is_current;

  insert into public.task_submissions
    (task_id, designer_id, drive_link, source_url, preview_url, notes,
     version, reference_links, checklist_confirmed, status, is_current)
  values
    (p_task_id, v_uid, btrim(p_drive_link),
     nullif(btrim(coalesce(p_source_url,'')), ''),
     nullif(btrim(coalesce(p_preview_url,'')), ''),
     nullif(p_notes, ''),
     v_version,
     coalesce(p_reference_links, '[]'::jsonb),
     coalesce(p_checklist_confirmed, false),
     'submitted', true)
  returning id into v_sub_id;

  -- Resolve any open revision sitting with the designer.
  update public.revision_requests
     set current_stage = 'resolved',
         status = 'resolved',
         resolved_at = now(),
         resolved_by_submission_id = v_sub_id
   where task_id = p_task_id
     and current_stage = 'with_designer'
     and status = 'open'
  returning id into v_rev_id;

  if v_rev_id is not null then
    insert into public.revision_routing_events
      (revision_id, actor_id, from_stage, to_stage, action, note)
    values
      (v_rev_id, v_uid, 'with_designer', 'resolved', 'resolved',
       'Resolved by submission version ' || v_version);
  end if;

  update public.tasks
     set production_status = 'submitted_lead_review'
   where id = p_task_id;

  perform public._log_task_event(p_task_id, 'design_submitted', jsonb_build_object(
    'submission_id', v_sub_id,
    'version', v_version,
    'designer_id', v_uid,
    'resolved_revision_id', v_rev_id
  ));

  v_lead_id := public._task_lead_id(p_task_id);
  if v_lead_id is not null then
    perform public._insert_notification(v_lead_id,
      'Design submitted for review: ' || t.task_code,
      'Version ' || v_version || ' is awaiting your review.', 'task', p_task_id::text);
  else
    -- No lead on this task: surface to organizers instead.
    for v_lead_id in
      select r.user_id from public.user_roles r
        join public.profiles p on p.id = r.user_id
       where r.role = 'organizer' and p.is_active
    loop
      perform public._insert_notification(v_lead_id,
        'Design submitted (no lead assigned): ' || t.task_code,
        'Version ' || v_version || ' needs a reviewer.', 'task', p_task_id::text);
    end loop;
  end if;

  return v_sub_id;
end;
$$;
comment on function public.submit_design(uuid, text, text, text, text, boolean, jsonb) is 'Designer submits work: validates URLs, creates an immutable version (N+1), resolves open designer-stage revisions, moves task to submitted_lead_review, notifies the lead. SECURITY DEFINER; task row locked for atomic versioning.';

-- ---------------------------------------------------------------------------
-- 10. approve_as_team_lead — lead approves the current submission.
-- ---------------------------------------------------------------------------
create or replace function public.approve_as_team_lead(
  p_submission_id uuid,
  p_comment       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
  s      public.task_submissions%rowtype;
  t      public.tasks%rowtype;
begin
  v_role := public._require_task_caller(array['team_lead']::app_role[]);

  select * into s from public.task_submissions where id = p_submission_id;
  if s.id is null then
    raise exception 'Submission not found.';
  end if;
  if not s.is_current then
    raise exception 'Only the current submission version can be approved.';
  end if;

  select * into t from public.tasks where id = s.task_id for update;
  if t.production_status <> 'submitted_lead_review' then
    raise exception 'Submission is not awaiting Team Lead review (task: %).', t.production_status;
  end if;
  if not (t.created_by = v_uid or t.assigned_lead_id = v_uid) then
    raise exception 'Only the responsible Team Lead may approve this submission.';
  end if;

  insert into public.task_approvals
    (submission_id, task_id, submission_version, approver_id, approver_role, stage, decision, comment)
  values
    (s.id, s.task_id, s.version, v_uid, v_role, 'team_lead', 'approved', nullif(p_comment,''));

  update public.task_submissions
     set status = 'lead_approved'
   where id = s.id;

  update public.tasks
     set production_status = 'submitted_organizer_review'
   where id = s.task_id;

  perform public._log_task_event(s.task_id, 'team_lead_approved', jsonb_build_object(
    'submission_id', s.id,
    'version', s.version,
    'approver_id', v_uid
  ));

  -- Notify organizers.
  for v_uid in
    select r.user_id from public.user_roles r
      join public.profiles p on p.id = r.user_id
     where r.role = 'organizer' and p.is_active
  loop
    perform public._insert_notification(v_uid,
      'Submission awaiting Organizer review: ' || t.task_code,
      'Version ' || s.version || ' approved by Team Lead.', 'task', s.task_id::text);
  end loop;
end;
$$;
comment on function public.approve_as_team_lead(uuid, text) is 'Team Lead approves the current submission: one approval per stage (unique constraint blocks doubles), task moves to submitted_organizer_review, organizers notified. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 11. request_team_lead_revision — lead sends it back to the designer.
-- ---------------------------------------------------------------------------
create or replace function public.request_team_lead_revision(
  p_submission_id uuid,
  p_instructions  text,
  p_priority      text default null,
  p_deadline      timestamptz default null,
  p_reference_urls jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  app_role;
  v_uid   uuid := auth.uid();
  s       public.task_submissions%rowtype;
  t       public.tasks%rowtype;
  v_rev   uuid;
begin
  v_role := public._require_task_caller(array['team_lead']::app_role[]);

  if p_instructions is null or btrim(p_instructions) = '' then
    raise exception 'Revision instructions are required.';
  end if;

  select * into s from public.task_submissions where id = p_submission_id;
  if s.id is null then
    raise exception 'Submission not found.';
  end if;
  if not s.is_current then
    raise exception 'Only the current submission version can receive a revision request.';
  end if;

  select * into t from public.tasks where id = s.task_id for update;
  if t.production_status <> 'submitted_lead_review' then
    raise exception 'Submission is not awaiting Team Lead review (task: %).', t.production_status;
  end if;
  if not (t.created_by = v_uid or t.assigned_lead_id = v_uid) then
    raise exception 'Only the responsible Team Lead may request changes.';
  end if;

  insert into public.revision_requests
    (submission_id, task_id, submission_version, requested_by, source_role,
     request_text, original_instructions, reference_urls, priority,
     suggested_deadline, current_stage, current_owner_id, status)
  values
    (s.id, s.task_id, s.version, v_uid, 'team_lead',
     btrim(p_instructions), btrim(p_instructions),
     coalesce(p_reference_urls, '[]'::jsonb), p_priority,
     p_deadline, 'with_designer', s.designer_id, 'open')
  returning id into v_rev;

  insert into public.revision_routing_events
    (revision_id, actor_id, from_stage, to_stage, action, note)
  values
    (v_rev, v_uid, 'submitted_lead_review', 'with_designer', 'requested',
     'Team Lead requested changes on version ' || s.version);

  update public.task_submissions set status = 'revision_requested' where id = s.id;

  update public.tasks set production_status = 'revision_required_designer'
   where id = s.task_id;

  perform public._log_task_event(s.task_id, 'revision_requested', jsonb_build_object(
    'revision_id', v_rev,
    'source_role', 'team_lead',
    'submission_version', s.version
  ));

  perform public._insert_notification(s.designer_id,
    'Revision requested: ' || t.task_code,
    'The Team Lead requested changes on version ' || s.version || '.', 'task', s.task_id::text);

  return v_rev;
end;
$$;
comment on function public.request_team_lead_revision(uuid, text, text, timestamptz, jsonb) is 'Team Lead requests changes: creates a staged revision (Team Lead -> Designer), task moves to revision_required_designer, designer notified. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 12. approve_as_organizer — final approval; creates the publishing handoff.
-- ---------------------------------------------------------------------------
create or replace function public.approve_as_organizer(
  p_submission_id uuid,
  p_comment       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  app_role;
  v_uid   uuid := auth.uid();
  s       public.task_submissions%rowtype;
  t       public.tasks%rowtype;
  b       public.task_briefs%rowtype;
  v_hand  uuid;
  v_smm   uuid;
begin
  v_role := public._require_task_caller(array['organizer']::app_role[]);

  select * into s from public.task_submissions where id = p_submission_id;
  if s.id is null then
    raise exception 'Submission not found.';
  end if;
  if not s.is_current then
    raise exception 'Only the current submission version can be approved.';
  end if;

  select * into t from public.tasks where id = s.task_id for update;
  if t.production_status <> 'submitted_organizer_review' then
    raise exception 'Submission is not awaiting Organizer review (task: %).', t.production_status;
  end if;

  insert into public.task_approvals
    (submission_id, task_id, submission_version, approver_id, approver_role, stage, decision, comment)
  values
    (s.id, s.task_id, s.version, v_uid, v_role, 'organizer', 'approved', nullif(p_comment,''));

  update public.task_submissions set status = 'organizer_approved' where id = s.id;

  -- Supersede any older handoff, then create the current one.
  update public.publishing_records
     set is_current = false, status = 'superseded'
   where task_id = s.task_id and is_current;

  select * into b from public.task_briefs where task_id = s.task_id;

  insert into public.publishing_records
    (task_id, submission_id, submission_version, platform, caption, hashtags,
     drive_link, source_url, instructions, status, is_current, organizer_approved_at)
  values
    (s.task_id, s.id, s.version,
     t.target_platform,
     coalesce(b.social_json->>'caption', b.brief_json->>'caption'),
     coalesce(b.social_json->>'hashtags', b.brief_json->>'hashtags'),
     s.drive_link, s.source_url,
     coalesce(b.social_json->>'publishing_instructions', b.brief_json->>'publishing_instructions'),
     'ready', true, now())
  returning id into v_hand;

  update public.tasks set production_status = 'ready_for_publishing'
   where id = s.task_id;

  perform public._log_task_event(s.task_id, 'organizer_approved', jsonb_build_object(
    'submission_id', s.id,
    'version', s.version,
    'approver_id', v_uid,
    'handoff_id', v_hand
  ));

  perform public._insert_notification(s.designer_id,
    'Design approved: ' || t.task_code,
    'Version ' || s.version || ' was approved and is ready for publishing.', 'task', s.task_id::text);

  -- Notify all active Social Media Managers.
  for v_smm in
    select r.user_id from public.user_roles r
      join public.profiles p on p.id = r.user_id
     where r.role = 'social_media_manager' and p.is_active
  loop
    perform public._insert_notification(v_smm,
      'Content ready for publishing: ' || t.task_code,
      'Version ' || s.version || ' approved. Open the Ready to Publish queue.', 'task', s.task_id::text);
  end loop;

  return v_hand;
end;
$$;
comment on function public.approve_as_organizer(uuid, text) is 'Organizer final approval: one approval per stage, submission marked organizer_approved, publishing handoff created (old handoffs superseded), task -> ready_for_publishing, designer + SMMs notified. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 13. request_organizer_revision — Organizer -> Team Lead -> Designer.
-- ---------------------------------------------------------------------------
create or replace function public.request_organizer_revision(
  p_submission_id uuid,
  p_instructions  text,
  p_priority      text default null,
  p_deadline      timestamptz default null,
  p_reference_urls jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   app_role;
  v_uid    uuid := auth.uid();
  s        public.task_submissions%rowtype;
  t        public.tasks%rowtype;
  v_lead   uuid;
  v_stage  text;
  v_owner  uuid;
  v_rev    uuid;
begin
  v_role := public._require_task_caller(array['organizer']::app_role[]);

  if p_instructions is null or btrim(p_instructions) = '' then
    raise exception 'Revision instructions are required.';
  end if;

  select * into s from public.task_submissions where id = p_submission_id;
  if s.id is null then
    raise exception 'Submission not found.';
  end if;
  if not s.is_current then
    raise exception 'Only the current submission version can receive a revision request.';
  end if;

  select * into t from public.tasks where id = s.task_id for update;
  if t.production_status <> 'submitted_organizer_review' then
    raise exception 'Submission is not awaiting Organizer review (task: %).', t.production_status;
  end if;

  -- Route to the Team Lead first; if none is assigned, go straight to the designer.
  v_lead := public._task_lead_id(s.task_id);
  if v_lead is not null then
    v_stage := 'awaiting_lead';
    v_owner := v_lead;
  else
    v_stage := 'with_designer';
    v_owner := s.designer_id;
  end if;

  insert into public.revision_requests
    (submission_id, task_id, submission_version, requested_by, source_role,
     request_text, original_instructions, reference_urls, priority,
     suggested_deadline, current_stage, current_owner_id, status)
  values
    (s.id, s.task_id, s.version, v_uid, 'organizer',
     btrim(p_instructions), btrim(p_instructions),
     coalesce(p_reference_urls, '[]'::jsonb), p_priority,
     p_deadline, v_stage, v_owner, 'open')
  returning id into v_rev;

  insert into public.revision_routing_events
    (revision_id, actor_id, from_stage, to_stage, action, note)
  values
    (v_rev, v_uid, 'submitted_organizer_review', v_stage, 'requested',
     'Organizer requested changes on version ' || s.version);

  update public.task_submissions set status = 'revision_requested' where id = s.id;

  -- Defensive: no handoff should exist at this stage, but invalidate regardless.
  update public.publishing_records
     set is_current = false, status = 'superseded'
   where task_id = s.task_id and is_current;

  update public.tasks
     set production_status = case when v_stage = 'awaiting_lead'
                                  then 'revision_awaiting_lead'
                                  else 'revision_required_designer' end
   where id = s.task_id;

  perform public._log_task_event(s.task_id, 'revision_requested', jsonb_build_object(
    'revision_id', v_rev,
    'source_role', 'organizer',
    'submission_version', s.version,
    'routed_to', v_stage
  ));

  perform public._insert_notification(v_owner,
    'Revision requested: ' || t.task_code,
    'The Organizer requested changes on version ' || s.version || '.', 'task', s.task_id::text);

  return v_rev;
end;
$$;
comment on function public.request_organizer_revision(uuid, text, text, timestamptz, jsonb) is 'Organizer requests changes: staged revision Organizer -> Team Lead -> Designer (direct to designer when no lead). Task -> revision_awaiting_lead / revision_required_designer. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 14. request_social_media_revision — SMM -> Organizer -> Team Lead -> Designer.
-- The SMM can NEVER route directly to the designer.
-- ---------------------------------------------------------------------------
create or replace function public.request_social_media_revision(
  p_handoff_id   uuid,
  p_instructions text,
  p_priority     text default null,
  p_deadline     timestamptz default null,
  p_reference_urls jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   app_role;
  v_uid    uuid := auth.uid();
  h        public.publishing_records%rowtype;
  t        public.tasks%rowtype;
  v_owner  uuid;
  v_rev    uuid;
begin
  v_role := public._require_task_caller(array['social_media_manager']::app_role[]);

  if p_instructions is null or btrim(p_instructions) = '' then
    raise exception 'Revision instructions are required.';
  end if;

  select * into h from public.publishing_records where id = p_handoff_id;
  if h.id is null then
    raise exception 'Publishing handoff not found.';
  end if;
  if not h.is_current or h.status <> 'ready' then
    raise exception 'This handoff is no longer the current approved version.';
  end if;

  select * into t from public.tasks where id = h.task_id for update;
  if t.production_status <> 'ready_for_publishing' then
    raise exception 'Task is not ready for publishing (current: %).', t.production_status;
  end if;

  -- The approving organizer must acknowledge first. Fall back to the task
  -- creator when they are an organizer, else any active organizer.
  select a.approver_id into v_owner
    from public.task_approvals a
   where a.submission_id = h.submission_id and a.stage = 'organizer'
   order by a.created_at desc limit 1;
  if v_owner is null then
    select t2.created_by into v_owner from public.tasks t2
     where t2.id = h.task_id
       and exists (select 1 from public.user_roles r
                    where r.user_id = t2.created_by and r.role = 'organizer');
  end if;
  if v_owner is null then
    select r.user_id into v_owner
      from public.user_roles r join public.profiles p on p.id = r.user_id
     where r.role = 'organizer' and p.is_active
     order by p.created_at limit 1;
  end if;
  if v_owner is null then
    raise exception 'No organizer available to receive this revision request.';
  end if;

  insert into public.revision_requests
    (submission_id, task_id, submission_version, requested_by, source_role,
     request_text, original_instructions, reference_urls, priority,
     suggested_deadline, current_stage, current_owner_id, status)
  values
    (h.submission_id, h.task_id, h.submission_version, v_uid, 'social_media_manager',
     btrim(p_instructions), btrim(p_instructions),
     coalesce(p_reference_urls, '[]'::jsonb), p_priority,
     p_deadline, 'awaiting_organizer', v_owner, 'open')
  returning id into v_rev;

  insert into public.revision_routing_events
    (revision_id, actor_id, from_stage, to_stage, action, note)
  values
    (v_rev, v_uid, 'ready_for_publishing', 'awaiting_organizer', 'requested',
     'Social Media Manager requested changes on approved version ' || h.submission_version);

  -- The revision invalidates the handoff: it must not be publishable anymore.
  update public.publishing_records
     set is_current = false, status = 'superseded'
   where id = h.id;

  update public.task_submissions set status = 'revision_requested'
   where id = h.submission_id;

  update public.tasks set production_status = 'revision_awaiting_organizer'
   where id = h.task_id;

  perform public._log_task_event(h.task_id, 'revision_requested', jsonb_build_object(
    'revision_id', v_rev,
    'source_role', 'social_media_manager',
    'submission_version', h.submission_version,
    'handoff_id', h.id
  ));

  perform public._insert_notification(v_owner,
    'Revision requested by Social Media: ' || t.task_code,
    'A revision was requested on the approved version ' || h.submission_version || '.', 'task', h.task_id::text);

  return v_rev;
end;
$$;
comment on function public.request_social_media_revision(uuid, text, text, timestamptz, jsonb) is 'SMM requests changes on a ready handoff: staged SMM -> Organizer -> Team Lead -> Designer (SMM can never route directly). Handoff superseded; task -> revision_awaiting_organizer. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 15. acknowledge_revision — the current owner confirms receipt.
-- ---------------------------------------------------------------------------
create or replace function public.acknowledge_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
  r      public.revision_requests%rowtype;
begin
  v_role := public._require_task_caller();

  select * into r from public.revision_requests where id = p_revision_id;
  if r.id is null then
    raise exception 'Revision request not found.';
  end if;
  if r.status <> 'open' then
    raise exception 'This revision request is already %.', r.status;
  end if;
  if r.current_owner_id is distinct from v_uid and v_role <> 'organizer' then
    raise exception 'Only the current owner may acknowledge this revision.';
  end if;

  update public.revision_requests
     set acknowledged_at = coalesce(acknowledged_at, now())
   where id = p_revision_id;

  insert into public.revision_routing_events
    (revision_id, actor_id, from_stage, to_stage, action, note)
  values
    (p_revision_id, v_uid, r.current_stage, r.current_stage, 'acknowledged',
     v_role || ' acknowledged the revision request');

  perform public._log_task_event(r.task_id, 'revision_acknowledged', jsonb_build_object(
    'revision_id', p_revision_id,
    'actor_role', v_role
  ));
end;
$$;
comment on function public.acknowledge_revision(uuid) is 'Current revision owner acknowledges receipt. Organizers may acknowledge on behalf. Writes a routing event. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 16. forward_revision — move the revision to the next required stage.
--   awaiting_organizer -> awaiting_lead (organizer forwards to the lead)
--   awaiting_lead      -> with_designer (lead forwards, may add clarification)
-- The originator instructions are NEVER overwritten; clarification is additive.
-- ---------------------------------------------------------------------------
create or replace function public.forward_revision(
  p_revision_id  uuid,
  p_clarification text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    app_role;
  v_uid     uuid := auth.uid();
  r         public.revision_requests%rowtype;
  t         public.tasks%rowtype;
  v_next    text;
  v_owner   uuid;
  v_lead    uuid;
  v_designer uuid;
begin
  v_role := public._require_task_caller();

  select * into r from public.revision_requests where id = p_revision_id for update;
  if r.id is null then
    raise exception 'Revision request not found.';
  end if;
  if r.status <> 'open' then
    raise exception 'This revision request is already %.', r.status;
  end if;
  if r.current_owner_id is distinct from v_uid and v_role <> 'organizer' then
    raise exception 'Only the current owner may forward this revision.';
  end if;

  select * into t from public.tasks where id = r.task_id for update;

  if r.current_stage = 'awaiting_organizer' then
    if v_role <> 'organizer' then
      raise exception 'Only an organizer can forward from this stage.';
    end if;
    v_lead := public._task_lead_id(r.task_id);
    if v_lead is not null then
      v_next := 'awaiting_lead';
      v_owner := v_lead;
    else
      -- No lead: organizer forwards straight to the designer.
      select s.designer_id into v_designer
        from public.task_submissions s where s.id = r.submission_id;
      v_next := 'with_designer';
      v_owner := v_designer;
    end if;
  elsif r.current_stage = 'awaiting_lead' then
    if not (v_role = 'organizer' or (v_role = 'team_lead' and v_uid = r.current_owner_id)) then
      raise exception 'Only the responsible Team Lead (or an organizer) can forward from this stage.';
    end if;
    select s.designer_id into v_designer
      from public.task_submissions s where s.id = r.submission_id;
    if v_designer is null then
      raise exception 'Submission designer could not be resolved.';
    end if;
    v_next := 'with_designer';
    v_owner := v_designer;
  else
    raise exception 'Revision is at stage %, which cannot be forwarded.', r.current_stage;
  end if;

  update public.revision_requests
     set current_stage = v_next,
         current_owner_id = v_owner,
         forwarded_at = now(),
         clarification = case
           when p_clarification is not null and btrim(p_clarification) <> ''
           then coalesce(clarification || chr(10) || chr(10), '') || btrim(p_clarification)
           else clarification end
   where id = p_revision_id;

  insert into public.revision_routing_events
    (revision_id, actor_id, from_stage, to_stage, action, note)
  values
    (p_revision_id, v_uid, r.current_stage, v_next, 'forwarded',
     case when p_clarification is not null and btrim(p_clarification) <> ''
          then 'Forwarded with clarification.' else 'Forwarded.' end);

  update public.tasks
     set production_status = case when v_next = 'awaiting_lead'
                                  then 'revision_awaiting_lead'
                                  else 'revision_required_designer' end
   where id = r.task_id;

  perform public._log_task_event(r.task_id, 'revision_forwarded', jsonb_build_object(
    'revision_id', p_revision_id,
    'from_stage', r.current_stage,
    'to_stage', v_next,
    'actor_role', v_role
  ));

  perform public._insert_notification(v_owner,
    'Revision forwarded to you: ' || t.task_code,
    'A revision request needs your action.', 'task', r.task_id::text);
end;
$$;
comment on function public.forward_revision(uuid, text) is 'Forwards a revision to the next required stage (organizer->lead->designer). Original instructions are immutable; clarification is appended. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 17. Review queues — scoped RPC feeds for the three review surfaces.
-- ---------------------------------------------------------------------------

-- Team Lead review queue: current submissions awaiting THIS lead.
create or replace function public.get_lead_review_queue()
returns table (
  submission_id uuid,
  task_id       uuid,
  task_code     text,
  title         text,
  version       integer,
  designer_id   uuid,
  designer_name text,
  drive_link    text,
  source_url    text,
  submitted_at  timestamptz,
  due_date      timestamptz,
  priority      text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role app_role;
  v_uid  uuid := auth.uid();
begin
  v_role := public._require_task_caller(array['team_lead']::app_role[]);

  return query
    select s.id, t.id, t.task_code, t.title, s.version,
           s.designer_id, p.full_name, s.drive_link, s.source_url,
           s.submitted_at, t.due_date, t.priority
      from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      left join public.profiles p on p.id = s.designer_id
     where s.is_current
       and t.production_status = 'submitted_lead_review'
       and (t.created_by = v_uid or t.assigned_lead_id = v_uid)
     order by s.submitted_at;
end;
$$;
comment on function public.get_lead_review_queue() is 'Team Lead review queue: current submissions awaiting this lead (own created or assigned). SECURITY DEFINER.';

revoke all on function public.get_lead_review_queue() from public;
grant execute on function public.get_lead_review_queue() to authenticated;

-- Organizer approval queue: all submissions awaiting organizer review.
create or replace function public.get_organizer_review_queue()
returns table (
  submission_id uuid,
  task_id       uuid,
  task_code     text,
  title         text,
  version       integer,
  designer_id   uuid,
  designer_name text,
  lead_id       uuid,
  lead_name     text,
  drive_link    text,
  source_url    text,
  submitted_at  timestamptz,
  due_date      timestamptz,
  priority      text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role app_role;
begin
  v_role := public._require_task_caller(array['organizer']::app_role[]);

  return query
    select s.id, t.id, t.task_code, t.title, s.version,
           s.designer_id, dp.full_name,
           t.assigned_lead_id, lp.full_name,
           s.drive_link, s.source_url,
           s.submitted_at, t.due_date, t.priority
      from public.task_submissions s
      join public.tasks t on t.id = s.task_id
      left join public.profiles dp on dp.id = s.designer_id
      left join public.profiles lp on lp.id = t.assigned_lead_id
     where s.is_current
       and t.production_status = 'submitted_organizer_review'
     order by s.submitted_at;
end;
$$;
comment on function public.get_organizer_review_queue() is 'Organizer approval queue: all current submissions awaiting organizer review. SECURITY DEFINER.';

revoke all on function public.get_organizer_review_queue() from public;
grant execute on function public.get_organizer_review_queue() to authenticated;

-- SMM ready queue: current ready handoffs with approved content.
create or replace function public.get_smm_ready_queue()
returns table (
  handoff_id     uuid,
  task_id        uuid,
  task_code      text,
  title          text,
  version        integer,
  drive_link     text,
  source_url     text,
  caption        text,
  hashtags       text,
  platform       text,
  instructions   text,
  approved_at    timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_role app_role;
begin
  v_role := public._require_task_caller(array['social_media_manager']::app_role[]);

  return query
    select h.id, t.id, t.task_code, t.title, h.submission_version,
           h.drive_link, h.source_url, h.caption, h.hashtags,
           h.platform, h.instructions, h.organizer_approved_at
      from public.publishing_records h
      join public.tasks t on t.id = h.task_id
     where h.is_current and h.status = 'ready'
     order by h.organizer_approved_at desc;
end;
$$;
comment on function public.get_smm_ready_queue() is 'Social Media Manager ready queue: current approved handoffs only (never unfinished work). SECURITY DEFINER.';

revoke all on function public.get_smm_ready_queue() from public;
grant execute on function public.get_smm_ready_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- 18. Grants for the workflow functions.
-- ---------------------------------------------------------------------------
revoke all on function public.submit_design(uuid, text, text, text, text, boolean, jsonb) from public;
grant execute on function public.submit_design(uuid, text, text, text, text, boolean, jsonb) to authenticated;

revoke all on function public.approve_as_team_lead(uuid, text) from public;
grant execute on function public.approve_as_team_lead(uuid, text) to authenticated;

revoke all on function public.request_team_lead_revision(uuid, text, text, timestamptz, jsonb) from public;
grant execute on function public.request_team_lead_revision(uuid, text, text, timestamptz, jsonb) to authenticated;

revoke all on function public.approve_as_organizer(uuid, text) from public;
grant execute on function public.approve_as_organizer(uuid, text) to authenticated;

revoke all on function public.request_organizer_revision(uuid, text, text, timestamptz, jsonb) from public;
grant execute on function public.request_organizer_revision(uuid, text, text, timestamptz, jsonb) to authenticated;

revoke all on function public.request_social_media_revision(uuid, text, text, timestamptz, jsonb) from public;
grant execute on function public.request_social_media_revision(uuid, text, text, timestamptz, jsonb) to authenticated;

revoke all on function public.acknowledge_revision(uuid) from public;
grant execute on function public.acknowledge_revision(uuid) to authenticated;

revoke all on function public.forward_revision(uuid, text) from public;
grant execute on function public.forward_revision(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 19. Realtime: add workflow tables to the supabase_realtime publication.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text[];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  select array_agg(v.tbl)
    into v_missing
    from (values ('task_submissions'), ('task_approvals'), ('revision_requests'),
                 ('revision_routing_events'), ('publishing_records')) as v(tbl)
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
