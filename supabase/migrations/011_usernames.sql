-- Phase 6: Username-based login support.
-- Adds a unique username to profiles for username-based authentication.
-- Auth emails use the pattern {username}@designflow.internal (never a real inbox).

alter table public.profiles
  add column if not exists username text;

-- Backfill existing demo profiles with a username derived from email local part.
update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9]', '', 'g'))
where username is null;

-- Enforce uniqueness + format going forward.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_unique'
  ) then
    alter table public.profiles
      add constraint profiles_username_unique unique (username);
  end if;
end $$;

alter table public.profiles
  alter column username set not null;

comment on column public.profiles.username is
  'Unique login username (lowercase). Auth email is {username}@designflow.internal.';

-- Expose username in the organizer employee directory.
create or replace function public.get_employee_directory()
returns table (
  id               uuid,
  full_name        text,
  username         text,
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
    select p.id, p.full_name, p.username, p.email, p.avatar_url, p.designation,
           p.is_active, p.created_at, p.updated_at,
           r.role, r.assigned_at
    from public.profiles p
    left join public.user_roles r on r.user_id = p.id
    order by p.created_at desc;
end;
$$;

-- Protect username from being changed (keeps profile in sync with auth email).
create or replace function public.protect_username()
returns trigger
language plpgsql
as $$
begin
  if NEW.username is distinct from OLD.username then
    raise exception 'Username cannot be changed.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists protect_username_trigger on public.profiles;
create trigger protect_username_trigger
  before update on public.profiles
  for each row execute function public.protect_username();
