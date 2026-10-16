-- PHASE 2+ WORKFLOW SCHEMA — DDL only; no Phase 1 business logic uses these tables.
-- These tables are created now so later phases can build on them, but all
-- access is deny-by-default (organizers get a single SELECT policy per table
-- so Phase 1 dashboards can render truthful zero-states).
-- Reuses public.set_updated_at() from migration 001.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id                   uuid        primary key default gen_random_uuid(),
  title                text        not null,
  description          text,
  task_type            text        check (task_type in ('public', 'private')),
  status               text        not null default 'unclaimed',
  created_by           uuid        references public.profiles(id),
  assigned_designer_id uuid        references public.profiles(id),
  assigned_lead_id     uuid        references public.profiles(id),
  claimed_by           uuid        references public.profiles(id),
  due_date             timestamptz,
  priority             text        not null default 'normal',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_briefs
-- ---------------------------------------------------------------------------
create table if not exists public.task_briefs (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null unique references public.tasks(id) on delete cascade,
  brief_text text,
  attachments jsonb      not null default '[]',
  created_by uuid        references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_task_briefs_updated_at on public.task_briefs;
create trigger trg_task_briefs_updated_at
before update on public.task_briefs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- task_submissions
-- ---------------------------------------------------------------------------
create table if not exists public.task_submissions (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.tasks(id) on delete cascade,
  designer_id uuid        references public.profiles(id),
  drive_link  text        not null,
  notes       text,
  version     integer     not null default 1,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- task_approvals
-- ---------------------------------------------------------------------------
create table if not exists public.task_approvals (
  id            uuid        primary key default gen_random_uuid(),
  submission_id uuid        not null references public.task_submissions(id) on delete cascade,
  approver_id   uuid        references public.profiles(id),
  approver_role public.app_role,
  decision      text        check (decision in ('approved', 'changes_requested', 'rejected')),
  comment       text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- revision_requests
-- ---------------------------------------------------------------------------
create table if not exists public.revision_requests (
  id            uuid        primary key default gen_random_uuid(),
  submission_id uuid        not null references public.task_submissions(id) on delete cascade,
  requested_by  uuid        references public.profiles(id),
  request_text  text        not null,
  status        text        not null default 'open',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- task_events
-- ---------------------------------------------------------------------------
create table if not exists public.task_events (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks(id) on delete cascade,
  actor_id   uuid        references public.profiles(id),
  event_type text        not null,
  metadata   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- publishing_records
-- ---------------------------------------------------------------------------
create table if not exists public.publishing_records (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        not null unique references public.tasks(id) on delete cascade,
  platform     text,
  caption      text,
  hashtags     text,
  drive_link   text,
  scheduled_at timestamptz,
  published_url text,
  status       text        not null default 'pending',
  managed_by   uuid        references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_publishing_records_updated_at on public.publishing_records;
create trigger trg_publishing_records_updated_at
before update on public.publishing_records
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  title       text,
  body        text,
  entity_type text,
  entity_id   text,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- performance_metrics
-- ---------------------------------------------------------------------------
create table if not exists public.performance_metrics (
  id                  uuid        primary key default gen_random_uuid(),
  designer_id         uuid        not null references public.profiles(id) on delete cascade,
  period_start        date,
  period_end          date,
  tasks_completed     integer     not null default 0,
  avg_turnaround_hours numeric,
  on_time_rate        numeric,
  computed_at         timestamptz,
  constraint performance_metrics_designer_period_unique unique (designer_id, period_start, period_end)
);

-- ---------------------------------------------------------------------------
-- Indexes (FK columns + hot query paths)
-- ---------------------------------------------------------------------------
create index if not exists idx_tasks_created_by           on public.tasks (created_by);
create index if not exists idx_tasks_assigned_designer_id on public.tasks (assigned_designer_id);
create index if not exists idx_tasks_assigned_lead_id     on public.tasks (assigned_lead_id);
create index if not exists idx_tasks_claimed_by            on public.tasks (claimed_by);
create index if not exists idx_tasks_status                on public.tasks (status);
create index if not exists idx_task_briefs_task_id          on public.task_briefs (task_id);
create index if not exists idx_task_briefs_created_by       on public.task_briefs (created_by);
create index if not exists idx_task_submissions_task_id    on public.task_submissions (task_id);
create index if not exists idx_task_submissions_designer_id on public.task_submissions (designer_id);
create index if not exists idx_task_approvals_submission_id on public.task_approvals (submission_id);
create index if not exists idx_task_approvals_approver_id   on public.task_approvals (approver_id);
create index if not exists idx_revision_requests_submission_id on public.revision_requests (submission_id);
create index if not exists idx_revision_requests_requested_by  on public.revision_requests (requested_by);
create index if not exists idx_task_events_task_id         on public.task_events (task_id);
create index if not exists idx_task_events_actor_id        on public.task_events (actor_id);
create index if not exists idx_publishing_records_task_id  on public.publishing_records (task_id);
create index if not exists idx_publishing_records_managed_by on public.publishing_records (managed_by);
create index if not exists idx_notifications_user_id       on public.notifications (user_id);
create index if not exists idx_notifications_user_id_is_read on public.notifications (user_id, is_read);
create index if not exists idx_performance_metrics_designer_id on public.performance_metrics (designer_id);

-- ---------------------------------------------------------------------------
-- RLS: enabled on all, deny-by-default; one organizer SELECT policy per table.
-- ---------------------------------------------------------------------------
alter table public.tasks              enable row level security;
alter table public.task_briefs        enable row level security;
alter table public.task_submissions   enable row level security;
alter table public.task_approvals     enable row level security;
alter table public.revision_requests  enable row level security;
alter table public.task_events        enable row level security;
alter table public.publishing_records enable row level security;
alter table public.notifications      enable row level security;
alter table public.performance_metrics enable row level security;

drop policy if exists "future_tasks_organizer_select" on public.tasks;
create policy "future_tasks_organizer_select" on public.tasks
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_task_briefs_organizer_select" on public.task_briefs;
create policy "future_task_briefs_organizer_select" on public.task_briefs
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_task_submissions_organizer_select" on public.task_submissions;
create policy "future_task_submissions_organizer_select" on public.task_submissions
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_task_approvals_organizer_select" on public.task_approvals;
create policy "future_task_approvals_organizer_select" on public.task_approvals
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_revision_requests_organizer_select" on public.revision_requests;
create policy "future_revision_requests_organizer_select" on public.revision_requests
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_task_events_organizer_select" on public.task_events;
create policy "future_task_events_organizer_select" on public.task_events
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_publishing_records_organizer_select" on public.publishing_records;
create policy "future_publishing_records_organizer_select" on public.publishing_records
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_notifications_organizer_select" on public.notifications;
create policy "future_notifications_organizer_select" on public.notifications
  for select to authenticated using (public.is_organizer());
drop policy if exists "future_performance_metrics_organizer_select" on public.performance_metrics;
create policy "future_performance_metrics_organizer_select" on public.performance_metrics
  for select to authenticated using (public.is_organizer());
