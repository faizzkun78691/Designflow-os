-- ============================================================================
-- DESIGNFLOW OS — PHASE 3 FOLLOW-UP (006)
-- Drops the legacy full unique constraint on publishing_records.task_id from
-- migration 002. Phase 3 models a handoff *history*: each organizer approval
-- inserts a NEW publishing_records row with is_current=true and demotes the
-- previous row to is_current=false. A full unique(task_id) would make the
-- second approval cycle (after any revision) fail with a unique violation.
-- The partial unique index from migration 005 —
--   publishing_records_one_current_idx ON (task_id) WHERE is_current —
-- remains the live invariant: at most one CURRENT handoff per task, while
-- superseded rows are preserved for the audit trail.
-- Idempotent: safe to run multiple times.
-- ============================================================================

do $$
begin
  -- Auto-generated name for the inline `unique` on task_id in migration 002.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.publishing_records'::regclass
      and conname = 'publishing_records_task_id_key'
  ) then
    alter table public.publishing_records
      drop constraint publishing_records_task_id_key;
  end if;

  -- Safety net: drop ANY other unique constraint that covers exactly (task_id)
  -- and is not the partial-index replacement.
  declare
    c record;
  begin
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.publishing_records'::regclass
        and contype = 'u'
        and conname <> 'publishing_records_task_id_key'
        and array_length(conkey, 1) = 1
        and conkey[1] = (
          select attnum from pg_attribute
          where attrelid = 'public.publishing_records'::regclass
            and attname = 'task_id'
        )
    loop
      execute format(
        'alter table public.publishing_records drop constraint %I',
        c.conname
      );
    end loop;
  end;
end
$$;

-- Re-assert the partial-index invariant (no-op if 005 already created it).
create unique index if not exists publishing_records_one_current_idx
  on public.publishing_records (task_id) where is_current;
