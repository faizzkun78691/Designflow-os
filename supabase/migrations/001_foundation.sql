-- ============================================================================
-- DesignFlow OS — Migration 001: Foundation
-- Auth-aligned profiles, roles, teams, audit logging, RLS, avatar storage.
-- Postgres 15 / Supabase compatible. Idempotent where practical.
-- ============================================================================

-- Extension for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum: application roles
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.app_role as enum (
    'organizer',
    'team_lead',
    'designer',
    'social_media_manager'
  );
exception
  when duplicate_object then null;
end
$$;

-- ---------------------------------------------------------------------------
-- Helper: generic updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guard: prevent non-service-role callers from changing privileged columns
-- on profiles (email, is_active, designation). Frontend users may only change
-- full_name / avatar_url; organizer deactivation goes through the Edge
-- Function using the service-role key.
-- auth.role() reads the caller JWT claim and is unaffected by the
-- SECURITY DEFINER context, so this correctly distinguishes callers.
-- ---------------------------------------------------------------------------
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if new.email       is distinct from old.email
    or new.is_active   is distinct from old.is_active
    or new.designation is distinct from old.designation then
      raise exception 'Changing email, is_active, or designation requires the service role.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Table: profiles (one row per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text        not null,
  email       text        not null unique,
  avatar_url  text,
  designation text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'DesignFlow OS user profiles, keyed 1:1 to auth.users. Privileged columns (email, is_active, designation) are protected by trigger for non-service-role callers.';
comment on column public.profiles.is_active is 'Organizer-controlled activation flag. Only writable via the team-admin Edge Function (service role).';

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_protect_privileged on public.profiles;
create trigger trg_profiles_protect_privileged
before update on public.profiles
for each row execute function public.protect_privileged_profile_columns();

-- ---------------------------------------------------------------------------
-- Table: user_roles (one role per user)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid        primary key references public.profiles(id) on delete cascade,
  role        app_role    not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid        references public.profiles(id)
);
comment on table public.user_roles is 'Single application role per user. Organizers read other users'' roles via get_employee_directory(); there are no direct RLS insert/update/delete policies for authenticated users.';

-- ---------------------------------------------------------------------------
-- Tables: teams and team_members
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  created_by  uuid        references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.teams is 'Design teams. Created and managed by organizers; members can read teams they belong to.';

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create table if not exists public.team_members (
  id                   uuid        primary key default gen_random_uuid(),
  team_id              uuid        not null references public.teams(id) on delete cascade,
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  reporting_manager_id uuid        references public.profiles(id),
  joined_at            timestamptz not null default now(),
  is_active            boolean     not null default true,
  constraint team_members_team_user_unique unique (team_id, user_id),
  constraint team_members_no_self_report check (reporting_manager_id is null or reporting_manager_id <> user_id)
);
comment on table public.team_members is 'Team membership with reporting lines. A member cannot report to themselves.';

-- ---------------------------------------------------------------------------
-- Table: system_audit_logs (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.system_audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        references public.profiles(id),
  action      text        not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);
comment on table public.system_audit_logs is 'Append-only audit trail. Authenticated users may insert rows where they are the actor; only organizers may read all rows.';

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (fixed search_path, granted to authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.user_roles where user_id = auth.uid();
$$;
comment on function public.current_user_role() is 'Returns the calling user''s application role, or NULL if none assigned.';

create or replace function public.is_organizer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'organizer'
  );
$$;
comment on function public.is_organizer() is 'True when the calling user holds the organizer role.';

create or replace function public.is_team_member(tid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid() and is_active
  );
$$;
comment on function public.is_team_member(uuid) is 'True when the calling user is an active member of the given team.';

create or replace function public.get_employee_directory()
returns table (
  id               uuid,
  full_name        text,
  email            text,
  avatar_url       text,
  designation      text,
  is_active        boolean,
  created_at       timestamptz,
  updated_at       timestamptz,
  role             app_role,
  role_assigned_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_organizer() then
    raise exception 'Only organizers may view the employee directory.';
  end if;
  return query
    select p.id, p.full_name, p.email, p.avatar_url, p.designation,
           p.is_active, p.created_at, p.updated_at,
           r.role, r.assigned_at
    from public.profiles p
    left join public.user_roles r on r.user_id = p.id
    order by p.created_at desc;
end;
$$;
comment on function public.get_employee_directory() is 'Organizer-only full directory (profiles + roles). This is how organizers read other users'' roles, since RLS on user_roles exposes only one''s own row.';

grant execute on function public.current_user_role()          to authenticated;
grant execute on function public.is_organizer()               to authenticated;
grant execute on function public.is_team_member(uuid)         to authenticated;
grant execute on function public.get_employee_directory()     to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security — deny by default; policies below are the only access.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.user_roles        enable row level security;
alter table public.teams             enable row level security;
alter table public.team_members      enable row level security;
alter table public.system_audit_logs enable row level security;

-- profiles: own row read/update; organizer full read; team_lead scoped read.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_select_organizer" on public.profiles;
create policy "profiles_select_organizer" on public.profiles
  for select to authenticated
  using (public.is_organizer());

drop policy if exists "profiles_select_team_lead_scoped" on public.profiles;
create policy "profiles_select_team_lead_scoped" on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.team_members tm
      join public.team_members me on me.team_id = tm.team_id
      where tm.user_id = public.profiles.id
        and me.user_id = auth.uid()
        and tm.is_active
        and me.is_active
    )
  );
-- Note: no INSERT or DELETE policies for authenticated on profiles;
-- rows are created/removed via auth lifecycle and service-role functions.

-- user_roles: authenticated users may read only their own role row.
-- IMPORTANT: do not reference helper functions in policies on this table;
-- organizers read other users' roles via get_employee_directory().
drop policy if exists "user_roles_select_own" on public.user_roles;
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated
  using (auth.uid() = user_id);

-- teams: organizers manage everything; members read their own teams.
drop policy if exists "teams_organizer_all" on public.teams;
create policy "teams_organizer_all" on public.teams
  for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams
  for select to authenticated
  using (public.is_team_member(teams.id));

-- team_members: organizers manage everything; members read their own teams.
drop policy if exists "team_members_organizer_all" on public.team_members;
create policy "team_members_organizer_all" on public.team_members
  for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

drop policy if exists "team_members_select_member" on public.team_members;
create policy "team_members_select_member" on public.team_members
  for select to authenticated
  using (public.is_team_member(team_members.team_id));

-- system_audit_logs: append-only.
drop policy if exists "audit_insert_own" on public.system_audit_logs;
create policy "audit_insert_own" on public.system_audit_logs
  for insert to authenticated
  with check (auth.uid() = actor_id);

drop policy if exists "audit_select_organizer" on public.system_audit_logs;
create policy "audit_select_organizer" on public.system_audit_logs
  for select to authenticated
  using (public.is_organizer());

drop policy if exists "audit_select_own" on public.system_audit_logs;
create policy "audit_select_own" on public.system_audit_logs
  for select to authenticated
  using (auth.uid() = actor_id);
-- Note: no UPDATE or DELETE policies — audit rows are immutable by clients.

-- ---------------------------------------------------------------------------
-- Storage: public avatars bucket with per-user folder isolation
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
