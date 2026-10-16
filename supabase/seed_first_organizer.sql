-- ============================================================================
-- DesignFlow OS — Seed the FIRST organizer
-- Run this in the Supabase Dashboard -> SQL Editor AFTER migrations 001/002.
--
-- STEP 1 — Create the auth user FIRST (Dashboard -> Authentication -> Users):
--   1. Go to Dashboard -> Authentication -> Users -> "Add user" -> "Create new user".
--   2. Enter the organizer's email, set a temporary password,
--      and tick "Auto Confirm User" (or "auto-confirm email").
--   3. Click the new user row and COPY the UUID (auth.users.id).
--
-- STEP 2 — Replace the three placeholders below, then run this whole script.
-- ============================================================================

-- IMPORTANT: do NOT run this script twice for the same user.
-- Re-running it will violate the unique email constraint on profiles and/or
-- the primary key on user_roles. If you already ran it for a user, skip it.

begin;

-- Replace these placeholders:
--   <PASTE_UUID>  : the auth user's UUID copied in Step 1
--   <FULL_NAME>   : e.g. 'Jane Doe'
--   <EMAIL>       : the same email used in Step 1 (must match auth user email)
insert into public.profiles (id, full_name, email, designation, is_active)
values (
  '<PASTE_UUID>'::uuid,
  '<FULL_NAME>',
  '<EMAIL>',
  'Organizer',
  true
);

insert into public.user_roles (user_id, role, assigned_at, assigned_by)
values (
  '<PASTE_UUID>'::uuid,
  'organizer',
  now(),
  '<PASTE_UUID>'::uuid   -- first organizer assigns themselves
);

commit;

-- Verification: should return exactly one row with role = 'organizer'.
select p.id, p.full_name, p.email, p.designation, p.is_active, r.role
from public.profiles p
join public.user_roles r on r.user_id = p.id
where p.id = '<PASTE_UUID>'::uuid;
